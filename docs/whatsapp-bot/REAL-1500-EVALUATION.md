# Real Gemini conversation evaluation

## Current evidence snapshot — 28 October 2026

Release `1562c65` fixed the earlier tourist luggage/seat reply and damage
driving reply, but both adaptive conversations found later failures. In
`evidence/adaptive-tourist-rental-3.json`, the bot retained Ben Gurion pickup
and Tel Aviv return but asked for both locations again. In
`evidence/adaptive-accident-service-3.json`, it ignored a payment/liability
question after a scratch and returned generic safety text. Both chats stopped
at the failure. Source and exact regressions now address these turns; live
replay is required. No complete adaptive customer conversation has passed.

The damage replay on `480a834` failed at its third customer turn: “בדרך לצפון”
was treated as a recorded location and a direct question about continuing to
drive went unanswered. Its complete three-turn failure is in
`evidence/adaptive-accident-service-2.json`. The source and regression now
answer the driving question before location handling and exclude this vague
direction from the location matcher. This is not a successful chat; production
replay remains required.

On release `480a834`, the adaptive tourist replay kept the three passengers in
its first answer but failed at turn two: after the customer supplied two medium
suitcases and asked about a stroller and child seat, it ignored the seat and
re-asked for people and bags. The full two-turn record is
`evidence/adaptive-tourist-rental-2.json`; this is a failed, incomplete chat.
The source correction has a regression but still needs production replay.
The damage replay in `evidence/adaptive-accident-service-2.json` has appropriate
first and second answers; it remains in progress and is not a complete pass.

Three open-ended customer-style chats on production `1a0abd0` are saved as
`evidence/adaptive-israeli-family-rental.json`,
`evidence/adaptive-tourist-rental-1.json`, and
`evidence/adaptive-accident-service-1.json`. The next customer turn in each was
chosen only after reading the actual bot answer. None is a complete success:
the tourist opening re-asked the already supplied passenger count, the family
chat saved a hypothetical compact as a choice, and the scratch report repeated
a booking-number demand instead of guiding the renter. These failures have
source and regression fixes awaiting production replay. The number of proven
successful full adaptive chats remains zero.

The ignored evidence JSONL files contain 85 distinct scripted scenario indexes (0–84)
with at least one complete production-simulator transcript: 79 indexes have a
Gemini reading and six have a service/safety transcript without Gemini. These
are spread over multiple releases; they are **not** final-release passes or
owner-approved conversations. The latest deployed release before the next
repair is `e3a7610`. The roadside breakdown replay on `2a951a6` was manually
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
and viewing questions; its replay and a used-car replay passed manual review
on `a16b4e6`. The following sale-price chat exposed a false claim that the
customer had already given a budget. Its repair passed an eight-turn live
replay on `73f8cda`. The accident and roadside-breakdown scenarios passed
manual review; a truncated breakdown network attempt was excluded. The next
cancellation chat still called urgent and callback follow-ups a booking change.
Its repair passed an eight-turn live replay on `24ddbb6`. The next family-rental
chat completed a simulated request, but manual review found an unsupported
luggage-fit promise and a Hebrew typo in the first Gemini reply. The first
repair replay on `a5a0050` still promised luggage fit in different words; the
broader repair passed an 11-turn live replay on `b9ba35f`. The next young-driver
rental completed a simulated request, but manual review found a date-change
policy answer asking for pickup before dates were provided. Its repair passed
an 11-turn live replay on `94ea010`; a following seven-seat rental also
completed. The next vehicle-correction chat repeated the driver-age question
after the customer asked to finish the request. Its ten-turn replay passed on
`0604432`. The next rental budget chat ignored a request for a detailed quote
and repeated the pickup-date question. Its 11-turn replay passed on `5439d43`.
A same-location rental then repeated the driver-age question after the customer
asked to proceed. Its 11-turn replay passed on `683ac1d`; a following vehicle
correction also completed. The next family rental repeated the pickup-date
question after the customer restated intent. Its 11-turn Gemini replay passed
on `b75746e`. The next English rental completed a simulated request, but its
fourth turn ignored “Can I add another driver?” and repeated the pickup-date
question. Its 11-turn Gemini replay passed on `602c3d2`; three advice chats
also completed. In the last advice chat, a repeated insurance question received
the identical paragraph a second time after other trip details. The new
shorter follow-up response passed a nine-turn Gemini replay on `bf6bb96`.
Ten more advice, leasing and purchase chats completed and were manually
reviewed. The latest undecided-purchase chat falsely claimed the customer had
chosen a vehicle type while explaining the quote and after receiving a budget.
The corrected choice tracking passed a nine-turn Gemini replay on `21e4991`.
Manual review found awkward grammar in its optional-budget quote response;
the source wording correction passed a nine-turn production replay on `e3a7610`.
Three service scripts then completed. The first adaptive customer-style turn,
stored separately in `evidence/adaptive-rental-family-1.json`, immediately
exposed a real failure: the customer said the dates were undecided while asking
for a family-car recommendation, and the bot pressed for dates. The source
repair and exact-message regression need a live replay. Scripted transcripts
are diagnostic evidence, not proof of a successful open-ended customer chat. No
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
