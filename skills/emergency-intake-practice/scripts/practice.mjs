#!/usr/bin/env node
// Standalone emergency-intake practice skill (CALL-E REST API).
// PREVIEW by default; --real places ONE self-identifying practice call and
// polls to completion. No automatic redial.
import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';

const { values } = parseArgs({
  options: {
    phone: { type: 'string' },
    participant: { type: 'string' },
    locale: { type: 'string', default: 'hi' },
    real: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});

if (values.help || !values.phone || !values.participant) {
  console.error('Usage: practice.mjs --phone +E164 --participant "name" [--locale hi] [--real]');
  process.exit(values.help ? 0 : 1);
}

const E164 = /^\+[1-9]\d{6,14}$/;
if (!E164.test(values.phone)) { console.error('Phone must be E.164 (+country…), and the participant must consent to the practice call.'); process.exit(1); }

const LANGS = { hi: 'Hindi', 'en-IN': 'Indian English', ta: 'Tamil', te: 'Telugu', bn: 'Bengali', mr: 'Marathi', pa: 'Punjabi', kn: 'Kannada' };
const language = LANGS[values.locale] ?? 'Hindi';

const RESULT_SCHEMA = JSON.parse(readFileSync(new URL('../references/result-schema.json', import.meta.url), 'utf8'));

// Wire format verified against the live /v1/calls endpoint (2026-09-11):
// E.164 recipient and language live in the task text.
const task = [
  `Call ${values.phone} now.`,
  `You are Kwik, a DEMO emergency-call intake simulator built for a hackathon. The person who answers (${values.participant}) has consented to a practice call — they will play the role of a citizen reporting an emergency.`,
  `SAFETY FIRST: Begin the call by clearly stating, in ${language}, that you are an AI demonstration and NOT the real 112 emergency service. If at any point the person indicates a real ongoing emergency, immediately tell them to hang up and dial the real emergency number 112.`,
  `Then run the practice intake in ${language}: ask (1) what happened, (2) where they are, (3) how urgent it is. Ask one question at a time, be calm and reassuring, and confirm the location back to them before finishing. Keep the practice call under three minutes.`,
  `Do NOT dispatch anyone, do NOT promise help is coming, do NOT claim to be a government service. This is a simulation of intake only.`,
].join(' ');

if (!values.real) {
  console.log('PREVIEW — no call placed. Exact wire payload:\n');
  console.log(JSON.stringify({ task, result_schema: RESULT_SCHEMA, metadata: { participant: values.participant, product: 'kwik-intake-practice' } }, null, 2));
  process.exit(0);
}

if (!process.env.CALLE_API_KEY) { console.error('CALLE_API_KEY is required for --real'); process.exit(1); }

const BASE = process.env.CALLE_BASE_URL ?? 'https://api.heycall-e.com';
const H = { Authorization: `Bearer ${process.env.CALLE_API_KEY}`, 'Content-Type': 'application/json' };
const idem = `kwik-intake-${values.participant}-${new Date().toISOString().slice(0, 13)}`;

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
    console.log(JSON.stringify({ structured_result: cur.structured_result ?? r0.structured_result ?? null, summary: r0.summary ?? cur.summary ?? null }, null, 2));
    process.exit(0);
  }
}
console.error('Timed out waiting for completion. The call may still be running provider-side; this script exits without redialing.');
process.exit(4);
