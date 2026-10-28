# Real Gemini conversation evaluation

## Current evidence snapshot — 28 October 2026

The ignored evidence JSONL files contain 54 distinct scenario indexes (0–53)
with at least one complete production-simulator transcript: 50 indexes have a
Gemini reading and four have a service/safety transcript without Gemini. These
are spread over multiple releases; they are **not** 53 final-release passes or
54 owner-approved conversations. The latest deployed release before the next
repair is `aee4d99`. The roadside breakdown replay on `2a951a6` was manually
reviewed and passed after one truncated network attempt, which is not counted. Its next
15-turn rental chat exposed a one-week-versus-seven-week date inconsistency.
The repair passed a 15-turn Gemini replay on release `65f0704`. A following
family chat also completed a simulated request, but manual review found a
repeated date-change policy answer after the customer supplied dates. That
repair passed an 11-turn Gemini replay on `f3ca181`; a later direct rental
chat exposed a separate repeated age question after a date-change side
question. That repair passed a 9-turn Gemini replay on `d6f6d3c`. The latest
leasing chat exposed repeated and generic answers; its repair passed an
eight-turn Gemini replay on `1b316d7`. The next business-leasing chat exposed
a false claim that mileage and vehicle preference had already been supplied;
its source repair passed an eight-turn Gemini replay on `2a1c8ea`, and the
Hebrew wording correction passed on `a5f1622`. The following leasing-to-rental
chat exposed an unclarified one-month-versus-ten-day date conflict; its source
repair passed an 11-turn production Gemini replay on `aee4d99`. The next
family-purchase chat exposed repeated year/mileage intake after quote-process
and viewing questions; the source repair still needs production replay. No
1,500-conversation claim or readiness claim is supported.


The owner requested 1,500 long conversations following failures in his own
15 varied demo chats. The earlier 250 conversation core tests are simulated
state tests. They do not count toward this target.

`scripts/whatsapp/live-1500-eval.mjs` calls the published
`/api/whatsapp/simulator` endpoint with separate fictional sessions, preserves
state between turns, and writes each full transcript to
`evidence/whatsapp-live-1500.jsonl` (ignored by Git). The simulator uses the
production Gemini model but sends no WhatsApp message and creates no real
rental request. The script runs at most 180 turns per hour under the demo's
200-turn visitor limit and resumes from completed case indexes for the same
source release. Do not spoof
an IP or disable the public rate limit to increase throughput.

Run from the canonical repository checkout with:

```sh
SMARTCAR_EVAL_MAX_CASES=1500 node scripts/whatsapp/live-1500-eval.mjs
```

For a small review batch, set `SMARTCAR_EVAL_MAX_CASES` to the desired total
index. Set `SMARTCAR_EVAL_RELEASE` to the verified deployed commit and
`SMARTCAR_EVAL_MAX_TURNS` to bound hourly batches. Preserve the JSONL file
between runs. A flagged case stops the run for review and will be retried;
HTTP 429 stops the batch until the public limit resets. Count a conversation as provider
tested only if it has a successful HTTP transcript, at least one `model`
reading, at least eight customer turns, and an end state relevant to its goal.
Safety and existing-service flows can intentionally use the deterministic
emergency path without a Gemini reading; count them separately as real
production-core conversations and inspect their instructions closely.
Automatically flagged issues require transcript review; the absence of a flag
is **not** a pass for tone, truthfulness or a sensible sales conversation.
Manual review must cover failures and a meaningful sample of completed cases,
including rental advice, booking, leasing, purchase, accidents and service.
Stop and repair systemic failures before continuing volume runs.

The runner now covers 44 scenario archetypes and varies their locations,
dates and side questions. This improves breadth but is still scripted; 1,500
variants alone do not prove performance on arbitrary free-form customer turns.
Run adaptive free-form customer turns and manual owner review before treating
the volume target as evidence of readiness. The production WhatsApp connection remains
off until the owner accepts real transcripts and transport checks.

On 27 October a local direct-provider attempt using Vercel-injected
credentials returned HTTP 401; its fallback responses were **not** counted as
Gemini tests. The production simulator is the verified provider path.

The first new long production conversation completed 16 customer turns with
9 Gemini readings and reached an isolated rental request. Manual review found
that “יש אפשרות להוסיף נהג?” received a vague counter-question. A direct
answer based on the published driver terms was added, plus a conversation
regression. That first transcript remains in the JSONL file. Its automated
`internal_language` flag came only from the demo's required final simulation
notice; the flagger now excludes that notice while continuing to flag
behind-the-scenes wording within the conversation. The response fix was
subsequently checked live; the flagger is a local evaluation aid.

The direct additional-driver answer was then verified on the production
domain in a two-turn real-Gemini consultation. Five further full conversations
completed 59 customer turns and 33 Gemini readings. All five reached their
simulated rental request, but manual review found a verbatim repeated answer
after “מה תציעו לי?”, repeated age prompts after side questions, and an
unsupported claim that a compact trip would be fuel efficient. The next
source change moves vague advice to passengers/bags, suppresses a recently
asked booking question after a policy answer, acknowledges a later vehicle
choice, and rejects unsupported fuel-efficiency wording from model replies.
Those changes still require live re-verification after deployment.

As of this entry, only six new long conversations have actually completed;
the 1,500 target is not met. Transcripts from earlier releases cannot be
treated as a final-version readiness pass.

After release `c8ed196`, six full rental replays (75 turns) had no automatic
repeat flag. Manual review still found that a compact-car advice question was
misclassified as policy and answered vaguely. Seven more production chats
expanded coverage to leasing, purchase and accidents. Leasing repeated its
inclusions text, treated a next-step question as consent to hand off, then
ignored a payment question after handoff. Purchase repeated the same options
question and did not answer what its service includes. The accident branch
repeated a generic safety line instead of giving next steps or a preparation
list. Those are actual failures despite reaching a simulated endpoint. The
source now has focused fixes and regression cases; they need production replay.
The cumulative first-pass count is 13 distinct long conversations, plus six
separate replays, not 1,500 final-version passes.

The commercial and accident fixes in release `c90a596` were replayed in six
long chats on production: two leasing, three purchase, one accident. Their
full transcripts show that the repeated leasing inclusions answer changed,
next-step questions did not trigger handoff, purchase process questions were
answered, and the accident follow-up gave concrete instructions. Two final
first-pass chats then exposed new service errors: a breakdown was given
accident-report instructions, and a cancellation follow-up was labelled a
booking change. The source now stores the safety incident type and keeps
cancellation wording through follow-up turns; this version still needs a live
replay. The first-pass collection has 15 long chats, with earlier-release
failures retained as evidence, plus 12 separate replays. It is not a readiness
pass for the latest source.
