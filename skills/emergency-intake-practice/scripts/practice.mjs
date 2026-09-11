#!/usr/bin/env node
// Standalone emergency-intake practice skill (CALL-E REST API).
// PREVIEW by default; --real places ONE self-identifying practice call and
// polls to completion. No automatic redial.
import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { buildTask, deriveIdempotencyKey, isValidE164, languageFor, RESULT_SCHEMA, summarizeCall } from './practice-lib.mjs';

const { values } = parseArgs({
  options: {
    phone: { type: 'string' },
    participant: { type: 'string' },
    locale: { type: 'string', default: 'hi' },
    real: { type: 'boolean', default: false },
    fixture: { type: 'string' },
    help: { type: 'boolean', default: false },
  },
});

if (values.help || !values.phone || !values.participant) {
  console.error('Usage: practice.mjs --phone +E164 --participant "name" [--locale hi] [--real]');
  process.exit(values.help ? 0 : 1);
}

if (!isValidE164(values.phone)) { console.error('Phone must be E.164 (+country…), and the participant must consent to the practice call.'); process.exit(1); }

const language = languageFor(values.locale);
const task = buildTask({ phone: values.phone, participant: values.participant, locale: values.locale });

// Fixture replay: the full output path, zero live calls, zero credits.
if (values.fixture) {
  const call = JSON.parse(readFileSync(values.fixture, 'utf8'));
  const out = summarizeCall(call);
  console.log(`FIXTURE REPLAY — no live call. Fixture: ${values.fixture}\nTask preview: ${task.slice(0, 120)}…\n`);
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.phase === 'FAILED' ? 3 : 0);
}

// Wire format verified against the live /v1/calls endpoint (2026-09-11):
// E.164 recipient and language live in the task text.

if (!values.real) {
  console.log('PREVIEW — no call placed. Exact wire payload:\n');
  console.log(JSON.stringify({ task, result_schema: RESULT_SCHEMA, metadata: { participant: values.participant, product: 'kwik-intake-practice' } }, null, 2));
  process.exit(0);
}

if (!process.env.CALLE_API_KEY) { console.error('CALLE_API_KEY is required for --real'); process.exit(1); }

const BASE = process.env.CALLE_BASE_URL ?? 'https://api.heycall-e.com';
const H = { Authorization: `Bearer ${process.env.CALLE_API_KEY}`, 'Content-Type': 'application/json' };
const idem = deriveIdempotencyKey(values.participant);

const res = await fetch(`${BASE}/v1/calls`, {
  method: 'POST',
  headers: { ...H, 'Idempotency-Key': idem },
  body: JSON.stringify({ task, result_schema: RESULT_SCHEMA, metadata: { participant: values.participant, product: 'kwik-intake-practice' } }),
});
const created = await res.json().catch(() => ({}));
if (!res.ok) { console.error(`Create failed (HTTP ${res.status}): ${created?.error?.message ?? 'unknown'}`); process.exit(2); }
console.log(`Call submitted: ${created.id} — single attempt; cannot be recalled once submitted. Polling…`);

const OK = new Set(['completed', 'complete', 'succeeded', 'success', 'done']);
const BAD = new Set(['failed', 'error', 'canceled', 'cancelled', 'expired']);
for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  const g = await fetch(`${BASE}/v1/calls/${encodeURIComponent(created.id)}`, { headers: H });
  const cur = await g.json().catch(() => ({}));
  const s = String(cur.status || '').toLowerCase();
  const r0 = Array.isArray(cur.recipients) ? cur.recipients[0] ?? {} : {};
  const failure = cur.failure_code ?? r0.failure_code ?? null;
  if (BAD.has(s) || failure) {
    console.error(JSON.stringify({ failed: true, status: cur.status, failure_code: failure, summary: r0.summary ?? cur.summary ?? null }, null, 2));
    console.error('No automatic redial — the missed practice call returns to the human operator.');
    process.exit(3);
  }
  if (OK.has(s)) {
    console.log(JSON.stringify(summarizeCall(cur), null, 2));
    process.exit(0);
  }
}
console.error('Timed out waiting for completion. The call may still be running provider-side; this script exits without redialing.');
process.exit(4);
