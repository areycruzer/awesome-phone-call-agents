# Demo Guide

A five-minute, zero-cost walk-through that never places a call, followed by
one authorized practice call for a live demo.

## 0. Preconditions

- Node 20+.
- `CALLE_API_KEY` exported only for step 4.
- A number you are authorized to call — for practice tests, your own phone,
  with the participant (you) expecting the call.

## 1. Preview (no call, no key)

```bash
node scripts/practice.mjs --phone "+91<your-number>" --participant "your-name"
```

Read the printed task aloud in a demo: point at the self-identification
line ("NOT the real 112"), the escape hatch ("hang up and dial the real
emergency number 112"), the one-question-at-a-time structure, and the
no-dispatch constraints. This is the auditability story.

## 2. The refusal (no call, by design)

Drop `--participant` and re-run: the script exits non-zero with usage.
Consent is required, and it is named.

## 3. Schema talk-track

`emergency_type` and `location` are free-form phrases; `urgency` and
`caller_clarity` are enum-locked with `unknown`. An unclear caller returns
`caller_clarity: "unclear"` — that is the training signal, not an error.

## 4. One practice call (authorized, budgeted)

```bash
node scripts/practice.mjs --phone "+91<your-number>" --participant "your-name" --real
```

The script prints the provider call id, reminds that the call cannot be
recalled, polls every 5s, and prints the structured intake with the call
summary. Answer your phone; the agent opens by identifying itself as a demo
in the chosen language; report a practice emergency; watch the JSON come
back.

## 5. After the demo

Nothing to clean up: single attempt, no schedules, no recurrence. The
idempotency key means a replay within the same hour cannot place a second
call.
