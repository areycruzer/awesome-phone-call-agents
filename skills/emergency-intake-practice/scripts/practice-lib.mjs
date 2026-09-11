// Shared logic for the practice-call skill — imported by the CLI and by the
// test suite, so every safety property is testable with ZERO live calls.
import { readFileSync } from 'node:fs';

export const LANGS = { hi: 'Hindi', 'en-IN': 'Indian English', ta: 'Tamil', te: 'Telugu', bn: 'Bengali', mr: 'Marathi', pa: 'Punjabi', kn: 'Kannada' };

export const RESULT_SCHEMA = JSON.parse(readFileSync(new URL('../references/result-schema.json', import.meta.url), 'utf8'));

const E164 = /^\+[1-9]\d{6,14}$/;
export function isValidE164(phone) { return E164.test(phone); }

export function languageFor(locale) { return LANGS[locale] ?? 'Hindi'; }

/**
 * The task CALL-E executes. The self-identification and the real-emergency
 * escape hatch are load-bearing (this framing passed the provider's live
 * request safety review, 2026-09-11). Tests assert every safety line.
 */
export function buildTask({ phone, participant, locale = 'hi' }) {
  const language = languageFor(locale);
  return [
    `Call ${phone} now.`,
    `You are Kwik, a DEMO emergency-call intake simulator built for a hackathon. The person who answers (${participant}) has consented to a practice call — they will play the role of a citizen reporting an emergency.`,
    `SAFETY FIRST: Begin the call by clearly stating, in ${language}, that you are an AI demonstration and NOT the real 112 emergency service. If at any point the person indicates a real ongoing emergency, immediately tell them to hang up and dial the real emergency number 112.`,
    `Then run the practice intake in ${language}: ask (1) what happened, (2) where they are, (3) how urgent it is. Ask one question at a time, be calm and reassuring, and confirm the location back to them before finishing. Keep the practice call under three minutes.`,
    `Do NOT dispatch anyone, do NOT promise help is coming, do NOT claim to be a government service. This is a simulation of intake only.`,
  ].join(' ');
}

/** Stable per participant+hour: a replayed command cannot double-call. */
export function deriveIdempotencyKey(participant, now = new Date()) {
  return `kwik-intake-${participant}-${now.toISOString().slice(0, 13)}`;
}

/** Normalize a provider response (live or fixture) into the intake result.
 *  Categorical fields fall back to 'unknown' — never a guess. */
export function normalizeIntake(structured) {
  const r = structured ?? {};
  return {
    emergency_type: String(r.emergency_type ?? 'none').slice(0, 120) || 'none',
    location: String(r.location ?? 'unknown').slice(0, 160) || 'unknown',
    urgency: ['critical', 'high', 'medium', 'low', 'unknown'].includes(r.urgency) ? r.urgency : 'unknown',
    caller_clarity: ['clear', 'partial', 'unclear', 'unknown'].includes(r.caller_clarity) ? r.caller_clarity : 'unknown',
  };
}

const OK = new Set(['completed', 'complete', 'succeeded', 'success', 'done']);
const BAD = new Set(['failed', 'error', 'canceled', 'cancelled', 'expired']);
export function phaseOf(call) {
  const s = String(call?.status ?? '').toLowerCase();
  const r0 = Array.isArray(call?.recipients) ? call.recipients[0] ?? {} : {};
  const failure = call?.failure_code ?? r0.failure_code ?? null;
  if (BAD.has(s) || failure) return 'FAILED';
  if (OK.has(s)) return 'DONE';
  return 'IN_FLIGHT';
}

export function summarizeCall(call) {
  const r0 = Array.isArray(call?.recipients) ? call.recipients[0] ?? {} : {};
  const summary = [r0.summary, call?.summary].filter((x) => typeof x === 'string' && x.length).join(' ') || null;
  const phase = phaseOf(call);
  const failure = call?.failure_code ?? r0.failure_code ?? null;
  return {
    phase,
    structured_result: phase === 'DONE' ? normalizeIntake(call?.structured_result ?? r0.structured_result) : null,
    summary: summary ? summary.slice(0, 400) : null,
    failure: failure ? `${failure}${summary ? `: ${summary.slice(0, 160)}` : ''}` : phase === 'FAILED' ? 'provider reported failure' : null,
  };
}
