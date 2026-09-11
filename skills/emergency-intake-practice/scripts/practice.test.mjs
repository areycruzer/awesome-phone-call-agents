// Zero-live-call test suite for emergency-intake-practice.
// Run: node --test scripts/  (or node --test scripts/practice.test.mjs)
// Every safety property of the skill is asserted here without placing any call.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTask, deriveIdempotencyKey, isValidE164, languageFor, normalizeIntake, phaseOf, summarizeCall, RESULT_SCHEMA } from './practice-lib.mjs';

const task = buildTask({ phone: '+919999112011', participant: 'ravi', locale: 'hi' });
const completed = JSON.parse(readFileSync(new URL('../references/fixtures/completed-intake.fixture.json', import.meta.url), 'utf8'));
const failed = JSON.parse(readFileSync(new URL('../references/fixtures/failed-connect.fixture.json', import.meta.url), 'utf8'));

test('task embeds the E.164 recipient and the conversation language', () => {
  assert.match(task, /^Call \+919999112011 now\./);
  assert.match(task, /practice intake in Hindi/);
});

test('SAFETY: the agent self-identifies as an AI demo — never the real 112', () => {
  assert.match(task, /AI demonstration and NOT the real 112/i);
  assert.ok(!/you are (a|the) 112 operator/i.test(task), 'must never claim to be a 112 operator');
});

test('SAFETY: real-emergency escape hatch is present', () => {
  assert.match(task, /hang up and dial the real emergency number 112/i);
});

test('SAFETY: no dispatch, no promises, no government impersonation', () => {
  assert.match(task, /Do NOT dispatch anyone/i);
  assert.match(task, /do NOT promise help is coming/i);
  assert.match(task, /do NOT claim to be a government service/i);
});

test('consent is named in the task itself', () => {
  assert.match(task, /ravi\) has consented to a practice call/);
});

test('identical inputs produce the identical task (preview/real parity)', () => {
  assert.equal(buildTask({ phone: '+919999112011', participant: 'ravi', locale: 'hi' }), task);
});

test('schema: categorical fields enum-locked with unknown; phrase fields free-form', () => {
  assert.deepEqual(RESULT_SCHEMA.urgency.enum, ['critical', 'high', 'medium', 'low', 'unknown']);
  assert.deepEqual(RESULT_SCHEMA.caller_clarity.enum, ['clear', 'partial', 'unclear', 'unknown']);
  assert.equal(RESULT_SCHEMA.emergency_type.enum, undefined);
  assert.equal(RESULT_SCHEMA.location.enum, undefined);
});

test('fixture replay: completed call normalizes to the structured intake', () => {
  const out = summarizeCall(completed);
  assert.equal(out.phase, 'DONE');
  assert.deepEqual(out.structured_result, {
    emergency_type: 'breathing emergency',
    location: 'Shalimar Bagh B-block, Delhi',
    urgency: 'critical',
    caller_clarity: 'partial',
  });
  assert.match(out.summary, /Shalimar Bagh/);
});

test('fixture replay: failed connect surfaces honestly, no guessed intake', () => {
  const out = summarizeCall(failed);
  assert.equal(out.phase, 'FAILED');
  assert.equal(out.structured_result, null);
  assert.match(out.failure, /call_failed/);
});

test('normalization never guesses: missing fields become unknown', () => {
  const out = normalizeIntake({});
  assert.deepEqual(out, { emergency_type: 'none', location: 'unknown', urgency: 'unknown', caller_clarity: 'unknown' });
  assert.deepEqual(normalizeIntake({ urgency: 'super-urgent', caller_clarity: 'crystal' }).urgency, 'unknown');
});

test('idempotency key is stable within an hour and differs across hours', () => {
  const t = new Date('2026-09-11T10:30:00Z');
  assert.equal(deriveIdempotencyKey('ravi', t), deriveIdempotencyKey('ravi', new Date('2026-09-11T10:59:00Z')));
  assert.notEqual(deriveIdempotencyKey('ravi', t), deriveIdempotencyKey('ravi', new Date('2026-09-11T11:01:00Z')));
});

test('E.164 validation and language fallback', () => {
  assert.equal(isValidE164('+919999112011'), true);
  assert.equal(isValidE164('919999112011'), false);
  assert.equal(languageFor('hi'), 'Hindi');
  assert.equal(languageFor('xx'), 'Hindi');
});

test('in-flight status is recognized (not terminal)', () => {
  assert.equal(phaseOf({ status: 'queued' }), 'IN_FLIGHT');
  assert.equal(phaseOf({ status: 'in_progress' }), 'IN_FLIGHT');
});
