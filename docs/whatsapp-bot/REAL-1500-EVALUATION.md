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
behind-the-scenes wording within the conversation. Neither correction has
been counted as live-verified yet.
