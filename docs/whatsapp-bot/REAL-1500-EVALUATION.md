# Real Gemini conversation evaluation

The owner requested 1,500 long conversations following failures in his own
15 varied demo chats. The earlier 250 conversation core tests are simulated
state tests. They do not count toward this target.

`scripts/whatsapp/live-1500-eval.mjs` calls the published
`/api/whatsapp/simulator` endpoint with separate fictional sessions, preserves
state between turns, and writes each full transcript to
`evidence/whatsapp-live-1500.jsonl` (ignored by Git). The simulator uses the
production Gemini model but sends no WhatsApp message and creates no real
rental request. The script runs at most 180 turns per hour under the demo's
200-turn visitor limit and resumes from completed case indexes. Do not spoof
an IP or disable the public rate limit to increase throughput.

Run from the canonical repository checkout with:

```sh
SMARTCAR_EVAL_MAX_CASES=1500 node scripts/whatsapp/live-1500-eval.mjs
```

For a small review batch, set `SMARTCAR_EVAL_MAX_CASES` to the desired total
index. Preserve the JSONL file between runs. Count a conversation as provider
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

The runner currently varies 15 scenario archetypes. Repeating their details
does not give 1,500 independent conversation patterns. Broaden the scenario
catalogue and run adaptive free-form customer turns before treating the volume
target as evidence of readiness. The production WhatsApp connection remains
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
