---
name: emergency-intake-practice
description: Place a self-identifying AI practice call that rehearses the citizen side of an emergency call — asks what happened, where, and how urgent in the participant's language — and returns a structured intake (emergency_type, location, urgency, caller_clarity). The agent always announces it is a demo and never the real emergency service, and directs real emergencies to the real number.
license: MIT
---

# Emergency Intake Practice

Use this skill when a consenting participant wants to **practice making an
emergency call** — a citizen rehearsing how to report clearly, a trainer
drilling intake quality, or a builder testing an intake flow — against a real
phone line without touching the real emergency number.

`emergency-intake-practice` is a purpose-bound outbound skill. It places
exactly one bounded call to a consenting participant, opens by identifying
itself as an AI demonstration **and not the real 112**, runs a short intake
in the participant's language, and returns a structured result. It never
dispatches, never promises help, and never claims to be a government service.

The boundary this skill exists to enforce: **an AI can rehearse the
conversation around an emergency call — it must never pretend to be the
emergency service itself.**

## Scope boundary (discovered live, disclosed honestly)

CALL-E's request safety layer declines tasks involving emergency dispatch or
emergency-service coordination (HTTP 422 `call_not_ready`, verbatim: *"I
can't place or plan calls involving emergency dispatch or emergency-service
coordination… please revise the request to a non-emergency use case."*).
This skill is the non-emergency use case that honors that boundary:
self-identified practice and training, with the real service pointed to
explicitly on every call.

## When To Use

- citizens or students rehearsing how to report an emergency clearly
  (preparedness training, civic-education programs)
- testing intake flows and structured extraction against real phone audio
- training call-takers on what unclear callers sound like (`caller_clarity`
  is captured on every call)
- any consented practice context — the participant knows the call is coming

## When Not To Use

Do not use this skill to:

- answer as, speak for, or impersonate the real 112 or any emergency service
- place calls to participants who have not consented or do not expect it
- collect information about a real ongoing emergency — the agent's job in
  that case is to say so and direct the person to the real emergency number
- auto-redial missed practice calls (failures return to the human operator)

## Result Schema

```json
{
  "emergency_type": "breathing emergency",
  "location": "Shalimar Bagh B-block, Delhi",
  "urgency": "critical",
  "caller_clarity": "partial"
}
```

Categorical fields are enum-locked (`urgency`, `caller_clarity` — including
`unknown`); phrase fields are free-form. A bad line returns `unknown`, never
a guess, so downstream tools keep a predictable shape.

## Wire format

The live `/v1/calls` endpoint takes the E.164 recipient **inside the task
text** plus `result_schema` and `metadata`; structured recipient/policy
objects are rejected (`extra_forbidden`, verified 2026-09-11). The script
embeds `Call +<E164> now.`, instructs the conversation language in the task,
and sends a stable `Idempotency-Key` so a replayed command cannot double-call.

## Safety Rules

1. **Self-identification first.** The task requires the agent to open by
   stating, in the participant's language, that it is an AI demonstration
   and NOT the real 112.
2. **Real-emergency escape hatch.** If the participant indicates a real
   ongoing emergency, the agent tells them to hang up and dial the real
   emergency number immediately.
3. **Consent boundary.** Preview first (default), single call per run,
   consenting participants only.
4. **Intake only.** Never dispatch, never promise help, never claim to be a
   government service.
5. **No automatic redial.** Missed calls fail honestly back to the operator.

## Setup

```bash
export CALLE_API_KEY=...   # server/CLI side only
```

## Usage

```bash
# PREVIEW — prints the exact task, places no call:
node scripts/practice.mjs \
  --phone "+919999XXXXXX" \
  --participant "test-user" \
  [--locale hi]

# REAL — one call, polls to completion:
node scripts/practice.mjs --phone "+919999XXXXXX" --participant "test-user" --real
```

## Side Effects & Cancellation

- `--real` places exactly one real outbound call to the given number.
- PREVIEW mode (default) has zero side effects.
- A submitted call cannot be recalled; closing the terminal does not stop it.
- No scheduling or recurrence lives in the skill — the host scheduler owns
  recurring drills.

## References

- `references/goal-template.md` — the exact task text and the rationale for
  every safety line.
- `references/result-schema.json` — the structured intake schema.
- `references/examples.md` — worked examples incl. the refusal and
  unclear-caller paths.
- `references/safety.md` — failure modes each property prevents.

## Origin

Built into [Kwik 112](https://github.com/areycruzer/kwik-112) (CALL-E hackathon
2026) — the citizen's emergency call, made testable. Live console:
https://pulse112-dispatch-ai.vercel.app (the demo call in the voice station
places this skill's call and files the structured intake as a graded case).
