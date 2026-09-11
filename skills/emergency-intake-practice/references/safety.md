# Safety Notes

Safety properties of `emergency-intake-practice`, why each exists, and the
failure modes they prevent.

## Purpose boundary

The skill rehearses the conversation *around* an emergency call with
consenting participants. It never answers as, speaks for, or impersonates
the real emergency service, and never handles a real emergency — it
terminates those toward the real number.

**Failure mode prevented:** a person in a real emergency believing they have
reached the actual 112 service.

## Self-identification is spoken, first, in the participant's language

The task requires the agent to open by stating it is an AI demonstration and
NOT the real 112. Not in metadata, not in a text afterward — spoken, first.

**Failure mode prevented:** mistaken authority at the most vulnerable moment
of the call.

## Real-emergency escape hatch

If the participant indicates a real ongoing emergency, the agent must tell
them to hang up and dial the real emergency number immediately.

**Failure mode prevented:** a practice session delaying a genuine call for
help.

## Consent is explicit and named

`--participant` is required; the participant's name goes into the task text
itself. Preview mode (default) places no call. One call per run, no
auto-redial — missed calls return to the human operator.

**Failure mode prevented:** unsolicited or repeated AI calls to people who
did not ask to practice.

## Structured intake, honestly shaped

`urgency` and `caller_clarity` are enum-locked with `unknown`; phrase fields
are free-form. The agent's assessment is captured as data — the skill's
README explicitly tells integrators to treat it as input to local rules,
never as a verdict (and those rules should be escalate-only).

**Failure mode prevented:** a guessed location or urgency flowing downstream
as fact.

## Bounded side effects

One call per invocation, capped at three minutes by the task text, stable
`Idempotency-Key` per participant-hour, no scheduling inside the skill
(host scheduler owns recurring drills).

**Failure mode prevented:** runaway redial loops and duplicate practice
calls on client timeouts.
