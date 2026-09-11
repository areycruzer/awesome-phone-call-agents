# Examples

Worked examples for `emergency-intake-practice`. Every phone number below is
fictional and masked per repository policy.

## Example 1 - The ordinary practice call

**Command (preview):**

```bash
node scripts/practice.mjs --phone "+919999XXXXXX" --participant "ravi"
```

**Result returned (`--real`):**

```json
{
  "emergency_type": "breathing emergency",
  "location": "Shalimar Bagh B-block, Delhi",
  "urgency": "critical",
  "caller_clarity": "partial"
}
```

The participant rehearsed reporting; the tool captured exactly what an
intake system would have to work with — including that clarity was partial.

## Example 2 - The unclear caller, which stays honest

A nervous participant mumbled; the agent could not establish the location.

```json
{
  "emergency_type": "unknown pain",
  "location": "unknown",
  "urgency": "medium",
  "caller_clarity": "unclear"
}
```

`unknown` is not retried silently. The result returns to the operator, who
decides whether to run another practice call — and `caller_clarity: unclear`
is itself the training signal.

## Example 3 - The refusal that guards consent

A cron job invokes the script with no `--participant`. The script exits
non-zero with usage. No call is placed — practice calls go to named,
consenting participants only.

## Example 4 - The real emergency, escaped correctly

Mid-practice, the participant says "no wait, this is real — my father is on
the floor." The agent, per its instructions, tells them to hang up and dial
the real emergency number 112 immediately, ends the call, and returns:

```json
{
  "emergency_type": "possible real emergency - call ended per safety rule",
  "location": "unknown",
  "urgency": "critical",
  "caller_clarity": "n/a"
}
```

The operator sees what happened; nobody pretended to be the real service.
