# SmartCar — Handbook for AI agents (Claude, Codex, any tool)

2026-10-27 — The accident safety chat passed a 10-turn production replay on release `442a7e7` with zero Gemini readings, counted separately from provider chats. The next breakdown chat reached handoff but manual review found that “צריך עזרה” and the supplied location “אני בתל אביב ליד התחנה” both received the same generic safety line. The safety handoff now directs an immediate help request to the office and recognizes a location phrased as “אני ב…” or “אני ליד…”. Full-turn regression added; live replay remains required.

2026-10-27 — The cancellation chat passed a 10-turn production replay on release `4d172ae` after manual review. The next accident chat (service safety path, zero Gemini readings) exposed two repeats: “אין נפגעים ואני במקום בטוח” was misread as an injury alert and repeated the initial warning, and an immediate repeat of “מה הצעד הבא?” repeated the full instructions verbatim. Negated injury language now preserves the existing safety handoff, and a repeated next-step question gets a shorter action summary. Full-turn regression added; live replay remains required. Safety chats count separately from Gemini conversations.

2026-10-27 — The cleanliness complaint passed a 10-turn production replay on release `638cdc8` after manual transcript review. The following cancellation chat exposed that the bot called cancellation a generic “change” when asked if it had taken effect, then repeated that line for a billing addition and representative timing. The handoff now states that cancellation remains unapproved, keeps a later charge question with the same enquiry, answers timing, and varies a repeated next-step answer. Full-turn regression added; production replay remains required.

2026-10-27 — The double-charge chat passed a 10-turn production replay on release `1cb5d5f` with manual transcript review. The next live cleanliness complaint repeated the same generic response to six different questions. The service handoff now gives specific next steps, explains that a representative will review the complaint without promising a remedy, requests optional photos, answers urgent and timing questions, and has a full-turn regression. Production replay remains required.

2026-10-27 — The production replay of the booking-change service chat passed manual review on release `0115cda`. The next live double-charge service chat exposed a new stall: after receiving the booking reference, the bot repeated one generic handoff message for next steps, preparation, proof, timing, and representative requests. The billing handoff now answers those questions separately, keeps the booking reference, avoids requesting full card numbers, and has a full-turn regression. Production replay of this billing fix remains required; customer WhatsApp remains off.

2026-10-27 — A live booking-change service chat repeated the same “request received, pending approval” message four times in response to next-step, preparation and approval questions. The handoff path now answers each question directly, remembers whether the booking reference was given, and keeps the existing return date in force until approval. A full service regression covers those turns; live replay remains required.

2026-10-27 — Manual review of the first clean undecided-purchase replay caught a semantic repeat: after asking for a budget, the bot answered “יש רכב זמין עכשיו?” by asking for the same budget again. It now explains that availability requires checking a specific car and offers to narrow options using a budget, without restating the question. Regression covers the follow-up; live replay remains required.

2026-10-27 — A live purchase chat with a customer undecided on vehicle type repeated the exact type question three times, ignored “מה אתה מציע למשפחה?”, and kept asking for a type after the budget was supplied. The sale flow now accepts uncertainty, recommends a family group conditionally for family use, moves to budget or representative help, and acknowledges a later explicit type choice. The full conversation is a regression; live replay remains required.

2026-10-27 — Manual review of the apparently clean SUV sale replay found that “תעבירו את הבקשה” was ignored after a test-drive question; only the later “תודה” caused handoff, hiding the failure from the final-state check. Direct requests to transfer the enquiry now hand off immediately. The regression includes the intervening test-drive turn, and the live evaluator checks handoff on the exact transfer turn. Live replay remains required.

2026-10-27 — Manual review of a live SUV purchase chat found that “אפשר לראות אותו?” received the generic year/mileage prompt, despite no specific car having been offered. The bot now explains that a matching car can be shown and a test drive arranged once an option is identified, subject to availability, and offers a representative follow-up. A regression covers the viewing request and sale handoff; live replay remains required.

2026-10-27 — A live used-car purchase chat repeated the same optional year/mileage question three times, even after the customer said low mileage mattered and asked for the next step. Purchase advice now retains that preference from the conversation, acknowledges it, answers “מה השלב הבא?” directly and avoids a verbatim repeat when service inclusions are asked again. A full regression covers the preference, next step and handoff; live replay is required.

2026-10-27 — Manual review of a live leasing price discussion found that an explicit “אפשר לקבל הצעה?” received yet another consent question after the bot had already offered to prepare one. The core now treats a direct proposal request as consent to pass the enquiry to a representative and acknowledges any later confirmation as already sent. Regression includes the post-handoff turn; production replay remains required.

2026-10-27 — The next live private-leasing chat was automatically marked clean but manual review found that “לא יודע איזה סוג רכב” triggered a rental-date response and “מה אתה ממליץ?” repeated the vehicle-type question. The commercial path now handles an undecided car group, compares compact and family starting points without promising a model, and makes the mileage next-step answer informative instead of repeating the same question. Rental-date uncertainty handling no longer overrides a leasing or sale conversation. The live evaluator now flags rental-date drift inside commercial chats; live replay remains required.

2026-10-27 — A live business-leasing chat failed to advance: “רכב פנאי” was ignored, the vehicle question was repeated, and “כן, תעבירו להצעה” led to rental-date questions rather than a leasing handoff. Leasing now recognizes the SUV preference and the proposal request, and retains the commercial route even if Gemini labels the follow-up as booking. A full regression covers the handoff; live replay is required.

2026-10-27 — Manual review of the first clean budget-advice replay caught a semantic repeat missed by the automatic detector: after recommending compact and asking about passengers and luggage, the bot answered “מה תציעו לי?” by asking the same questions again. It now gives the compact recommendation directly and makes further detail optional. The next clean leasing transcript repeated the vehicle-type request after “מה צריך בשביל להתקדם?”; it now explains the next step and offers representative help when the type is undecided. Regression testing then found that “אין לי העדפה, תעביר לנציג” did not hand off; that wording is now recognized. Both flows require live replay before acceptance.

2026-10-27 — A live budget-led advice chat exposed an unsupported “great fuel savings” claim, three generic repeats, an ignored price objection and a sales prompt after “אחשוב על זה”. Model fuel claims with intervening adjectives are now rejected, the budget consultation answers group choice and objections directly without inventing a quote, and the customer can close the chat without another question. The live runner flags this fuel claim on replay.

2026-10-27 — The next live one-day work-rental advice chat repeated date prompts after questions about compact fit, solo travel and one bag, emitted malformed Hebrew from Gemini, and asked for a date immediately after “אחזור עם תאריך”. The conversation core now answers those workday follow-ups from retained trip facts and closes politely until a date is known. A production replay remains required.

2026-10-27 — A production Gemini advice chat with five passengers and three bags repeated the same generic date prompt four times, then promised SUV comfort and asked whether the bags were large after the customer had already said so. The core now answers each luggage-fit follow-up directly, keeps large-bag size in the draft and request summary, and rejects model answers on these constrained capacity questions. A live replay is required before counting this version as repaired.

2026-10-27 — Manual review of the supposedly clean baby-and-bag advice transcript caught two missed end states: “אין לי עדיין תאריכים” was followed by another date demand, and “תודה, אעדכן כשאדע תאריכים” reopened sales. The bot now acknowledges that dates are undecided and closes politely when the customer says they will return later.

2026-10-27 — The live volume evaluator now flags an identical reply appearing three times anywhere in a chat, and checks English “I confirm” for an actually completed rental request. This closes two blind spots seen while manually reading English and advice transcripts; automatic flags remain triage, not proof of conversation quality.

2026-10-27 — A live solo-city advice transcript repeated date prompts instead of comparing compact and family cars, explaining parking, or answering an alternative request. It now addresses each question directly, keeps approximate “end of month” timing without demanding a date, and understands “אין תאריך סופי”. The public simulator reached its hourly limit during this transcript; no rate-limit workaround was used.

2026-10-27 — A live no-dates advice conversation repeated generic date prompts when a couple with a baby and a bag asked for a recommendation, an alternative and a child seat. The advice flow now retains the baby/seat need, gives distinct family and compact guidance, treats seat supply as subject to checking, and does not force dates to answer these questions.

2026-10-27 — The next live English replay completed a request but repeated the insurance answer verbatim, ignored a payment question, and repeated the age question after “I would like to make a request”. Booking now gives a concise second insurance explanation, answers payment terms without inventing amounts, and acknowledges the request while asking for the missing age. The regression runs the full chat including those detours.

2026-10-27 — A live English rental chat went straight to human handoff because “one person” was mistaken for a request to speak with a person. Human handoff now requires an actual request for a representative, short “Hi” opens in English, and labelled “Pickup 10/12 and return 14/12” dates are captured. A full English booking regression protects the route.

2026-10-27 — A live family request with child seat and a combined advice/insurance question stalled at vehicle selection because “רכב למשפחה” was never saved as a vehicle preference. The bot now retains that family preference, answers both parts of the question, and reaches the request summary without reasking for a vehicle that was already specified.

2026-10-27 — The live same-place replay still failed after a side insurance question: the bot lost the pending pickup city, stored “אותו מקום” literally as the return location, then treated a customer's name as the pickup city. It now recognizes a city answer against recent pickup prompts, resolves same-place returns only from a known pickup, and keeps the pickup question after listing branches. The regression includes the intervening side questions.

2026-10-27 — A live same-place rental chat showed two repeated questions: “מאיפה אפשר לאסוף?” was answered by asking the pickup city again, and “אני רוצה להתקדם” repeated the age question verbatim. The bot now gives the confirmed branch/delivery options, retains a clear pickup question for the next city answer, and acknowledges progress before requesting the one still-missing detail.

2026-10-27 — After replacing an unsafe seven-seat claim, the next live replay exposed identical replies to “אנחנו שישה עם שלוש מזוודות” and “צריך שבעה מקומות?”. A direct follow-up answer now acknowledges the recommendation already given, keeps luggage fit conditional and avoids repeating the same prompt.

2026-10-27 — The live seven-seat replay used a second wording to promise that all passengers and bags would fit. When the customer supplies both passenger and luggage counts, the visible answer now uses the capacity-aware core response, which keeps fit subject to a specific model. The live evaluator also flags broader fit guarantees.

2026-10-27 — Manual review of a long seven-seat conversation found an unsupported promise that all passengers and luggage would fit comfortably, despite automatic checks marking the chat clean. Model replies making this claim are now rejected and the live runner flags it for review. Capacity remains subject to the specific car and luggage.

2026-10-27 — A live young-driver replay exposed the age group being followed by an identical repeated name question. Booking now acknowledges the recorded age and moves to the name; the full request regression covers this turn.

2026-10-27 — A broader production replay found another rental stall: “אני רוצה לשלוח בקשה” was treated as advice despite collected dates and pickup details. The intake now recognizes this explicit request, “אני רוצה לסיים את הבקשה”, and the English equivalent, with a young-driver end-to-end regression. The 1,500-chat target remains open; WhatsApp customer delivery remains off.

2026-10-27 — The owner raised the live conversation target to 1,500 after
finding failures in 15 different manual chats. Added a rate-compliant,
resumable production-simulator runner and an evidence protocol in
`docs/whatsapp-bot/REAL-1500-EVALUATION.md`. Only successful real Gemini
readings count; synthetic core tests and a failed local provider attempt do
not. The script preserves full fictional transcripts for review and has no
customer WhatsApp transport or database rental write. The 1,500 target is in
progress, not a readiness claim. Keep the real customer bot off.
The first new 16-turn live dialogue exposed a vague answer to "אפשר להוסיף
נהג?". The published driver terms now supply a direct answer, with a regression
test; live re-verification follows deployment.
Five further full production-Gemini rental dialogues found a repeated answer
to "מה תציעו לי?", unnecessary repeated age prompts after side questions,
and an unsupported fuel-savings claim in a model reply. The conversation core
now gathers trip needs, acknowledges a changed vehicle, and filters that
claim; regression checks pass. These fixes need a new release and live replay.
Further live leasing, purchase and accident chats exposed repeated commercial
questions, a next-step question incorrectly treated as handoff consent, no
answer to payment after handoff, and generic accident follow-ups. The core now
answers those questions, waits for an explicit handoff request, and gives
concrete accident reporting steps based on the published terms. Service and
safety flows may correctly use local deterministic logic without Gemini.
There are 13 first-pass long chats and six separate replays so far; neither
number is the 1,500 final-version acceptance target.
Six further leasing, purchase and accident replays on release `c90a596` show
the commercial corrections working. The final two first-pass service chats
found that breakdown next steps falsely mentioned an accident report and a
cancellation follow-up was mislabelled as a change. Incident kind is now
stored (with a history fallback for existing state), and cancellation context
is preserved in follow-up answers. Regression tests pass. Current evidence:
15 first-pass long chats and 12 replays across changing versions, not 1,500
acceptance chats on a final release.
The service follow-ups were rechecked in three long production transcripts on
release `1b00461`: accident, breakdown and cancellation now stay distinct.
The long-chat runner was expanded to 44 scenario archetypes and now records
the deployed release, stops on a flagged transcript or the public rate limit,
and resumes only clean cases from the same release. Scripted volume still
requires manual free-form review; no 1,500 final-version result exists yet.

2026-10-26 — Added a repeatable 250-dialogue rehearsal covering 50 rental
requests, 50 advice-to-rental conversations, 50 leasing enquiries, 50 sale
enquiries, and 50 service/roadside cases. The scenarios run against the actual
conversation core with isolated in-memory state and simulated request/handoff
outputs. Rental dates, locations, and age groups vary across cases. The first
run exposed a real service-routing gap: “הרכב ששכרתי מלוכלך” did not reach a
representative. It now does. These tests do not connect YCloud or prove
customer delivery; see `docs/whatsapp-bot/250-DIALOGUE-REHEARSAL-2026-10-26.md`.

Owner's later phone screenshots exposed a blind spot in the first 250 cases:
open-ended solo-traveller advice with dates and pickup/return supplied before
booking consent. The live Gemini simulator reproduced the loop. The core now
keeps those facts in consultation, recommends a compact car for one traveller,
parses a same-city pickup/return sentence, answers repeat recommendations and
uncertainty without asking the same question, explains that a car is not yet
confirmed, and starts the saved request only after an explicit yes. The exact
phone sequence plus model/local paths are regression tests. A roadside tow
follow-up also now gives a specific instruction instead of repeating the prior
safety line. This entry supersedes any assumption that the 250 scenarios alone
prove unrestricted conversation quality.

2026-10-27 — Ran 15 separate conversations (122 turns) through the public
production simulator with real Gemini enabled; 60 turns returned a Gemini
reading. Manual transcript review found further customer-visible failures:
repeated sales questions, a leasing answer that skipped what is included,
a rental correction parsed as a pickup city, a known luggage count asked again,
an unanswered compact-car advice question, and generic handoff replies to a
billing complaint or roadside location. These paths now have targeted fixes and
regressions. The 15 scenarios reached their simulated actions, but that is
not sufficient to activate the customer bot; the corrected version still
needs live replay and owner acceptance.

The first corrected production replay covered eight of those sessions (66
turns, 30 Gemini readings). It confirmed most targeted fixes, but Gemini still
asked for the pickup point after both locations were supplied, a leasing pivot
hard-coded the wrong duration, and a sale price reply repeated the prior
budget question. Those were corrected next; do not call the bot ready from the
replay's completed simulated requests.

2026-10-26 — Additional production simulator dialogues found five concrete
conversation defects: an unsupported seven-seat fit claim for five people and
three bags, an explicit pickup/return sentence overwritten as the pickup
city, a leasing "כן, תתקדמו" loop, repeated sale-preference copy after
"מה יש לכם?", and generic repeats after a service booking reference or
callback-time question. The core now retains clearly stated passenger/bag
counts, rejects the unsupported model fit claim, parses both named cities,
uses those needs when preparing a rental request, advances the leasing and
sale handoffs, and acknowledges service details without promising a fixed
callback time. Observed full-conversation regressions were added. Customer
WhatsApp transport remains OFF.

The owner's subsequent "nothing advances" report led to a broader approval
audit. Natural short approvals such as "כן, תתקדמו", "כן תודה" and "סבבה"
now advance the relevant rental or commercial path; a personal leasing-offer
reply is treated as an actionable offer. This remains scoped to an explicit
offer or intake question and does not treat corrections such as "כן אבל..."
as unconditional consent.

Post-deploy real-model rehearsal still produced an overconfident SUV fit
claim for five passengers and three bags. Vehicle-fit advice that depends on
passenger/bag counts now uses a qualified local answer, stating that luggage
space must be checked for the actual model and bag sizes. The customer facts
remain in the rental draft and the request continues through consent.

Another live progression audit showed "רוצה לשכור" and "I need a rental car"
staying in consultation even after dates, locations and age, because the
booking-intent boundary missed those natural phrasings. They now enter the
persisted rental request. English number words for passengers and bags are
captured. When a customer cannot give dates yet, the bot pauses instead of
repeating the pickup-date question. A customer asking to cancel an existing
booking now moves from policy explanation to collecting the reference and a
human review; it never claims to have cancelled the booking itself.

The WhatsApp rental request table previously required pickup/return TIME and
the bot inserted 09:00 for both, despite never asking the customer for a
time. A schema migration makes those request fields nullable and the bot
omits them. The separate trip-needs note still says times need coordination;
existing rows are unchanged. Request summaries also show stated passenger
and bag counts, and generic AI vehicle wording cannot replace those needs.
Live production verification then found that a natural “12/11 עד 16/11”
range was missed and a standalone “24+” could be interpreted as 24 November.
The conversation core now accepts that range and rejects age-only date fields.
The rental email question now asks for a contact address; it no longer promises
an emailed request summary because that send is not part of this intake path.

A further 12-dialogue production simulator matrix exposed three remaining
progression failures: “אני צריך רכב קטן מ-15/11 עד 18/11” stayed in advice,
a complete request lost the return city when a driver-age clause followed it,
and an approximate date after “I don't know the dates yet” fell back to
free-form advice. The core now treats the natural need as a rental draft,
parses date ranges prefixed by מ־, stops city extraction before age details,
and retains approximate timing after a pause. Consent and customer-facing
wording remain unchanged.

A 15-topic production dialogue audit then found customer questions that
received an unrelated generic answer: seven seats with four bags, foreign
licence, home delivery, a young driver's eligibility together with price,
and electric-car charging. These now use the relevant published facts or a
qualified answer. Direct requests for a test drive, travel outside Israel,
or paid passenger transport are passed to a representative without implying
availability, legal eligibility, insurance coverage or a confirmed booking.
Live retest caught one more extraction error: a request for seven seats was
mistaken for a statement that seven passengers would travel. Seat count is now
kept as a vehicle requirement; passenger counts require explicit passenger
wording and a matching number in the customer's evidence. The advice explains
that luggage fit must be checked with the actual seating configuration.
Longer live dialogues also showed a repeated age-group prompt after an
ineligible 20-year-old asked for clarification, and a repeated date prompt
after the customer acknowledged that dates were still unknown. The bot now
explains the age condition in plain customer language and pauses the date
intake until an actual date is supplied.
A final advice-language probe found that a generic family trip could be
treated as the customer's selection of a family car and receive an
overconfident SUV recommendation. A family trip now remains an advice need;
the bot suggests a vehicle group cautiously and does not write a selected
vehicle into the request without an actual choice.

2026-10-26 — Live user demo showed approximate dates ("מעוד שבוע", "עוד
חודש") being acknowledged as if exact, followed by location questions and a
return to the missing pickup date. The conversation core now retains that
approximate timing as a preference, asks once for exact pickup and return
dates, and waits if the answer is still approximate. It does not advance to
locations or create a rental request from an unconfirmed calendar date.

2026-10-26 — Live browser review found the simulator's fixed first bubble still
listed service categories before the customer spoke. It now opens with a short,
human greeting. A synchronous in-flight guard prevents two near-simultaneous
submit events from adding duplicate turns while the request is pending. The
simulator remains isolated from customer WhatsApp.

2026-10-26 — Owner's production demo showed that “אני רוצה רכב פנאי”
could remain in free-form advice after the bot asked for rental dates. Short
answers then had no request state, repeated questions and never reached
confirmation. A direct vehicle request followed by a rental-date prompt now
starts the persisted draft; a pre-existing free-form date prompt also resumes
that draft when the customer's next answer confirms or gives a date. During
consultation, explicitly stated vehicle type, dates, locations, passenger
needs and driver age remain in the draft and are reused when the customer
asks to proceed. Full guided-request and consultation-to-booking regressions
cover this behavior. No customer WhatsApp activation.

2026-10-26 — Owner's WhatsApp demo exposed customer replies that described
internal limitations and assumed the customer had seen the website. Rewrote
price/availability, sales, leasing, test-drive, service, safety and advice
copy to speak directly to the customer, while keeping essential conditions
for final price, stock, booking changes and appointments. Gemini's prompt
and reply gate now reject internal-process phrasing. Numeric short date ranges
such as `15/11-26/11` are retained in the rental draft. Added regressions
for the exact website-price and internal-wording failures. The isolated demo
remains a rehearsal; customer WhatsApp transport remains OFF.

The live production rehearsal additionally found a model-derived English
`suv` in a Hebrew request summary. Vehicle categories extracted by Gemini
are now normalized from the customer's explicit wording, and a short vehicle
choice during intake receives an acknowledgement before the next question.

Eight additional live production-demo scenarios revealed repeat questions
after a sale customer had already given car type and budget, an awkward
leasing-price answer, and a direct test-drive request left in open advice.
Sale availability now asks only for missing preferences or offers a
representative follow-up; a simple yes to that offer advances it. Leasing
price copy is customer-facing, and direct test-drive requests enter the sales
handoff path with appointment confirmation still pending. Child-seat advice
was tightened to avoid implying a particular model's fit.

2026-10-26 — A broader live dialogue probe reproduced the owner's repeated
"כן" loop across SUV, family, compact, weekend, price and availability
conversations. The model could ask for rental dates while the application
remained in open advice. Affirming a rental-date question now enters a
persisted, reversible request draft; repeated affirmations receive a clear
example of the needed date, then a pause instead of another model question.
Gemini is skipped for these control replies. Vague phrases such as "next
week" cannot be converted by the model into a fabricated exact date. The
same probe found missing routing for "איך מבטלים", "אני בן 22" and "לא
התניע"; cancellation and age now use the approved knowledge answer, and a
rented car that will not start enters urgent safety handoff. Discount and
installment questions receive direct customer-facing answers.

The post-release live loop probe also showed unsupported model claims of
fuel savings and an arbitrary compact-car recommendation for a generic
weekend request. The reply gate now rejects these claims and only accepts a
specific vehicle direction when the customer has provided a vehicle or a
concrete passenger, luggage or trip need; a generic weekend request receives
a neutral SmartCar response and the next useful date question.

The rental confirmation summary now presents dates in the customer's local
day/month/year form, one detail per line, and frames the unchanged canonical
terms-consent sentence as a statement for the customer to approve. It still
displays that exact sentence, preserves its consent hash and requires the
customer's explicit "אני מאשר" before creating a request. The summary says
SmartCar must confirm the request; it does not imply a booked car.

A further customer-language audit removed remaining internal team wording
from leasing and sale follow-ups and raw booking-status wording from service
replies. The Gemini reply gate also rejects references to a model,
simulation, or internal checks in customer-facing drafts. These are
customer-copy changes; routing and the WhatsApp kill switch are unchanged.

2026-10-26 — Owner preferred a human-sounding representative without
voluntary bot disclosure and asked for a name. The visible identity remains
the existing SmartCar brand. Gemini is instructed not to volunteer bot/AI or
invent an employee identity; the reply gate rejects such unsolicited claims.
If a customer asks the name, the reply is SmartCar. If asked directly whether
it is a bot/person, the assistant answers truthfully as SmartCar's digital
assistant and can offer a human representative.

2026-10-25 — Booking requests collect only the main driver's selected age group:
21–23 or 24+ (age 24 is in 24+). It is stored in `bookings.driver_age_range`;
the admin booking sheet shows that group. No birth date is requested or stored
for public bookings. Existing bookings remain unchanged and show “לא צוין”.

2026-10-25 — Owner authorised a conversation-core rebuild after repeated
real-model sales and service failures. In the canonical production-source
checkout, a new v2 core and compact, fixed-model Gemini interpretation
boundary now power the isolated simulator and the webhook in the unpublished
bot branch. The contract is recorded in
`docs/whatsapp-bot/REBUILD-CONTRACT.md`: application code owns consent, state,
safety and business actions; Gemini reads redacted recent turns and returns
intent, a short draft and customer-evidenced facts. Local consultation covers
outside-option and child-seat cases without repeating those options or
claiming fit. Webhook signature checks, message logging, human silence and the
transport kill switch remain in place. Focused and full tests, type checking
and exact-source preflight pass. Initial real-model dialogues exposed date
redaction, incomplete price answers and an incorrect luggage-to-vehicle field;
the fixes are under repeat evaluation. Rental requests now use a persisted
draft key and a unique database index to prevent retry duplicates. The bot
switch is OFF. This is not a customer
launch or a model switch.

2026-10-25 — Owner-authorized live data-only price update: Hyundai Kona and
Seat Arona base/day and minimum_daily_price are now280ILS; Hyundai i20 base/day
and minimum_daily_price are260ILS. All3records per model(9total) updated from250
with guarded predicates; display overrides remain null. Existing seasonal
rules remain in place and the booking floor also caps duration/coupon discounts.
Verified all9records through production /api/vehicles and a separate grouped
database read. No deployment, booking changes or other vehicle writes.

2026-10-25 owner correction: sales guidance must help choose a suitable SmartCar
rental, not proactively recommend taxis/public transport/competitors. Updated
charter, academy, final coaching and deterministic fallback together, removing
the contradictory taxi suggestion example. Owner clarified absolutely no taxi comparisons, including on explicit customer
request. Explain relevant SmartCar rental value and verified terms instead;
respect refusal and keep consultation separate from booking consent. Do not
announce the internal sales rule to customers or add unstated equipment. Same-model
validation rejects taxi comparison/recommendation content instead of returning a scripted sale.

2026-10-25 — Actual Gemini candidate6a4f173 responds using3.5FlashLite.
Family and business follow-ups preserved correction/language without handoff,
but initial advice overgeneralised taxi cost and monthly exit flexibility;
final coaching now explicitly separates security from travel spend and requires
child-seat arrangements/written exit terms before recommending alternatives.
Concrete count/duration corrections were intercepted as empty form edits; parser
now lets these adviser-managed facts reach Gemini. Real-model retest required.
Private comparison exposed a pre-model Hebrew substring bug: תקרת (ceiling)
matched תקר (puncture), creating a false emergency. Puncture matching now uses
word boundaries; regression retains a real roadside puncture route.
Latest real3.5 retest corrected count/duration and ceiling routing, but initial
family advice still omitted child-seat arrangements when discussing taxis.
Bounded same-model validation now rejects that narrow incomplete answer when a
baby is explicitly in the current message; one regeneration uses the existing
remaining budget, with no provider/action/send retry. Real retest remains needed.
Candidate gallery/X2/public pages passed; no domain promotion or readiness claim.

2026-10-24 — Unpublished backup-advice follow-up on separate full worktree:
explicit rental exploration now receives family cost/child-seat or visitor
licence/document/payment checks without an appended booking-date question.
Category and supplier eligibility are not guaranteed; no inventory/link added.
Annual consultation retains its facts but yields actual duplicate-charge disputes
to the existing account-review gate. Declined budget receives comparison criteria.
These are bounded deterministic fallbacks, not human-level general understanding.
Local full-controller regressions cover both exploration examples and a charge
interrupting annual advice. Follow-up checks exposed own-child-seat and deposit/excess questions being
overridden by policy/intake text. Added direct qualified comparisons and a
backup research-phase flag: short acknowledgements do not start booking; explicit
request preparation clears it. Safety/person/actual-charge gates stay ahead.
Full-controller regression verifies research → yes → explicit preparation.
Broader multi-turn exploration readiness remains to complete;
no publication, live transport or actual Gemini verification is implied.

2026-10-24 — Google lead-sheet diagnosis:69working keys(62rental/7contact),
all7stored contacts present, rentals through October24 present. Two booking keys
were intentionally absent with deletion-ledger entries; four leasing requests
were flagged internal by the unchanged sheet name filter. No evidence of lost
stored customer leads in this reconciliation. Apps Script executions succeed
every5minutes; one transient failure recovered on the next run. Visible A2
summary was frozen at October19/65 and new rows appended below old history.
Script update refreshes only the generated summary, inserts whole new rows at
top, preserves filters/manual columns/deletion ledger, and sorts complete old
rows once. Bound-script installation and fresh live verification required.

2026-10-24 — Lead-inbox follow-up: private admin feed now includes all four
intake sources without the name-based housekeeping filter used by Sheets.
Internal/test names are labelled rather than hidden; unnamed enquiries remain
visible. Existing sheet filtering/deletion ledger and follow-up permissions stay
intact. Dashboard contact tile and inbox share15s polling, background updates
and focus/reconnect recovery. Unanswered contact messages appear first, with a
clearly labelled contact queue. Failed public contact submissions remount the
single-use challenge so retry can work without discarding entered details.
Diagnosis:71filtered live enquiries included rentals from October24; all7stored
contact enquiries were visible, newest October14Israel time. This is not proof
of lost contact submissions or a database outage. End-to-end verification must
check a fresh, clearly labelled temporary record without customer messaging.
SEO PR6/1d2ad32 is live and preserved; bot work resumes in its own full worktree,
with this chat retaining publication ownership until coordinated release.
Local gates:1246tests/92files, typecheck, lint budget(0errors/1existing warning)
passed. Intake integration verifies store-before-success, immediate private read,
all4sources/pagination, challenge/auth guards and source/storage error paths;
actual staged/live verification remains required before reporting publication.

2026-10-24 resumed bot work uses a separate full worktree based on published
1d2ad32, retaining all latest SEO/canonical/inventory work. Preserved bot fixes
f8b059c/0d47962 were integrated; main checkout and publication ownership stay with
the coordinating task. No domain promotion/merge or customer activation here.
Added a private owner-only Gemini3.8 comparison page/API, fixed model and12/hour
additional rehearsal limit (existing distributed-or-instance limiter semantics).
It shares the isolated simulator flow, caps payload256KB, reports token counts,
sets low thinking and suppresses false production-outage alerts from experiments.
Public model headers/default model and actual customer transport remain unchanged.
This is not a model upgrade or a passing real-model comparison yet. Current
configured customer model remains Gemini3.5FlashLite; evaluation must establish
quality, latency and cost before any proposed switch.
Wrong-language/invalid structured content may now receive one regeneration on the
same configured model, with fixed validation feedback and the remaining14s request
budget. Provider HTTP/network failures are not retried by this content-repair path;
no business action or WhatsApp send is repeated. Model reply-language validation
precedes the fallback that produced unrelated policy text in an observed English
correction. Actual candidate/live repair verification is still required.
Deterministic handoff/catalogue fallbacks and simulator labels no longer claim
staff notification, immediate takeover or a callback before those actions run.
They state the concrete need for review and retain action flags/context. This is
not a durable handoff implementation or proof that a person received an alert.
Local resumed-work gates: full1264tests/93files, typecheck and lint budget pass
(0errors/1existingwarning) before the final evaluation-alert-isolation regression.
Repeat focused/full gates as appropriate; real comparative calls and full
24-dialogue acceptance remain open, with no customer-readiness claim.
Rebased onto published71d4bb2 after the coordinating task's newer release;
all latest office, SEO and public-site changes are retained. Source preflight,
combined gates and build must be repeated on this exact baseline before review.

2026-10-24 — Owner approved preferred Google URLs for identical vehicle pages.
Conservative canonical grouping requires identical specifications, years, photos,
features, both descriptions, all prices/floors/deposits/mileage and capacity.
Stable oldest record (ID tie-break) is preferred in each language and sitemap;
undated discovery links follow it. Different offers stay independent. Every old
detail route and its original booking ID remain available; dated card links and
all booking calculations are unchanged. Public fleet errors fall back to self
canonical. Sitemap revalidates every60s so inventory changes do not wait for a
new deployment. This SEO-only branch is the sole publisher while bot work is paused.

2026-10-24 — Reviewed completed rental-discovery follow-up: undated server fleet
seed with60s public cache, existing SWR revalidation/recovery retained, URL category
applied and dates/both locations preserved. Dated pricing remains on the existing
client path. SEO-only baseline passed16new regressions and full1213tests/90files,
typecheck/lint budget pass; actual local172-row public-data fixture rendered45
HE/EN model links and3VAN links,360px filters/navigation passed. Real candidate
and custom-domain fleet/price checks are still required. No DB writes or pricing
logic changes. Details and fixture limits: docs/SEO-2026-10-23.md.

Latest verified live release: protected PR4/918c79c,
dpl_7bmf61t4zJJtxGpGGSkL1X4PCENV READY with both custom domains. Public catalogue
172/X2display850/base1060/floor950,3exact gallery samples and HE/EN pages passed.
Actual owner-page POST accepted the test notification; Gmail verified its arrival
in ido.goetha5@gmail.com's INBOX at2026-10-24T08:47:26Z (test category only,
no customer content). This verifies the current email path, not whole-host uptime
or durable incident retry. Customer WhatsApp remains OFF. Readiness gaps remain.

The owner requested SEO-only completion on October24. Unpublished bot commits
f8b059c/0d47962 and their full coaching notes remain preserved on
`codex/bot-recovery-followup-20261024`; they are not part of this scoped SEO branch.
Use the latest published `origin/clean-main` before resuming that bot work.

2026-10-24 follow-up after protected PR4 merge918c79c (production build pending
at this entry): actual candidate reviews exposed control parsing before Gemini
mistaking "correct that assumption" for vehicle preference editing and "correct
that:" for a generic field edit. Local parser now leaves explicit corrections
of the adviser's answer to Gemini; ordinary stored-fact edits remain supported.
Added exact bilingual regressions. Focused gates and rebuilt real model retests
remain required. No publication/complete-readiness claim for this follow-up.
Further independent budget/tourist turns found an unwanted pickup question during
comparison and over-simple cover/deposit definitions. Move the existing final
response contract after retrieved coaching examples and clarify these distinctions
there. Advice-correction parsing also recognises a corrected explanation, including
while a previous field edit is pending. Actual model retest remains necessary.
A live budget follow-up also exposed the legacy broad handoff regex treating a
hypothetical charge/deposit explanation as an actual account dispute during a
draft, despite Gemini's non-person intent. Advice corrections now preserve the
model answer; broad fallback handoff only applies without Gemini or with its
representative intent. Earlier fixed emergency, explicit-person and specific
actual-charge-dispute gates remain above this path. Exact regression added.

2026-10-24 — Reviewed delivery-page continuation from the SEO task: all13area
URLs/actions retained; arranged delivery distinguished from a real pickup branch,
unsupported nearest-branch label corrected, regional schema Place, restrained
bilingual metadata and planning links. PUBLIC-COPY.md records the owner's style
direction. Reported60focused tests/typecheck/lint and actual360px browser checks
on5HE/EN city/region pages passed; branch/monthly navigation worked. Combined
full-source gates and actual staged/public verification remain publication gates.
No prices, gallery assets, booking permissions or customer transport changed.

2026-10-24 — Staged1c0933e adaptive Gemini verification: scoped luggage forgetting
retained travelling-alone/no-charging facts; a later new two-suitcase detail was
accepted without reviving the old musical-instrument details. This follows a
seeded1021-entry archive, not1021real model turns. Complete-site staged catalogue,
X2 and three exact gallery samples plus public HE/EN pages passed. Not published.
Further original coaching addresses observed unsupported cargo-fit inference,
monthly early-exit generalisation and defensive responses to corrections. These
new instructions still need regression gates and actual candidate verification.
No model-weight training, production DB writes or customer transport activation.
The final adaptive recap exposed a controller error despite a correct Gemini
answer: the substring rent in current triggered the rental commercial classifier,
then a negated booking mention entered the legacy account fallback. Bound English
rental words and added the exact full-flow regression. Rebuild/live retest required.
Added an admin-only POST /api/admin/whatsapp/incident-test using the existing fixed
test category/configured recipient and15-minute provider idempotency. No recipient
or content can be supplied by callers; inbox-only/anonymous sessions cannot send.
It reports provider acceptance only; actual inbox receipt still requires checking.
Delivery incident subject now says unconfirmed rather than claiming non-delivery
when the provider outcome may be uncertain. No customer transport change.
The private owner page /he/admin/bot-alerts provides the test button and separates
provider acceptance from actual inbox receipt and from external uptime monitoring.
No public navigation, customer records or existing office actions were changed.

Latest verified production: protected PR3 merged as `1e5fab4`, deployment
`dpl_7Zt85r4NKhHqG2DaaS9bLYZhDpgy` READY on both domains. Public Gemini
retained Niro/25,000km/estimate-vs-budget and did not reset or hand off on a
negated instruction. Public326-page audit: zero HTTP/title/description/H1/
canonical/language/noindex issues; duplicate groups76 remain, not a ranking claim.
Public X2 schema price850/LeaseOut verified; catalogue172, base1060/floor950 kept.
Independent public image audit361 URLs all200/image, all172 cars at least4photos;
it is not a visual/identity audit. No error/fatal release logs in checked15minutes.
Priority recrawl requests accepted for Tel Aviv, monthly and Jerusalem; acceptance
is only a queue, not proof of new indexing/rank. Customer transport remains OFF.

Next local increment (`codex/bot-delivery-safety-20261023`): bounded8s provider
send; distinguish accepted/rejected/uncertain/not-sent without automatic retry;
missing provider reference is uncertain. Human-reply API preserves a positive
acceptance even if history write/incident email fails and warns against resend.
Actual local API/UI rehearsal used fake backend/provider, blocked external network,
and displayed the warning at360px (no overflow,44pxsend) while loading all1020
fictional archived messages interactively. No customer send/credentials/data used.
New bounded archive recall retrieves up to8 older customer quotes for Gemini,
excluding known contact values/collection steps and old bot claims. Unit fixture
finds a constraint before1020 later entries and keeps full state history. This is
selective retrieval, not proof of flawless recall of every fact or1020real turns.
Full1157 tests/typecheck/lint budget passed before final defensive input checks;
focused/full gates and actual staged Gemini recall still required. No DB migration.
Final local gates completed:1161 tests/87files, typecheck and lint budget pass
(0errors/1existing warning). Actual staged Gemini1020-history retrieval remains
the next gate; unit fixtures and mobile UI history are not substitutes for it.
Scoped forgetting now records per-field archive boundaries without retaining the
forgotten value; matching old quotes stay out of retrieval/recent context, while
later supplied facts can be used. Literal history redaction is case-insensitive.
"Forget everything about luggage" is scoped forgetting, not a full-chat reset.
This is a chat-memory control, not deletion of retained business/message records.
Final retrieval review: redaction now removes matching clauses rather than the
entire mixed quote, keeping an unrelated "cannot charge an electric car" constraint
when instrument/luggage details are forgotten. Unproven free-form summary is still
cleared on forgetting; surviving archive clauses can supply unrelated context.
Focused75 tests/typecheck passed after this refinement; repeat full gates.
Final refinement gates:1162 full tests/87files, typecheck, lint budget pass.
Actual staged Gemini on2c16f41 retrieved travel-alone/3musical-instruments/no
charging from the first entry of a seeded1021-entry archive, with those facts
absent from the supplied short summary. Returned history1023. This is one real
model turn after a seeded fixture, not1021real AI turns. Mixed-clause forget
refinement still requires rebuilt candidate and the following adaptive turns.

Further adaptive review caught negated "בלי להתחיל מחדש" executing reset and
"forget the seat discussion for now" being mistaken for record erasure. Control
parsing now scopes negation before reset and distinguishes a paused discussion.
General sales advice also no longer enters the catalogue merely because sale
context exists; active-booking, staff, safety and transaction gates stay above it.
Exact regressions added; rebuild and live retest required before follow-up merge.

Previous production progress: protected PR2 merged as `29fa24e`; Vercel
`dpl_7oTxkrA3iNMa7duCZzjGg3fYeoNz` READY on both custom domains. Actual public
Gemini answered fictional advice without stock/action; 172 cars, X2 850/floor950,
three exact gallery samples, HE/EN pages and sitemap passed. Public326-URL SEO
audit: zero missing descriptions (before114), HTTP/title/H1/canonical/language
issues0; duplicate title/description groups78/78 (before46/38), still open,
not a ranking claim. No runtime error clusters or release error/fatal logs found
in the checked10-minute window. This does not prove zero failures or email receipt.

Follow-up after protected merge PR2 (`29fa24e`): candidate selected checks passed,
1112 full tests/typecheck/lint budget passed; production Git build is running.
Unseen adaptive turns found two remaining controller errors: attached Hebrew
negator ובלי was not scoped, and explicitly requested office contact was replaced
by an active sales catalogue. Added narrow fixes/regressions without changing
safety/account/explicit-person gates. Follow-up remains unpublished until verified.

2026-10-23 final candidate review: airport advance-arrangement question now stays
autonomous in an actual Gemini call. Notification status refusal exposed a broad
sell_car label despite a correct notificationRequest flag and correct model reply;
the nontransactional notification route now accepts either sales label (and
unknown/policy), without overriding representative/safety/active-booking gates.
Added the exact regression; rebuilt candidate/live verification still required.

Additional candidate correction: the unseen airport-arrangement question was
correctly classified policy by Gemini, but bare "someone" triggered the legacy
person-request check. Use the existing request helper / explicit speak-to-someone
phrase rather than any mention of someone. Regression must keep this ordinary
policy question autonomous. Final combined release is still gated on the rebuilt
candidate and required PR checks; no production readiness claim from unit tests.

Candidate2682608 live retests: personal deposit complaint now escalates=true and
handedOff=true; notification follow-up keeps Gemini instead of a catalogue, but
Gemini still appended the office phone despite an explicit refusal. Added a
semantic positive-contact-request flag and a narrow notification-only redirect
guard; requested contact details remain permitted. Candidate must be rebuilt and
retested after this correction. Required PR2 verify/audit passed on2682608;
nonrequired Cloudflare Workers check fails on both previous8a942ab and this PR,
so it is a separate pre-existing integration failure, not a green all-platform claim.

2026-10-23 combined candidate gates: final completed SEO scope reviewed, full1,109
tests/85files and lint budget passed (0errors/1existing warning). After the last
intent-priority wording refinement, focused46tests and typecheck passed. No
publication claim for this candidate yet. Live adversarial notification, deposit
handoff and 25k-correction retests must follow on the actual candidate. The larger
24-dialogue acceptance corpus and durable delivery/operator controls remain open;
this is incremental progress, not permission to connect customer traffic.

2026-10-23 progress release `8a942ab` is live on both custom domains:
`dpl_7WZjgceTY8qXBsP3M1nuZsDxz5v4` READY. Whole-site production-config candidate
`dpl_3A7Nd48RtCMLVxYBFohszh583yqu` was first built without domain promotion;
catalogue/three distributed exact gallery samples/pages and live Gemini checked.
Public post-release checks: 172 cars, X2 display850/floor950, HE/EN rental, home,
demo and sitemap; real simulator returned Gemini. No customer transport activated.
Full local suite1065, full lint/budget0errors1existingwarning, typecheck passed;
critical audit0, one existing high FTP advisory remains. GitHub CI39965483083 audit
passed; verify was still running at this entry. Git reported existing admin bypass
for expected checks on direct fast-forward push; no protections were changed.
Future releases should wait for branch CI and use the protected merge workflow.
Preview-only candidate's catalogue returned500 (preview lacks production runtime
configuration); do not copy production secrets into preview to bypass that gap.
The attempted development env pull was rejected and not run; protected reads used
authenticated `vercel curl` instead, without saving environment secrets locally.
IAB showed React418 hydration errors before AND after release on the unchanged X2
form; its displayed initial total3180 is not a verified seasonal calculation.
Do not claim a new root cause or a successful hydrated-price check from that tab.

GitHub CI39965483083 subsequently completed successfully (verify and audit).
Next local increment: live sale-notification follow-up showed Gemini answered the
question, but the legacy car-sale route replaced it with a catalogue. Added a
semantic notificationRequest flag and a non-transactional Gemini path preserving
sale context. Also found and fixed the FAQ shortcut swallowing a genuine Gemini
representative+complaint intent, leaving escalation false in a live deposit case.
Contact-information-only questions retain autonomous handling. Present-tense false
outreach is filtered too; controller fallback no longer claims completed review.
Live leasing correction also exposed the numeric guard dropping valid 25 אלף→25000
and invoking an unsafe old fallback. Added source-derived quantity equivalence and
removed unsupported included-maintenance/quote promises and compound fallback
questions. Above-maximum mileage is not labelled a fitting package.
Added a controlling service charter, removed contradictory tone priority/repeated
question instructions; prompt wiring/size and focused92 tests/typecheck pass.
These new changes still need candidate live verification and publication. The
coordinating SEO task has now sent its final READY and scoped source was reviewed;
integrate its completed work without losing any bot edits. Never include unfinished
work or bypass the dirty-tree preservation gate.

2026-10-23 — Organic-search integration (local until release evidence): branch-specific
he/en metadata and visible guidance, national rental/service/location links,
daily/hourly/monthly/leasing comparison advice, model/seats/transmission metadata
for rental details (empty descriptions no longer yield no snippet), scoped sitemap
freshness and read-only326-URL audit. Shared footer retains every existing link,
adds monthly/hourly links and fixes duplicate leasing-link React keys. Unknown
vehicle specs are omitted rather than invented. No schema/prices/assets/booking/
auth/private-indexing changes. The source task reports32 focused tests and
typecheck passed and a local360px browser followed a branch→monthly link; this
does not prove production vehicle runtime or hydrated booking price. Final combined
suite/build, preservation and deployed326-URL audit still required. Details:
`docs/SEO-2026-10-23.md`.

Historical coaching entry (superseded by release and newer live reviews above):
2026-10-23 coaching work in progress: five live Gemini simulator turns reviewed,
not real customers. Identified deposit minimisation, premature taxi value claim
and an unanswered fleet-sale notification request. Added targeted guidance locally;
not deployed or live-retested yet. Evidence and remaining work:
`docs/whatsapp-bot/LIVE-COACHING-2026-10-23.md`. Actual inbound and staff-outbound
builders mapped in `docs/whatsapp-bot/WEBSITE-ENTRY-POINTS.md`; an estimate must
not be silently recorded as customer budget. Full 1,065 tests, typecheck and scoped
lint passed before the last prompt-wiring assertions (repeat focused gate).
Owner explicitly requests publishing current progress, then further improvement;
this is NOT approval to activate customer transport. CLI token is currently
invalid; existing connected deployment integration remains available.
Owner alert destination approved:
ido.goetha5@gmail.com; receipt of a real incident test still requires verification.

**CRITICAL OWNER DIRECTIVE, 2026-10-22: read `docs/DEPLOYMENT-SAFETY.md` before every change or release. Never silently omit, remove, overwrite or roll back existing features/assets. Start from latest fetched `origin/clean-main`; do not deploy partial bot exports/old checkouts. Run the preservation preflight in the exact release folder. Tell Ido and receive approval before any intentional removal/rollback.**

**Read this whole file before you change anything in the driver or manager apps.
When you finish a task, update this file in the same commit** (see "Keeping this file current" at the end).
`AGENTS.md` holds the hard rules (QR codes, mobile threshold, look and feel). This file explains the system and how to work on it.

The owner, Ido, is not technical. He writes in Hebrew and expects work done end to end: built, checked, deployed and verified on the live site. Report back to him in short, plain Hebrew, with no jargon.

---

## 1. What exists

`smartcar.co.il` is one Next.js app (SmartCar car rental). It contains three things:

| Part | URL | Who | Notes |
|---|---|---|---|
| Public website + booking | `/he`, `/en`, ... | Customers | next-intl, locale-prefixed. Minimum rental age is 21; the Hebrew and English terms, FAQ, guide, new-driver service page, and automated service knowledge state this consistently. |
| Admin | `/he/admin/*` | Office (Ido, Daniel) | `admin_auth` cookie. The "נהגים" page shows the manager views as tabs (`ManagerWorkspace`). |
| **Driver app** | `/driver/*` | Drivers, on phones only | PWA, no app store. Login: name + 4-digit PIN. |
| **Manager app** | `/driver/manage/*` (`/manager` redirects here) | Branch managers, on phone **and** computer | PWA. Login: `/driver/manager-login`, names of managers + 4-digit PIN. |

### Monitoring
Client-side Sentry is initialized in `instrumentation-client.ts`. Its `beforeSend` handler in `src/lib/sentry-scrub.ts` removes customer data from URLs and drops the exact Talisman browser-extension onboarding error; other application errors are still reported.

Bot reliability: `whatsapp-incidents.ts` sends PII-free fixed-category incident emails through Resend to the owner-configured `WHATSAPP_INCIDENT_EMAIL`, with at most two bounded attempts and provider idempotency per category/15-minute window. Acceptance by Resend is not proof of inbox delivery. The webhook reports processing/send/settings/handoff-alert failures and fails closed if its kill switch cannot be verified. This is not an external whole-host uptime monitor and does not yet provide a durable WhatsApp reply outbox.

Current bot release gate: `docs/whatsapp-bot/LAUNCH-ACCEPTANCE.md` separates local/published/live/external evidence and explicitly tracks delivery, phone coexistence, media, archive and independent monitoring gaps. The local thread increment replaces oldest-200 reads with authenticated 100-row ID-cursor pages, latest-window opening and forward catch-up polling while retaining loaded history. The UI preserves phone-scoped draft text on failed/uncertain send and does not automatically resend. No database rows or real customers were used in its synthetic browser rehearsal. Conversation-list discovery's separate 500-message cap is still open; do not call the complete inbox finished.

The Gemini client has an eight-second request deadline, per-instance cooldown and a single recovery probe after cooldown; the ordinary local backup remains available during provider failure. The 2026-10-23 branch `codex/bot-recovery-alerts` additionally reports `ai_unavailable` on an observed provider failure and `ai_recovered` only after a later non-empty provider response. An alert-service error cannot turn that fallback result into a thrown exception. These new Gemini alert hooks are local/unpublished until the release log says otherwise; no customer traffic or credentials were changed. Recovery refers to the observed model response, not every system dependency or delivery of prior messages.

### Office dashboard on a phone

2026-10-20 update: the dashboard no longer duplicates phone navigation with a quick-actions grid. Its read-only Search Console panel shows compact totals/top queries and an internal “כל החיפושים” button beside the Google link. `/admin/search-performance` offers Google's available queries, 7/28/90-day ranges, search, sorting and phone cards; visible pages refresh quietly every five minutes. Uses production service-account variables `GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL`, `GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY`, `GOOGLE_SEARCH_CONSOLE_SITE_URL`; credentials stay server-side. Google reporting delay/privacy omissions still apply.

Rental and leasing builders remain separate. Rental uses staged phone entry, searchable inventory and manual vehicle entry; leasing shows its form first with collapsed phone preview. The phone bar stays compact (Home, Bookings, Rental quote, All tools) with safe-area padding and room beneath page content. Pricing uses phone cards; review actions, inbox height and admin driver tabs are phone-adapted.

Rental/sale vehicle forms use `VehicleImageUpload` for gallery/camera selection, compression, preview/replacement/removal and save blocking during upload. Admin-only `/api/admin/vehicle-image` validates/decodes bounded raster uploads, strips metadata and stores fresh UUID WebP files in the existing public `vehicles/admin-uploads` prefix; no storage-policy/schema changes or overwriting existing images. Rental primary-photo replacement preserves additional images; save errors retain the form.

The mobile lead inbox keeps search and source selection in one compact row (fluid search, 7rem source control; both retain full accessible labels), so the branded header does not push customer work unnecessarily below the fold.

Office visual direction: retain Heebo and the official logo, light reading surfaces and the owner's dark-teal brand (`#0D2B2B`, `#2D5F5F`). The lead workspace hero/contact quick action use restrained deep-teal surfaces with white/mint text; white enquiry cards use a logical-start teal accent, clear source/status labels and stronger readable message text. The booking header follows the same brand, while its mobile action positions remain unchanged. Quote-draft controls use a calm sage panel with a separate white action. The shared office sheet header is deep teal, with contrasting close control and a light action footer. Dashboard metric accents are in the teal/sage family (not a rainbow); red refusal/error and amber overdue semantics remain intact. Do not replace this with an unrelated dark-mode/font preset.

New office surfaces are mobile-first: contact action spans the phone lead-card width before the two compact category tiles (desktop order unchanged); lead cards wrap long phone/email/message values. The office Radix sheet watches `visualViewport` resize/scroll while open to constrain height and lift fixed actions above an on-screen keyboard. Pinch zoom retains native behavior; no viewport API falls back to CSS `dvh`. Closing removes listeners; this does not change the separate driver/manager Sheet. Lead save is a 56px-minimum control; notes resize vertically only.

The dashboard contact tile uses the same private `/api/admin/leads` SWR feed as the inbox, refreshing every 30 seconds and on focus. It counts only `contact:` enquiries whose follow-up is `NEW` (absent metadata also means new). The quick action opens `/he/admin/leads?source=contact&status=NEW`; inbox controls can clear that view. Handled/quoted/closed enquiries are not counted; this is a workflow state, not a claim that a message was delivered. Loading/network failure never masquerades as zero enquiries. The tile does not send messages or change status when opened.

The dashboard lead card offers two independent direct actions: the secured in-admin lead workspace and the existing Google sheet (new tab). On phones these are separate full-width 56px-minimum controls; neither requires opening the other first.

Approved ongoing office upgrade scope and per-item delivery status: `docs/ADMIN-MOBILE-UPGRADE.md`. Owner excluded research item 19 (daily delivery/return dashboard); follow-up/assignee/reminder fields are limited to contact-form enquiries (item 22), not bookings/leasing/bot requests. Mobile booking cards and their visible actions must stay; tapping the summary opens full details.

Office booking details now use an accessible Radix sheet (focus return, modal focus trap, safe-area footer). Search includes phone/reference and explicit status/date filters; context survives navigation in session storage. Booking list revalidates every 30 seconds and on focus. Approval/refusal uses an in-app confirmation, duplicate-write guard and actual `confirmationEmailed` result; refusal atomically checks `PENDING` before changing status. No browser alert/confirm is used in this booking flow.

Office-only rental/leasing drafts are stored on the same device under `smartcar:office-draft:v1:` with schema/version/size validation and seven-day restore validity; the leasing record id is preserved across reload. They are flushed on page hide/background and cleared after successful office logout (unmount must not resurrect them). No server write or external message happens on autosave. The shared manager quote builders deliberately do not enable this office draft UI. Existing network-only update behavior is preserved.

`/he/admin/leads` is the secured in-admin lead centre; the dashboard opens it and the Google sheet remains available from there. Only `contact:` leads expose follow-up editing. `contact_lead_followup` is a private service-role-only table keyed by a contact-form lead FK; optimistic versions reject concurrent edits. Notes/assignee/reminders are not part of the Sheets feed or public contact responses. Reminder times use Israel's actual DST offset and become an in-app due list, not a promise of push/SMS delivery. Setup migration: `20261019182757_contact_lead_followup.sql`.
`/he/admin` is installable from the phone browser as “SmartCar ניהול”, with no install prompt or explanatory UI inside the dashboard. Its public manifest and worker routes are explicitly excluded from locale routing; its service worker (`public/admin-sw.js`) is deliberately network-only, enabling the app-style launch without caching any private booking or customer data. The phone navigation exposes Home, Bookings and rental quotations permanently; every other office tool is under “עוד”, to keep the dashboard uncluttered. Core lists use phone cards instead of a horizontally-scrolling desktop table, so their important actions stay in the same view.

`מחירי רכבים` is intentionally not a primary navigation destination. It opens from the action area of `ניהול רכבים`, because seasonal prices and overrides are part of fleet management.

Booking management exposes a labelled red delete action on phone cards and desktop rows for confirmed, cancelled (including customer cancellation) and completed bookings. Pending bookings must first be refused; active rentals are not offered deletion in this view. Confirmation explicitly warns that linked driver tasks, inspections and their files are permanently removed. The existing admin-only DELETE endpoint is unchanged; the UI prevents repeated submissions and retains the list item on failure. Deleting a booking does not remove an already imported lead from Google Sheets (the lead sync is append-only).

Office refusal uses the existing `REJECTED` booking status (phone and desktop), displayed as “סורב” / “Rejected”; rejected bookings can also be deleted. Only `CANCELLED_BY_CUSTOMER` is labelled “בוטל ע״י הלקוח” in admin; historical generic `CANCELLED` rows remain simply “בוטל”, because the old status alone cannot prove who cancelled. Do not bulk reclassify ambiguous historical cancellations.

The office dashboard is a daily-action surface: it has an at-a-glance dark header with the main rental-quote action, compact operational statistics, quick links for bookings/quotes/WhatsApp/fleet, the active Google Sheets leads centre, and a recent-booking summary. The private leads workbook is `1Ve0QjN471GdNno0mxfRkHmigozjRoBdoOr84PFNZH04`. Its bound Apps Script (`scripts/leads-sheet/AppsScript.gs`) pulls the dedicated authenticated `/api/integrations/leads` feed every five minutes. The owner authorized Google activation on 2026-10-19. Existing sheet edits and deletions are preserved by an append-only sync and hidden idempotency ledger. The old periodic CSV cron is disabled; individual booking/customer/office emails are unaffected. Setup and recovery: `scripts/leads-sheet/README.md`.

### Public vehicle gallery illustrations

2026-10-22 BMW X2 addition: the owner's gray X2 (2026 approved; public name and descriptions intentionally omit sDrive20i per owner) uses six new white-studio illustrations derived from the supplied photographs under `public/images/vehicle-gallery/bmw-x2-gray-2026-*-v1.webp`. Front three-quarter is first; closed head-on, side, rear, conventional front-doors-open and brown interior follow. The first softened front attempt was rejected and is not published. Existing galleries are untouched.

Optional vehicle fields `display_price_per_day` / `minimum_daily_price` separate the catalogue's starting price from online rental calculations. Existing rows retain null defaults and existing behaviour. The advertised field is used only on undated catalogue cards; actual date-based rates use `price_per_day` and the existing active seasonal configuration. The minimum clamps seasonal fixed/percent overrides and duration-discounted rental totals on both client/server, and coupon estimates cannot go below it. Both fields can be edited in the secured vehicle form, with positive-number validation. X2 configuration: display 850, actual base 1060 (current winter -10% rounds to 950; summer/holiday +13% rounds to 1200), minimum 950. Owner excludes X2 from leasing: its monthly rate is zero and the leasing catalogue/inquiry ignores zero-monthly-rate vehicles; no “rental only” badge is added. Migration `20261022151413_vehicle_public_price_and_booking_floor.sql` adds only nullable positive numeric columns; no auth/RLS/storage policies change.

Owner follow-up: i20's previous catalogue reference itself was not the desired standard facelift shape. Five new `hyundai-i20-2024-*-v4.webp` illustrations use the official Hyundai Israel 2024 article/photo (`https://www.hyundaimotors.co.il/article/new-i20/`) as the identity reference, including the standard angular bumper/no round fog lamps and geometric wheels. Visually reviewed front/head-on/side/rear/front-door-only set replaces the entire gallery of the three i20 rows after deployed checks; old i20 files are retained for recovery. Do not restore the rejected v2/v3 i20 URLs during later array edits. Other vehicle arrays remain unchanged.

Both asset phases and the 171-row compare-and-swap data update are now live. All 204 deployed files passed SHA-256/content-type checks; public `/api/vehicles` matches every final array, minimum five photos and zero rejected URLs. The original objects/arrays remain recoverable. The Seltos doors-open photo is the retained `kia-seltos-2.jpeg` (its filename does not say open). Mobile QA found the detail grid's implicit auto track expanded to the thumbnail strip's intrinsic width; explicit `grid-cols-1` and `min-w-0` children keep gallery/form within the phone while preserving the existing mobile form-first and desktop locale-aware order.

**Progressive rollout, 2026-10-20:** phase one is live: all 122 front/head-on assets passed deployed-byte checksum checks and all 171 rental rows now show the new front first (also verified through the public API). Phase two adds 82 reviewed replacements/additions: 53 side, 10 rear and 19 corrected front-door-open illustrations, for 204 new assets overall. Its backed-up data update requires deployed-file verification and fresh compare-and-swap hashes. The seven rejected open-door v2 illustrations are excluded from publication. Corrected v3 images open only the two conventional front doors, leaving the rear doors closed. All selected assets have been visually reviewed; the owner authorized the resumed publication. No old storage object is deleted.

The owner's approved catalogue style is a complete front-left three-quarter vehicle on a clean white studio background (the Aygo X reference), followed by at least four distinct closed-vehicle angles in total and one doors-open illustration. Added AI-generated assets live under `public/images/vehicle-gallery/*-v2.webp` (front, headon, side, rear) and `*-open-v3.webp`. They preserve the body/trim shown in the previous catalogue reference; they are not photographs of a specific physical fleet vehicle and do not independently certify registration year, colour or trim. The existing rental-page illustration disclaimer remains.

For the 2026-10-20 gallery rollout, update `vehicles.image_urls` only after all matching deployed assets return HTTP 200. The new three-quarter front is first, with a separate closed head-on angle. Preserve good originals and replace/remove the explicitly audited clipped/montage-fragment images; the owner authorized removing defective photos from galleries, not deleting storage objects. Every gallery must retain a side, rear and doors-open picture, with at least five photos overall. Both vehicle cards and the detail gallery already use the first array element, so no interface redesign is needed. Do not change model/year/colour/prices or delete old storage objects. The task workspace retains original arrays, image-generation prompts and an asset checksum manifest; use compare-and-swap checks against the original image array to avoid overwriting simultaneous office edits.

### Scheduled backups
GitHub schedules `.github/workflows/backup.yml` from the repository default branch `main`. That workflow checks out `clean-main` and runs `scripts/backups/run-backups.sh`; its script path must also be correct in the copy of the workflow on `main`. Database backups are encrypted and uploaded to Google Drive daily, and vehicle-image storage backups run on Sundays. New backups use the dedicated `SmartCar Backups` Google OAuth client with the `drive.file` scope and the `smartcar-backups-personal` Drive folder; the repository secret `RCLONE_CONFIG` holds that rclone remote. Older archives remain in the original `smartcar-backups` folder and can be accessed in Drive. The previous rclone configuration is retained locally for temporary legacy access; its shared OAuth client may stop working after the announced retirement.

### Driver app (`/driver`)
- **היום / מחר / חיפוש** tabs (`src/app/driver/page.tsx`, data from `GET /api/driver/today?date=today|tomorrow` or `?search=`).
- Sections: "דחוף · מי לוקח?" (open urgent jobs, first to tap "אני לוקח את המשימה" gets it, atomic claim, 409 if taken), דחוף, מסירות, החזרות, טיפול ברכב, שטיפות.
- Each card: Waze (address optional, editable on the card), call, WhatsApp "אני בדרך" (`src/lib/driver-on-the-way.ts`, signs as "נציג SmartCar"), "סמן כבוצע". Done or signed tasks disappear after 24h.
- **Inspection** (`/driver/inspection/new?bookingId=&type=pickup|return`): km + fuel in eighths (km can be read from a dashboard photo through Gemini, `/api/driver/odometer-ocr`), optional video with "דלג", damage marking on a car diagram with optional photos, optional checklist inside the damage step. On a **return**, handover damage shows grey and only new damage is marked (red).
- **Sign** (`/driver/inspection/[id]/sign`): the customer sees everything plus the declaration (`src/lib/inspection-declaration.ts`, pickup "אישור מסירת רכב", separate return declaration) and signs with a finger. A signed PDF goes by email to the customer and the office. If the customer isn't there, the driver can send a signing link.
- Works offline: inspections are queued on the phone and sent when signal returns.
- **Quick booking** (`/driver/quick-booking`): walk-in customer → handover. For a return, the driver searches the customer or plate among signed handovers (any driver's), and the return opens on that booking.
- Licence plate is **required** for drivers. Fleet cars with no plate ask for one.

### Manager app (`/driver/manage`)
Shell `src/components/app/ManagerShell.tsx` (sidebar on a computer, bottom tabs + floating "משימה חדשה" on a phone). Shared data in `src/components/manager/ManagerData.tsx` (SWR, refreshes quietly every 60s).
The manager UI uses one compact product-dashboard language across all pages: a 1360px desktop workspace, restrained white/slate surfaces, teal for navigation/selection, orange only for the primary create action, 16–20px card radii, rectangular search/filter controls, and summary cards before detailed content. Keep the phone layout and 44px targets when changing the desktop UI.
- **Actions:** "משימה חדשה" (מסירה/החזרה, any date, optional "create the return too"), and three quick actions: **משימה להיום** (urgent, now / within 1h / 2h / during the day; send to one driver or to all, first to take it), **שטיפה** (driver + car, send), **טיפול ברכב** (garage / tyres / test, with a reason). Form: `src/components/admin/DriverTaskForm.tsx` inside `NewTaskSheet`.
- **היום** (`TodayView`): greeting, global search, "חריגות ונזקים מההשכרה האחרונה" (`RentalAlertsPanel`), alert chips (late, unassigned, awaiting signature, urgent), a 14-day strip and the day's tasks. Tapping a task opens `TaskSheet` (change driver, date/time, address, cancel, delete after cancel, PDF/video).
- **יומן** (`CalendarView`): month grid and list of all future tasks; create a task on any day.
- **רכבים** (`VehiclesView`): fleet with status (בסניף / אצל לקוח / במוסך / לשטיפה), last km, last wash, next test date, history (garage, washes, handovers, returns). Add a car (plate, test date, km, ...) and delete a car (trash icon, with confirmation). API `/api/driver/manage/fleet` and `/fleet/[id]`.
- **נהגים** (`DriversView`): drivers with today/tomorrow load and notification status. Managers can add drivers, disable them and reset their PIN. Managers cannot create managers; only the admin can.
- **הצעות מחיר** (`/driver/manage/quotes`): rental and leasing builders shared with the admin, so the PDF layout, fields and calculations stay identical. Both can download a PDF and open a pre-filled WhatsApp message to the customer's phone with a branded `/q/<token>` PDF link (valid for 30 days). The shared manager/admin APIs are `/api/admin/vehicles`, `/api/admin/rental-quote-pdf`, `/api/admin/rental-quote-whatsapp`, `/api/admin/quote-pdf`, `/api/admin/quote-email` and `/api/admin/quote-whatsapp`; writes to the vehicle inventory remain admin-only.
- New WhatsApp document URLs use a compact 16-character random alias on the SmartCar `/q/` route. `quote_short_links` is service-role-only (RLS enabled, no anon/authenticated access); its alias resolves to the existing signed token, preserving expiry, document type and per-send storage slot. Legacy long links remain valid. Rental validity follows the representative's selected date; leasing uses 30 days. No external URL shortener or public bucket is involved.
- **מסמכים**: signed inspections with PDF and video.
- License plate is **optional** for managers and admin.

### Rental exceptions ("חריגות")
`src/lib/rental-alerts.ts`, API `/api/driver/manage/rental-alerts`, table `rental_alert_reviews`. Each signed return is compared with its handover:
- **km:** allowance from `mileageAllowanceKm()` in `src/lib/inspection-deviation.ts`: 200 km/day up to 7 days, 220 km/day for days 8–30, 2,500 km per 30 days above that. Rental days come from the handover and return signing times. A return reading lower than the handover is also flagged.
- **fuel:** returned with less than at handover.
- **damage:** marks on the return that were not on the handover.
The manager ticks "סמן כטופל" and the case stays in a grey history. Covered by tests (`rental-alerts.test.ts`, `inspection-deviation.test.ts`).

### Notifications (Web Push)
Texts in `src/lib/push-messages.ts` (human, polite, short Hebrew; each task type has its own: מסירה / החזרה / נסיעה למוסך / שטיפה / urgent / urgent-open). Hooks in `src/lib/push-notify.ts`, sending in `src/lib/push.ts`, service worker `public/driver-sw.js`, bell `src/components/app/PushBell.tsx`. Morning summary cron `/api/cron/driver-morning` (04:30 UTC). Managers are told when a form is signed or a return has an exception.

---

## 2. Accounts and sessions — read before touching auth

- Table `drivers`: `id, name, pin_hash, active, role ('driver' | 'manager')`. **One person can have two rows**: Ido has a manager row **and** a driver row named "עידו". Tasks are assigned to the **driver** row. Do not delete the manager row "עידו" without his approval.
- **Two separate cookies** (since 1 Oct 2026), so one phone can be logged in to both apps:
  - `driver_auth` → the driver app. Set when a `role='driver'` row logs in.
  - `manager_auth` → the manager app. Set when a `role='manager'` row logs in.
  - Older manager sessions stored in `driver_auth` still work in the manager app. When a driver logs in on that phone, the old manager session is moved to `manager_auth`.
- Helpers in `src/lib/driver-route-auth.ts`:
  - `requireDriverOrAdmin(as)`: the driver app prefers `driver_auth`; `as='manager'` prefers `manager_auth`.
  - `requireManagerOrAdmin()` accepts a manager row from either cookie, or the admin.
  - Shared routes take `?as=manager` from the manager app: `/api/driver/me`, `/api/driver/push`, `/api/driver/push/test`, and `DELETE /api/driver/login` (logout of one app only).
- `src/proxy.ts`: `/driver/manage/*` pages accept either cookie; other `/driver/*` pages need `driver_auth` (or admin). If the driver app is opened with a manager session, it shows "מחוברים כאן כמנהל" with a "כניסה כנהג" button instead of an empty day.
- **Known bug (fixed 1 Oct 2026):** both apps used one cookie, so logging in to the manager app logged the phone out of the driver role. The driver app then showed no tasks ("assigned task doesn't appear"). Don't merge the cookies again.
- Claude Code / AI agents never type PINs on the live site. Ask Ido to log in himself.

## Customer booking and email delivery — read before changing booking code

2026-10-20 public mobile update: the rental detail page has a compact vehicle/gallery preview before the staged request on phones; the locale-aware two-column desktop arrangement is preserved. `VehicleGallery` supports direction-aware horizontal pointer swipes, thumbnail selection, keyboard arrows and an accessible native full-screen dialog with previous/next, Escape/close, focus return, body-scroll cleanup and safe-area spacing. Pinch/vertical scrolling are not disabled; photo URLs/order/vehicle data are unchanged.

`BookingForm` now has three steps (rental dates/times/locations → customer details/notes → optional extras/coupon/review/consents). Sections remain mounted, retaining all fields and values through back navigation; each Continue validates its own fields and Enter cannot submit an early step. Final submission still uses the same schema/API, server recalculation, anti-bot token, honeypot, required terms and optional marketing consent. No customer data is added to draft storage. Controls are at least 48px with 16px input text; Continue is 56px. Calendar placement stays within the phone viewport. Each estimate explicitly says it is not final and requires the representative's written confirmation.

Airport surcharge wording appears **once only, in the location-selection step**, and only while pickup OR drop-off equals the canonical `airport` branch id. Selecting a different return branch does not hide it when pickup remains airport, and vice versa. It disappears if neither is airport; it is not sticky and must not repeat in later steps or the price breakdown. It states that airport service costs extra, is not included in the estimate, and the amount is agreed with the representative; no invented fixed airport fee is added to calculations.

- The public booking form is `src/components/booking/BookingForm.tsx`; it submits to `POST /api/bookings`. The server recalculates availability, rental days and price, writes the booking, then sends the messages. Do not trust price, availability, dates or locale values from the browser without server-side validation.
- The booking stores the language in `bookings.consent_locale`: `he` for Hebrew and `en` for English. This is the source of truth for every customer message sent later, including the manager's confirmation email.
- Customer email layout is in `src/lib/booking-customer-email.ts` and goes through **Resend**. It contains the unchanged official logo, branded Hebrew/English copy, rental details and correct direction (`rtl` / `ltr`). `RESEND_API_KEY` must exist on Vercel Production. Keep the text warm, professional and short; escape every dynamic value before inserting it into HTML.
- A new request sends the customer the “request received” email and sends the office notification through the existing EmailJS outbox (`src/lib/email-delivery.ts`). The office alert is intentionally separate and remains EmailJS.
- Failed Resend customer booking emails are queued in `booking_customer_email_outbox` and retried by `/api/cron/email-retry` for up to a week. If delivery still fails, the office receives a PII-free manual-follow-up alert with the internal booking-mail reference. The queue is service-role only; its production migration was applied on 2026-10-19.
- An admin transition to `CONFIRMED` in `src/app/api/admin/bookings/[id]/route.ts` sends a one-time Resend confirmation using an idempotency key. Its WhatsApp button deliberately says “Continue your booking & arrange the deposit on WhatsApp” / “להמשך ההזמנה ותשלום המקדמה ב‑WhatsApp”. It opens `wa.me` with a prepared message containing the booking number. There is no hosted card-payment page yet; do not imply that a card payment is completed.
- For a real end-to-end email test, use an address explicitly approved by Ido, make one clearly labelled test request in each language through Chrome, and confirm the received subject, direction, language, branding and WhatsApp link. A test request creates a real `PENDING` booking; do not silently delete, confirm or alter it afterward.

---

## 3. Data model (Supabase, project "Smart Car", free plan; do not upgrade it)

- `bookings`: real customer bookings, plus "field jobs" created from the apps (`source='driver'|'phone'`, price 0; hidden from "ניהול הזמנות" and the dashboard). `pickup_date`/`dropoff_date` are timestamptz; `pickup_time`/`return_time` are "HH:MM"; `custom_vehicle_name`, `custom_license_plate`.
- `driver_tasks`: `type 'pickup'|'return'|'service'`, `status 'open'|'done'|'cancelled'`, `assigned_driver_id` (null = unassigned / open urgent), `urgent`, `booking_id` (null for service). Service and wash use `vehicle_id`/custom car, `scheduled_at`, `scheduled_time`, `location`, `service_kind` (`garage|tire|wash|test|other`), `service_reason`, `service_place`. **A pickup/return task's day is the booking's `pickup_date`/`dropoff_date`** (Israel day, `src/lib/israel-day.ts`).
- `vehicle_inspections`: pickup/return, km, fuel_eighths, damage_marks, checklist, `handover_inspection_id`, status `awaiting_signature|signed`, PDF/video paths.
- `vehicles`: fleet (+ `test_due_date`, `current_odometer_km`).
- `rental_alert_reviews`, `push_subscriptions`.
- RLS is "service role only" everywhere. Server code uses `createAdminClient()`.
- Migrations live in `database/migrations/*.sql`, written to be safe to re-run. **Run every new migration in the Supabase SQL editor before deploying code that needs it.** All migrations up to `add-vehicle-fleet-details.sql` have run in production (1 Oct 2026).

---

## 4. How to work on it

1. **Branch from `clean-main`** (the production branch). Do not touch the customer-form QR codes or URLs (AGENTS.md).
2. Next.js 16 with breaking changes: read `node_modules/next/dist/docs/` before using framework APIs. Route params are `Promise`s; `src/proxy.ts` replaces middleware; `after()` from `next/server` for background work.
3. UI rules (AGENTS.md): 360px with no horizontal scroll, tap targets ≥44px, inputs ≥16px, `Sheet` for details, `useToast()` for feedback, no "behind the scenes" wording, brand colours (`#F4F7F7`, teal `#2D5F5F`, orange `#E8743B` only for the main action, `#0D2B2B` headings, indigo for garage, sky for wash).
4. Texts: Hebrew, professional and warm, short. Notifications in `push-messages.ts` with tests in `src/lib/__tests__/push-messages.test.ts`.
5. **Checks before every merge:**
   - `npx tsc --noEmit`
   - `npm run lint` (one known warning in `BookingForm.tsx`), `npm run lint:budget`
   - `npm test` (vitest, ~690 tests)
   - Mobile audit: `npm run dev`, then `npm i --no-save playwright && npm run audit:mobile`. It must print "All driver screens pass the mobile threshold". Add new screens and mocks to `scripts/mobile-audit/run.mjs`, and look at the screenshots.
   - Visual check: `BASE=http://localhost:3000 node scripts/mobile-audit/review.mjs` → `scripts/mobile-audit/out/review/`.
6. Commit as Ido (`Ido Goetha <ido.goetha5@gmail.com>`). Never commit secrets (`.env*`, VAPID keys, service keys).
7. There are no extra worktrees anymore; work on branches from clean-main. A leftover `.worktrees/` folder makes `npm run lint` and `lint:budget` fail locally (ESLint scans it) while CI stays green; remove it with `git worktree remove --force <dir> && git worktree prune`.

## 5. How to deploy (go live)

1. Run the new migrations in Supabase (SQL editor, project "Smart Car" → main/Production), then check that the new columns and tables exist.
2. Merge the branch into `clean-main` and run the checks above.
3. `git push origin clean-main`. Vercel deploys production from it automatically, and GitHub CI runs (verify + audit jobs). `npx vercel deploy --prod --yes` also works from a clean checkout. If the CLI fails with "File size limit exceeded", delete the local `.next` cache. For a local `vercel build`, move `.env.local` aside so it doesn't override the production env.
4. Verify on the live site: `/driver/manage` (logged in as a manager) and `/driver` (logged in as a driver). Check `/api/driver/today` returns the expected tasks, and that the browser console has no errors.
5. Env on Vercel Production: Supabase keys, `DRIVER_COOKIE_SECRET`, `ADMIN_COOKIE_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`, Resend, Gemini, Turnstile. Never print them.
   With a manager-only session, `/driver` must show "מחוברים כאן כמנהל" with a "כניסה כנהג" button (checked live 1 Oct 2026). Don't type PINs.
6. Tell Ido in Hebrew what changed, and what he should check on his phone.

## 6. Open items

- Real field test: one full handover and return from a driver's phone (video, damage, signature, emails).
- A lawyer should review the handover and return declarations.
- Push on one phone that is both a driver and a manager: the phone's subscription belongs to whichever app last turned notifications on.
- WhatsApp bot: current connection, grounded business knowledge, local outage fallback, privacy boundaries, observed free quotas and verification are documented in `docs/whatsapp-bot/BOT-BRAIN.md` (current source of truth; replaces earlier retry/full-core notes). `whatsapp-gemini.ts` keeps the existing flow contract but now uses the replacement bounded provider client. The flow remains deterministic for prices, consent, booking actions and safety. Claude's interrupted 100,000-message bank/hardening was preserved and checked; the bank now includes ~5,000 lexicon phrasings; offline (no Gemini) every clean core phrasing passes and ~12.7% of varied lexicon phrasings route differently, which Gemini handles when available; generated full-booking conversations all complete. This is not proof of complete factual accuracy or a full real booking/send test. Production/Preview keys were updated by the owner in Chrome, but each deployment must be checked for actual model responses. No paid billing or WhatsApp transport was activated; Daniel must approve the demo and the unpaid-provider privacy policy must be resolved before connecting customer traffic. See `docs/whatsapp-bot/WHATSAPP_BOT_STATUS.md` for transport setup. Conversation memory is 12 hours (`CONVERSATION_MEMORY_MS`); half an hour before it ends, `/api/cron/whatsapp-closing` (run every 10 minutes by `.github/workflows/whatsapp-closing.yml`, which needs the GitHub repository secret `CRON_SECRET` and a live WhatsApp transport) sends a short closing notice from `src/lib/whatsapp-closing.ts`. Typing repairs (wrong keyboard layout, Hebrew in English letters, adjacent iPhone keys) are in `src/lib/whatsapp-typing.ts`; the vocabulary in `src/lib/whatsapp-vocabulary.ts` is generated from `scripts/whatsapp-eval/lexicon/*.json` by `node scripts/whatsapp-eval/build-vocabulary.mjs`.

---

## Keeping this file current (mandatory)

After **every** task that changes behaviour, data, routes, env, deploy steps or rules:
1. Update the relevant section above. Facts only: what exists, where it lives, and how it works.
2. Add a line to the change log below: date, what changed, branch/commit, migrations, deployed yes/no.
3. Commit this file in the same commit or PR as the change.

### Change log

- 2026-10-26 — Additional short social openers (“היי מה נשמע?”, “שלום, מה קורה?”, “היי, אפשר לשאול שאלה?”) now receive conversational replies without invoking Gemini or proposing a vehicle before the customer states a need. Added exact phrase regressions after the owner's live greeting feedback. Customer WhatsApp remains disabled.

- 2026-10-26 — Owner's first live conversation exposed a repeated yes/booking-offer loop, an unnecessary pickup-hour question, and repeated location/vehicle prompts. The v2 core now turns an affirmative reply to a concrete rental offer into deterministic request intake, blocks model-generated hour questions and unsupported claims that dates were supplied, captures short answers to date/location prompts, and recovers a previously stalled time-question thread. A complete model-free guided request regression found and fixed “same place” being stored literally rather than copying the pickup city. Gemini instructions now explicitly forbid hours and repeated booking consent. No WhatsApp connection or customer activation.

- 2026-10-26 — Owner's live Safari demo exposed a greeting failure: bare “היי” triggered generic vehicle advice before the customer stated a need. The conversation core now handles short Hebrew/English greetings and “how are you” directly, with a warm open question and no sales pitch. A greeting during rental intake retains its context. Focused regressions use the owner's exact phrase. No schema or credential change; WhatsApp remains OFF.

- 2026-10-26 — A second preconnection WhatsApp audit ran 20 more fictional production-demo conversations, including slang closing, reservation wording, human request during rental intake, English sale and leasing, vehicle corrections, billing and mechanical service, and switching between commercial and service needs. Fixed the observed missed routes and added focused regressions. The owner requires preconnection conversation acceptance before linking the real number; YCloud onboarding remains on hold. Production demo tests do not prove real phone delivery.

- 2026-10-26 — Extended the WhatsApp conversation audit across rental advice/consent, price objections, age eligibility, English pickup, sale, leasing, existing-booking changes, billing, breakdowns and human handoff. Live isolated dialogues exposed natural-language stalls and repeated answers. The v2 core now recognizes ordinary request-closing phrases, retains stated car type, advances leasing toward an explicit team offer, keeps sales context when a customer asks for a callback, handles return-date wording and child-seat follow-ups, and offers a rental request after repeated final-price questions. Real Gemini rechecks exposed a child-seat question misclassified as policy and a sales callback left pending; both are covered by explicit regressions. New full-dialogue tests use fictional details and no real booking. Customer WhatsApp switch remains OFF; a connected YCloud number and real-message acceptance are still required.

- 2026-10-26 — SmartCar conversation core completes rental requests for representative review, and qualifies sale, leasing, service and breakdown enquiries for the team. The customer-facing demo labels a completed rental request as awaiting team review; it never represents a confirmed booking. Sale follow-up accepts that the customer has no further preferences. A direct double-charge complaint now enters service handoff without requiring the phrase “existing booking”; live simulation exposed this gap. Branch `codex/bot-rebuild-20261025`; no migration in this increment. Targeted tests, typecheck and lint pass (one pre-existing warning); full suite and production publication of the billing correction pending at this entry. WhatsApp customer transport remains disabled pending YCloud onboarding and real-message acceptance.

- 2026-10-23 — PR3 progress published/verified as `1e5fab4` (bot control fixes, all8 service advice pages, rental schema and distinct leasing hub metadata). Next branch adds bounded/uncertainty-aware send handling, honest post-acceptance history failure, private bounded older-quote retrieval; actual loopback API/UI mobile test loaded all1020fictional messages and prevented duplicate-send advice. No real transport, schema, auth, asset or price change. Local1157 tests/typecheck/lint budget passed; next release pending.

- 2026-10-23 — Third search-content pass locked and reviewed: distinct bilingual title/description/share metadata for `/leasing` catalogue/quote hub vs `/services/leasing` explainer. Both URLs and all catalogue/form behaviour retained. Scoped tests now cover the distinction; final combined checks and publication pending. No routes removed or canonical consolidation performed.

- 2026-10-23 — Reviewed/integrated source task's rental structured-data correction: shared helper describes LeaseOut explicitly, uses the existing advertised display-price precedence (X2 850) rather than calculation base1060, and escapes script-closing characters. Existing booking minimum950/calculation/form/images/URLs are unchanged. Five focused helper tests plus40 SEO tests passed in the source task; combined publisher gates/live verification remain required. No schema/data migration.

- 2026-10-23 — Integrated second search-content pass for all four remaining existing service pages (business, commercial, new-driver, sale), Hebrew/English. Retains every route/CTA/asset/price; adds practical checks without promising licence eligibility, payload, cover, warranty or availability. Scoped sitemap dates match actual edits. Source task40 focused tests/typecheck/lint passed; publisher reviewed the complete four-file diff. Included after the bot follow-up as a separate commit; combined candidate/CI/live checks still required. Live first-pass326-page audit resolved114 missing descriptions; duplicate groups78 remain open.

- 2026-10-23 — Protected PR2 progress published as `29fa24e`, deployment `dpl_7oTxkrA3iNMa7duCZzjGg3fYeoNz`; full-site public/API checks and selected real Gemini calls passed, transport off. Follow-up locally fixes Hebrew attached negation and explicit contact-information intent in a sales thread;124 focused tests/typecheck and1114 full tests pass. No schema/assets/pricing/auth/transport changes. Follow-up publication and live regression still required; full customer-readiness gates remain open.

- 2026-10-23 — Local thread archive/polling increment on `codex/bot-recovery-alerts`: added acceptance ledger; cursor API with auth/invalid-cursor/failure tests and shared client feed with 1,020-row, burst, retry-state and concurrent-poll tests. Actual local API/UI rehearsal loaded all 1,020 fictional messages and then all 1,370 after a burst, retaining a draft on intentional send failure. Scoped lint/typecheck and final full 1,065-test run pass. No schema/assets/prices/dependency/auth/transport change and no publication. Local test fixture uses fake credentials and data; it is outside the production tree. Next dev regenerated only the heading level in its managed AGENTS block; critical preservation instructions remain unchanged. A 360px local iframe rendered the layout but did not hydrate; do not call it a mobile interaction pass. Interactive phone verification, list discovery, media and durable processing remain open.

- 2026-10-23 — On full canonical baseline `4f752ce`, added Gemini outage/recovery incident hooks and regression tests for cooldown recovery and simultaneous notification-service failure. No schema, asset, pricing, dependency, auth or transport change. All 1,050 tests in 81 files, focused 15 tests, typecheck and scoped lint passed. The preservation preflight correctly blocked the uncommitted development tree; after the scoped commit, it passed: 716 baseline files, 234 exact public-asset checksums, 172 vehicles, 211 currently published gallery references, Search Console/X2 markers preserved. No publication or real incident email yet; durable WhatsApp delivery recovery, external uptime monitoring, alert inbox confirmation and YCloud live handoff gates remain open.

- 2026-10-23 — Integrated bot release `6c04908` is READY (`dpl_B89sb18aVp5GBXV4cZbCfBvNLrcQ`), verified on both custom-domain aliases. Live synthetic simulator turns returned Gemini, retained year/15,000-km/comfort context and obeyed the request not to prepare an offer; the actual demo UI also passed advice/recall. All 215 gallery files match deployed bytes/content type. Authenticated Search Console works (249 clicks, 10,414 impressions, 907 queries). X2 catalogue shows 850 and winter Dec 20–23 shows 2,850 total (950/day); no booking submitted. Original 171-vehicle checksum remains identical. No new release error/fatal server logs observed in the checked window. Sentry event 155582396 contains one old-release browser event, Browserbase automation/captcha breadcrumbs and a pickup-select click; the same custom-location/back transition now works without removeChild. This is evidence of an isolated automated rehearsal, NOT proof of root cause or universal resolution. Keep the event open; do not silence monitoring or declare all future failures impossible. Canonical folder map and full incident evidence: `/Users/idog/Documents/Codex/SmartCar/README.md` and `INCIDENT-2026-10-23.md`.

- 2026-10-23 — Read the owner's recent incident emails: CI `199150a` verify succeeded but the critical-advisory job failed on newly published Next/Sentry advisories, independently of the partial-export incident. Pinned Next/eslint-config-next 16.4.2, Sentry 10.75.2 and sharp 0.35.5 and refreshed compatible vulnerable transitive packages. Production audit: zero critical, one remaining high advisory in the unused FTP dependency of the pa11y browser-audit tool; no force/downgrade bypass. New full build (206 static pages), 1,048 tests, typecheck and lint budget passed. Canonical checkout now has its own installed dependencies, not a link into the old working copy. Set Production `WHATSAPP_ENGINE=ai` to preserve the previously deployment-only AI mode across normal Git releases; no credential rotation/transport activation. A new removeChild browser exception on `/en` is evidenced by the owner's Sentry mail; its root cause remains unproven and must not be called fixed solely by the upgrade. Live publication and verification follow.

- 2026-10-23 — Owner authorized reintegrating the updated bot after full-site recovery. Integrated only bot runtime/tests/coaching/evaluation files from the preserved original working copy onto complete `199150a`, retaining every public/admin/booking file. All 1,048 tests and static typecheck passed; lint remains zero errors / one existing warning. Moved release checkout to `/Users/idog/Documents/Codex/SmartCar/production-source` and quarantined the incomplete export recoverably with build/link disabled. Added full baseline file inventory and exact public-asset checksums to preservation checks. No database/schema/credentials/WhatsApp transport activation. Deployment and new live verification pending at this entry; do not infer delivery readiness from simulator tests. Historical bot notes and isolated-release claims are superseded by current source and this log.

- 2026-10-22 23:27 Israel — Incident recovery authorized by owner: manual bot deployment source based on old `3f5feaa` omitted published gallery assets, Search Console/mobile-admin and X2 advertised-price/floor code. Restored exact complete verified source `b83f1c7` through Git-based Vercel build `dpl_33ujsvhS7GyPANFMkD8Dz1PMLFSL`, Ready, custom aliases `smartcar.co.il` and `www.smartcar.co.il`. No vehicle/database/storage/credential mutation. Later bot edits remain on disk, deliberately not included in this owner-requested rollback. Live dashboard now shows Search Console metrics (244 clicks / 10,231 impressions) and All searches. Added explicit preservation instructions to AGENTS/CLAUDE and `docs/DEPLOYMENT-SAFETY.md`, plus a preflight checking complete Git baseline, required features and every published local gallery file. Documentation/local checks cannot guarantee zero outages or prevent independently authorized bypass; platform-level policy changes need separate approval.

- 2026-10-22 — Published `542186d` (Vercel Ready; verify/audit checks pass): six owner-reference BMW X2 studio assets and separate public starting price from an enforced online daily floor, including duration-discount/coupon estimates and authoritative server calculations. Secured form exposes both optional prices. Migration applied; X2 row `c6d3d239e23cd4635a4dc0f5533ea89f0` activated only after all six deployed WebP files passed HTTP/content-type/SHA-256 checks. Public name shortened to BMW X2 per owner. Confirmed public API values, live luxury card From 850, and winter 20–23 Dec estimate 2850 (950/day), 360px no-overflow detail/card, no X2 leasing listing. Existing 171-row checksum unchanged. 990 tests, TypeScript and lint budget pass (one existing warning); no real booking/email sent. Existing unrelated Supabase security advisories remain; no auth/RLS change. Cloudflare's separate Workers check fails while the production Vercel deployment and GitHub verify/audit succeed; runtime logs were not independently audited.

- 2026-10-22 — WhatsApp bot, advice conversations without Gemini (the free Gemini quota was blocked: AI Studio shows "You have reached a rate limit. Set up billing"). Fixes from a live run: "לא בטוח אם זה משתלם" no longer triggers the emergency text ("לא בטוח" counts only about a place), "ברחובות" is not a hit-and-run, "help me choose" is not an emergency; every conversation now keeps its history even when the reply was a general answer (before, a few general questions in a row lost the context and the welcome menu returned); a question while the chat is with the team still gets its published answer instead of silence; leasing advice (operational vs financial, leasing vs buying, yearly km → package, monthly price, early exit, electric models) answered in a leasing context instead of rental answers; a place inside a question ("החניה בתל אביב יקרה?") is not a booking detail; "ים המלח" is not abroad (abroad/smoking/rideshare/cancellation topics need their own words); "מ-10 בנובמבר עד ה-17" and "מנתב״ג, ולהחזיר לשם" parsed. New `src/lib/whatsapp-advisor.ts`: which car fits (group, luggage, stroller, hilly trip), category comparisons, fuel economy, rent-or-taxis, parking, one-day trips. `fleetQuestionAnswer` in whatsapp-catalog-knowledge.ts answers "יש חשמלי / ידני / אוטומט / איזה רכבים" from the real fleet. 883 tests pass. Known limit: open-ended advice on new topics still needs Gemini with billing enabled. No migration.
- 2026-10-21 — WhatsApp bot, a learning brain, context and returning customers (all without Gemini). (1) Trained classifier: `scripts/whatsapp-eval/build-brain-model.mjs` trains two models (naive Bayes and logistic regression over words, word pairs and letter pieces, `src/lib/whatsapp-brain-features.ts`) on ~83,000 phrases from the lexicons (situations, `lexicon/questions.json`, `lexicon/brain/questions-extra.json`, `lexicon/brain/question-frames.json`, rental and urgent lists) into the generated `src/lib/whatsapp-brain-model.ts` (73 labels; a label is trusted only when both models agree). It names the business topic of questions in words no rule knows ("מה הסיפור עם הטנק" → fuel policy) and the published answer is used (`classifiedAnswer` in whatsapp-business-knowledge.ts); one or two words without a question never decide a topic ("מיכל" is a name). On 30 new phrasings: 28 right answers, before 6. (2) Context, `src/lib/whatsapp-context.ts`: negation ("לא צריך נציג, רק…", "not an SUV, something small", "מחר אני לא יכול"), someone else's car or the past ("הרכב שלי במוסך אחרי תאונה, צריך רכב חלופי" is a rental, not an emergency; a real emergency with our car still escalates), praise or thanks about a representative is not a request, "אתה בכלל בן אדם?" is a bot question, home town is not the pickup ("אני גר בהרצליה אבל אאסוף בתל אביב"), reported speech plus a question gets the answer. Car words match whole words only ("אזולאי" is not "זול", "במוסך" is not BMW); a car type outranks an adjective ("family SUV"). 86 context cases in `lexicon/brain/context-cases.json`, tested by `whatsapp-context.test.ts`; 80 common names checked at the name step. (3) Returning customers, `src/lib/whatsapp-returning.ts` + `pastCustomer()` in whatsapp-flow.ts (reads the last `whatsapp_rental_requests` row and last booking of the number, once per conversation; no migration): greeted by name, the name and email from last time go into the summary (email partly hidden) and can be changed there, "כמו בפעם הקודמת" fills the places and car (never dates), "מה עם הבקשה ששלחתי?" gets the real status. Test: `whatsapp-returning.test.ts`. 883 tests pass. No migration.
- 2026-10-20 — WhatsApp bot, second human round (no Gemini needed): a 1,500-conversation / 18,000-message offline run (`scripts`-free probe; checks for two questions in one message, repeated replies, the menu shown again, details lost, names recorded wrongly) went from ~900 issues to none. Fixes: questions, remarks, dates and "לאותו מקום" are never recorded as the customer's name; "nice to meet you" is no longer read as a pickup→return route; English words inside other words no longer set trip needs ("located" ≠ cats, "directions" ≠ direct payment); "where are you located", a question at the name step and at the summary step get their answer; a full name or email sent early is recorded and acknowledged; a lone return date is confirmed ("סגור, החזרה ב־25/10 ✅"); "רגע"/"ביי" mid-booking don't push the next question; the chat follows a customer who switches language; the summary gate wording is friendlier and still sends nothing until "אני מאשר"; answer openers vary instead of always "שאלה חשובה."; the state passed to the reply polish is a copy (in-place edits had hidden what changed). Test: `whatsapp-human.test.ts`. No migration.
- 2026-10-20 — Public mobile release `b0cd988` is live and its 360px preview/full-screen gallery verified. Catalogue cards deliberately remain unchanged per the owner's follow-up. Tightened step-one validation so an equal/earlier return cannot advance while terms are still unchecked; invalid date ranges show no estimate. Added the regression case; all eight focused gallery/booking interaction tests, TypeScript and lint budget pass. No API/schema/price-rule change.

- 2026-10-20 — WhatsApp bot "brain without a brain": `src/lib/whatsapp-brain.ts` reads big phrase lists (`scripts/whatsapp-eval/lexicon/brain/*.json`, compiled by `node scripts/whatsapp-eval/build-brain.mjs` into the generated `src/lib/whatsapp-brain-data.ts`; do not edit it by hand): ~20,000 everyday phrases in Hebrew, English, slang and transliteration mapped to 35 situations, 465 places with ~4,800 spellings, ~1,000 car phrases and 259 models ("קיה פיקנטו" → small car), group sizes ("אנחנו זוג", "אני ועוד 3 חברים"), holidays ("בחנוכה" → that week's dates), relative days and durations ("next friday for 4 days"). Used by the flow when Gemini is missing or busy, so a car model or a group size starts a booking, a place/email sent early is recorded and acknowledged ("רשמתי, איסוף מירושלים 📍"), "נעים מאוד, אני דני" is greeted by name, "איך קוראים לך" / "מה אתם עושים" get real answers, "ביי" mid-booking says the details are kept, and every message holds one question at most. "מה שעות הפתיחה" now gets the opening hours (was the rental-terms text) and "ובשישי?" gets just Friday. A short place answer ("airport") is recorded instead of triggering a sales script. Tests: `whatsapp-brain.test.ts`, `whatsapp-replies.test.ts`; 781 tests pass. No migration.
- 2026-10-20 — WhatsApp bot human reply library `src/lib/whatsapp-replies.ts`: when Gemini gives no reply, everyday messages (greetings, "מה קורה", thanks, laughs, "יקר לי", discount, "אחשוב על זה", off-topic, bye…) are recognised by `detectSituation` and answered from openers × cores × closers (1,151 lines; ~35,000 combinations with a booking question), never repeating a sentence already sent in the conversation; a fixed booking prompt already sent is re-asked in other words (`bookingQuestion`). Applied in `humanFallback` (whatsapp-flow.ts) only when the message added no booking detail and outside the name/email/summary steps and the leasing/sales/lookup flows. "ביי", "היי", "שלום" are never taken as a name. Test: `whatsapp-replies.test.ts`. No migration.
- 2026-10-20 — Approved public rental mobile improvements: compact preview, swipe/full-screen gallery, three-stage request preserving every field/extra/coupon/consent and payload, clear non-final estimates, and one conditional airport surcharge note beside location selection only. Owner explicitly rejected repeat notices on later steps. No vehicle/schema/price-rule/email changes or real booking submissions during QA. 882 tests, TypeScript and lint budget passed after integration with the latest bot updates (one existing RHF warning). Production verification follows deployment; temporary local preview is excluded from Git.

- 2026-10-20 — Owner-requested i20 identity correction: five v4 illustrations generated from the official Hyundai Israel standard facelift photo, checked against it rather than the old catalogue reference; image-only publication with backed-up three-row array activation after checks. Mobile layout fix `0a2d5c1` is live and verified at 360px (main image x=16..344; no page overflow; thumbnail switching works). 865 tests, TypeScript and scoped lint passed.

- 2026-10-20 — Completed production gallery publication (`bd6df53`, `6abab72`): 204 checksum-verified new illustrations, 171 exact public-array matches, minimum five pictures, front-three-quarter first, and all 77 rejected original URLs absent. Original files remain recoverable. Fixed the rental-detail mobile grid's intrinsic thumbnail-width overflow without reordering the form/gallery or changing booking behavior; final responsive verification follows deployment.
- 2026-10-20 — Phase one published successfully (`bd6df53`): 122 checked WebP assets verified byte-for-byte on production and front-first arrays verified for all 171 rental rows through the public API. Phase two stages the remaining 82 reviewed side/rear/front-door-only assets; its manifest replaces/removes 77 defective original URLs, preserves good originals and supplies at least five images per rental row. Seven rejected open-v2 illustrations never ship. No interface/schema change or storage deletion. 865 tests, TypeScript and lint passed (one existing warning). Phase-two data activation follows deployment verification.
- 2026-10-20 — Integrated the approved mobile admin, Search Console and gallery-upload changes on top of Claude's published `b92d9d4` (no overlapping source files). Rental/leasing builders remain separate; unified-history migration is excluded. All 865 tests, TypeScript, scoped lint and lint budget passed (one pre-existing warning). Earlier isolated release passed a real 360px photo upload without changing vehicle rows. No migration. Integrated production deployment pending; custom-domain access currently times out from this machine.
- 2026-10-20 — WhatsApp bot without Gemini (the free quota runs out: Flash Lite allows 15 requests/minute, 250K tokens/minute and 500/day, and the live tests hit 429): the numbered welcome menu appears only on the first message, later a short human line; "אני מתכנן טיול" starts a booking; "מ-14 עד 18 בדצמבר" is read as two dates; repeated booking questions are short follow-ups instead of the opening line; "לא הצלחתי לזהות את התאריך" / "אני צריך את שני המיקומים" replaced by friendly wording; a question comparing car sizes is not taken as a choice; "מה קורה" mid-booking gets "הכל טוב, תודה 🙂". Gemini requests are smaller (knowledge budget 5,000 characters, fleet only on the places/vehicle steps). No migration.
- 2026-10-20 — WhatsApp bot, from a 75-message live run: replies stay in the conversation's language (Gemini gets `replyLanguage`; a Hebrew lead-in is dropped from an English chat); hand-offs to a person use Gemini's empathetic wording when Gemini asked for the person (emergencies keep the fixed safety text); after a hand-off the customer gets one "קיבלתי, הוספתי את זה לצוות 🙏" instead of silence; Gemini rephrases an unanswered question instead of repeating it and does not paste the same explanation twice. No migration.
- 2026-10-20 — WhatsApp bot conversation flow: during a booking, a question or a remark that adds no booking detail gets Gemini's natural answer without forcing the next form question; Gemini sees the last 14 messages (500 characters each) and is told to continue the thread (refer back, no re-greeting, follow-ups in context); no invented policies (discounts, delivery fees); human wording for the name/email re-asks and the summary intro; "לאותו מקום" and Gemini's English place names are recorded as the Hebrew branch name. No migration.
- 2026-10-20 — WhatsApp bot tone: Gemini's instructions now centre on sounding like a person texting (match the customer's length and register, singular casual Hebrew, no stock closings such as "אפשר לעזור במשהו נוסף?", no repeated openings/emojis from recent messages, examples of tone), temperature 0.7; lighter "are you a bot?" answer. No migration.
- 2026-10-20 — WhatsApp bot, one voice for every message: `inOneVoice` (whatsapp-flow.ts) sends Gemini's own reply whenever Gemini read the message, except emergencies/hand-offs, the final summary and consent, price suggestions, existing-customer bookings and the leasing / cars-for-sale / booking-lookup flows. During a booking, if Gemini's closing question is not the detail the booking needs next, `composeOneMessage` (whatsapp-gemini.ts) asks Gemini once to keep its answer and end with the right question; the fixed wording is used only if that fails or Gemini is unavailable. No migration.
- 2026-10-20 — WhatsApp bot, third live check: Gemini's small-talk replies are no longer dropped for containing two questions (the one-question rule now applies only to booking steps); a local "car + question mark" guess no longer starts a booking when Gemini reads a rules question or a remark; a discount request is answered as sales instead of handing the whole chat to a person. No migration.
- 2026-10-20 — WhatsApp bot, second live check: a question that mentions renting ("מותר לצאת לטאבה?") is answered instead of starting a booking; price objections and discount requests are handled as sales, not handed to a person; leasing questions are answered (asking for an offer still goes to the leasing flow); questions on the name/email steps reach Gemini (the name and email never do); "thanks man" is no longer taken as a name; Gemini never claims it recorded a name; shorter price-suggestion wording. No migration.
- 2026-10-20 — WhatsApp bot, Gemini first: outside a booking and the lead flows (leasing, cars for sale, booking lookup) the customer gets Gemini's own reply for small talk, questions, remarks and off-topic messages; keyword routes are only the fallback when Gemini is unavailable. Greetings ("היי", "שלום", "hi") no longer reset the conversation to the menu. Gemini's instructions cover small talk, first contact, frustration and off-topic messages. No migration.
- 2026-10-20 — WhatsApp bot, after a live check: a booking request typed after the menu ("צריך אוטו לסופ״ש מנתב״ג") starts the booking and keeps its details; small talk after the menu gets a human reply instead of the menu again; a single place name is the pickup only (the return place is asked); an English message never gets a Hebrew reply and English replies show English place names; a scripted sales line no longer overrides Gemini's answer during a booking; duplicate models are removed from price suggestions; the fleet reaches Gemini for the whole booking; Gemini does not assume a car category (e.g. for the deposit). No migration.
- 2026-10-19 — WhatsApp bot speaks in one voice: Gemini now writes the whole reply (`reply`) and says what its closing question asks (`asks`); the flow sends it as is only when that matches the next missing booking detail (dates → places → vehicle → name → email), otherwise the answer without its questions plus one fixed question. `guardedReply` rejects invented numbers/links, any question about times, and two questions. The rental fleet (models, seats, gearbox, fuel by category, no prices) goes to Gemini while the customer chooses a car. Offline: single-place answers ("הרצליה", "להחזיר בנתבג", "לאותו מקום", "כן"), "עוד שבוע" and weekdays are understood; the local knowledge fallback no longer answers plain booking details; the "רשמתי:" echo is gone. Gemini sees no name/email/confirmation messages in `recent`. No migration.
- 2026-10-19 — WhatsApp bot: when the chat asks its next question, any question inside Gemini's reply is dropped, and the generic "anything else?" line is skipped when Gemini's answer already ends with a question, so the customer never gets two questions at once. Deployed and checked live: Gemini answers (`understood.source: gemini`) with the new key. No migration.
- 2026-10-19 — Merged Codex's Gemini connection/local-knowledge work with Claude's bot round: 12-hour conversation memory with the last 8 messages sent to Gemini (name/email steps and contact details removed), closing notice 30 minutes before the memory ends (cron route + GitHub workflow; inactive until `CRON_SECRET` and the WhatsApp transport exist), typing repairs and a generated vocabulary from ~5,000 lexicon phrases, warmer sales tone in fixed replies and Gemini's voice, acknowledgements ("סבבה", "👍") no longer taken as answers, known places/"מהרצליה לנתב״ג" parsing, wider emergency/complaint keyword recognition with hypothetical ("מה קורה אם…") questions answered rather than escalated. Booking references and car model names are never converted by the typing repair. No migration. Deployment pending.
- 2026-10-19 — Rebuilt the Gemini provider connection with bounded failure/cooldown handling, expanded bilingual business knowledge and public catalogue context, retained interrupted bot hardening and test bank, added local outage answers and topic context without disturbing booking consent/actions. Owner rotated the shared Gemini key in Google and saved Production/Preview in Vercel; OCR model unchanged. No migration, billing or transport activation. Checks and deployment verification recorded in BOT-BRAIN.md; deployment pending.
- 2026-10-19 — Followed the live 360px brand review with a compact search/source row in the lead inbox, reducing vertical control space while retaining full labels and existing search/filter behavior.
- 2026-10-19 — Refined the dashboard, contact action, lead workspace/cards and office details-sheet brand treatment: deep SmartCar teal, quiet sage surfaces, clearer type/spacing, stronger focus treatment and balanced metric cards. Presentation-only; existing navigation, contact-only follow-up restrictions, reminders, drafts, mail and Sheets behavior unchanged.
- 2026-10-19 — Audited new leads/contact-detail UI in signed-in Chrome at 360px. Added keyboard-aware office sheet geometry, long-text wrapping, larger lead save action and a more compact mobile dashboard tile arrangement with the contact queue first. No data/email/sync changes; no customer records changed for visual QA.
- 2026-10-19 — Added a live new-contact-enquiry count and “לטיפול בפניות” quick action in the dashboard lead tile. It opens the contact-only NEW inbox filter; zero/error/loading states retain access to all contact enquiries. Same feed/definition on dashboard and inbox, no schema or automatic messaging change. Direct leads and Google-sheet buttons remain.
- 2026-10-19 — Added separate direct dashboard buttons for in-admin leads and the existing Google sheet, per owner request. First mobile upgrade increment `aeca885` is Ready on Production and verified read-only in signed-in Chrome at 360px (booking cards/details/scrolling fixed actions/filters, lead list and contact-only follow-up fields). No real bookings or contact follow-up rows were modified by browser verification.
- 2026-10-19 — Implemented the first approved mobile-office increment: preserve booking cards with complete details sheet; phone/reference search, collapsed status/date filters and saved context; accurate mail outcome and protected confirmation actions; local rental/leasing draft restore without disabling automatic updates; clearer dashboard metrics/actions; protected in-admin leads with contact-form-only owner/reminder/note. Migration `20261019182757_contact_lead_followup.sql` applied and transactionally verified; private follow-up data is excluded from Sheets. 794 tests, TypeScript and lint budget pass. Remaining approved features are explicitly tracked in `docs/ADMIN-MOBILE-UPGRADE.md`; item 19 excluded. Deployment/visual verification pending.
- 2026-10-19 — Corrected office refusal to persist `REJECTED` rather than `CANCELLED`, removed the incorrect customer attribution for generic cancellations, and exposed deletion for rejected bookings. Existing enum verified; no schema migration. Deployed `6dd70c3` to Vercel Production; 766 tests, TypeScript and lint budget passed (one existing warning). At the owner's request removed 33 exact-name Ido Goetha/עידו גויטע bookings, with 4 driver tasks and 4 inspection rows; after explicit follow-up approval, removed another 16 Daniel Nardea/דניאל נרדאה/דניאל דניאל bookings. Names normalized for case/whitespace, exact saved IDs rechecked before transactional deletion. Full row backups saved outside Git in the task workspace as `smartcar-test-bookings-backup-2026-10-19.json` and `smartcar-daniel-test-bookings-backup-2026-10-19.json` (0600); private media files retained for recovery. Confirmed 57 bookings remain and no selected internal test names remain. Other names were not inferred to be tests or deleted.
- 2026-10-19 — Shortened newly generated rental/confirmation/leasing WhatsApp document URLs to opaque 16-character aliases, without altering quotation validity, PDFs or existing links. Migration `20261019161359_quote_short_links.sql` applied in Production; RLS/role access checked. Deployed `7641087`; legacy and temporary compact link both returned 200 and byte-identical PDFs with private/no-store headers. Temporary test alias removed; original test quote unchanged. All 755 tests, TypeScript and lint budget passed (one existing warning). Security advisors report intentional no-policy/server-only access for this table plus pre-existing unrelated notices.
- 2026-10-19 — Added the missing phone booking-delete button and labelled the desktop action, preserving the existing decided-booking restriction and permanent-delete warning. Added in-flight protection, progress feedback and network-error handling. No migration or change to emails/lead synchronization. Deployed to Vercel Production (`8e9d507`, Ready; custom-domain aliases verified). All 745 tests, TypeScript and lint budget passed (one existing warning); Chrome reached admin login, so no authenticated live deletion was performed and no real bookings were deleted.
- 2026-10-19 — Activated Google Sheets lead synchronization after owner authorization: two live runs succeeded, the five-minute time trigger was verified, and API access was checked (unauthenticated 401, scoped credential 200, 64 filtered source leads; the owner's working sheet retains 63 rows after manual deletions). Sync detects moved header rows, preserves original-import deletions, escapes formula-like values and appends new keys only. Replaced the periodic office CSV cron with the Google trigger; dashboard now shows sync active. No migration. Deployed and verified in Vercel Production (`a543eae`, initial feed `438450d`).
- 2026-10-19 — Added the private, paginated lead feed `/api/integrations/leads`, protected by a dedicated `LEADS_SHEETS_SYNC_SECRET`, and the bound Google Apps Script installer in `scripts/leads-sheet/`. It appends unseen customer leads every five minutes, preserves manual edits and uses a hidden ledger to avoid duplicates and restore-after-delete surprises. Excludes owner/internal names and test names in Hebrew/English. Script activation and two live executions must be verified before the integration is considered active; keep the CSV cron until then. No migration. Pending deployment and Google activation.
- 2026-10-19 — Made the installed SmartCar office app update itself after a deployment: the network-only admin service worker activates immediately, and the admin shell reloads only when a new worker takes control or iOS restores a backgrounded standalone window after one minute. It does not cache office/customer data and no longer requires removing and re-adding the home-screen shortcut. No migration. Pending deployment.
- 2026-10-19 — Replaced the inactive Google Sheets placeholder on the secured office dashboard with the live leads centre and a direct, labelled link to the SmartCar leads sheet. The dashboard makes clear that the sheet is for filtered customer leads while bookings continue to be managed in the office UI. No migration. Pending deployment.
- 2026-10-19 — Clarified booking-management actions on phone and desktop with purpose-specific colour treatments: green for WhatsApp, orange for handover inspection, teal for return inspection and approval, and red for refusal. Actions and underlying booking workflows are unchanged. No migration. Deployed to Vercel Production (commit `9ebd260`).
- 2026-10-19 — Kept the office-dashboard add-to-home-screen capability, but removed the visible install button and explanatory prompt from the dashboard. The network-only worker and public manifest remain in place; no private data is cached. No migration. Pending deployment.
- 2026-10-19 — Redesigned the secured office dashboard as a focused daily-action screen: operational header, primary rental-quote action, calmer statistics, direct quick actions and a clearer recent-booking list alongside a calendar-month chart. The chart now states that it measures bookings created per day and renders the actual 28–31 days of the selected month. No workflow or data change. Deployed to Vercel Production.
- 2026-10-19 — Refined the office admin navigation: larger, higher-contrast touch targets; the phone header puts the menu control before the SmartCar Admin title; and vehicle pricing was removed from the sidebar and made an in-context action inside vehicle management. No migration. Pending deployment.
- 2026-10-19 — Made the dark SmartCar dashboard green the shared visual anchor of the secured office application: desktop rail, phone header and drawer now use the branded surface; the admin workspace has a quiet branded background, teal focus treatment and consistent form accent. Customer-facing screens are intentionally unaffected. No migration. Pending deployment.
- 2026-10-19 — Strengthened the phone actions inside bookings and leasing requests: approval, refusal, WhatsApp, phone, refresh and inspection controls now have distinct, high-contrast branded treatments while retaining their existing behavior. No migration. Pending deployment.
- 2026-10-19 — Removed the office-dashboard booking chart and reserved its space for a future Google Sheets leads-and-phone-numbers connection. The screen explicitly shows that no Google connection is active, so no customer information is sent yet. No migration. Pending deployment.
- 2026-10-19 — Made the secured office dashboard (`/he/admin`) installable as a phone app and simplified its mobile navigation to Home, Bookings, rental quotation and “More”. The install worker is network-only and does not cache private office data. Bookings, vehicle management and leasing requests now use phone cards with their main actions in view. No migration. Deployed to Vercel Production.
- 2026-10-19 — Declared the SmartCar favicon files explicitly in metadata and regenerated them from the unchanged official SmartCar logo on a light background, so search results can display it clearly at small sizes. No migration. Deployed to Vercel Production.
- 2026-10-19 — WhatsApp bot hardening from a 100,000-message bank: corrected wrong published service answers (branches listed Haifa/Eilat; Friday hours 08:00–13:00 → owner-confirmed 08:30–14:00); dates like "מ5 בינואר" and date ranges are no longer read as places; locations are read from any clause of a long message; "תודה"/"סבבה" are no longer saved as the customer's name; questions mid-booking get the published answer instead of a vague sales line; complaints, refunds and call-back requests reach a person; misspelled emergencies are recognised while near-spellings ("תסלה") are checked with Gemini; "דחוף" alone no longer hands off; "are you a bot?" is answered; "nobody answers me" no longer gets a sales reply. No migration.
- 2026-10-19 — WhatsApp bot: relevance-based site knowledge for Gemini, retry on a busy model, Gemini answers take precedence over keyword routing for questions, English questions retrieve Hebrew site facts; simulator diagnostics header. Live sample of the question bank: nearly all answered correctly before the simulator's hourly limit. No migration.
- 2026-10-19 — WhatsApp bot answers any question from the whole published site (live page text + approved sources), with a guard against invented numbers or links; no longer asks for pickup/return times; small talk never hands off; policy questions about cancelling or changing are answered instead of escalated; "smoking"/"keys" questions no longer trigger roadside help. Added a ~2,400-question bank and runner. No migration.
- 2026-10-19 — WhatsApp bot: Gemini now extracts all rental details from free text (relative dates, times, group size → 7-seat category) and adds a short natural reply to side questions instead of "I did not recognise that"; removed the doubled opening line. The demo page is full-screen and usable on a phone. No migration.
- 2026-10-19 — Customer booking-received and booking-confirmed messages are now sent by Resend from server-rendered, branded Hebrew or English layouts based on the stored booking language (`consent_locale`); the confirmation has the correct WhatsApp deposit link. The office request copy remains on EmailJS. No migration. Deployed to Vercel Production.
- 2026-10-19 — Expanded the root README and this handbook into an operational map for people and future AI maintainers: booking and email ownership, source-of-truth language, safe real-email testing, production deployment/rollback, and required checks. No migration. Deployed to Vercel Production.
- 2026-10-19 — Verified the live customer email flow in Chrome with two labelled test requests to Ido's approved address: English request `#139964` arrived in English, and Hebrew request `#792898` arrived in Hebrew. The English confirmation email also displayed the correct WhatsApp deposit CTA and booking-number message. Test requests create real booking records; do not silently delete or alter them. No migration. Production verified.
- 2026-10-19 — Polished Hebrew customer email booking-detail rows: labels and values now use isolated RTL/LTR rendering so vehicle names, dates, locations, prices and booking numbers stay clean in Gmail; the Hebrew price label no longer adds parenthetical wording. No migration. Deployed to Vercel Production.
- 2026-10-19 — Replaced the Hebrew customer-email detail grid with a single-column summary: every label is followed by its own value, and pickup/return dates are separated from English location names. Customer price is now a clean amount under the “estimated total” label; the internal EmailJS office price copy is unchanged. No migration. Deployed to Vercel Production.
- 2026-10-19 — Added a durable, service-role-only Resend customer-booking email queue and daily retry sweep. After up to a week of failed retries, the office receives a PII-free manual-follow-up alert. Migration `add-booking-customer-email-outbox.sql` was applied in Supabase Production. Pending Vercel deployment.
- 2026-10-19 — Strengthened the dedicated Tel Aviv branch landing page for the commercial query “השכרת רכב בתל אביב”: added visible, accurate local rental FAQs, city service-area schema and a fresh, higher-priority Tel Aviv sitemap entry. This does not guarantee a ranking; request indexing for `/he/branches/telaviv` in Google Search Console after deployment. No migration. Deployed to Vercel Production (commit `d0dd990`).
- 2026-10-19 — Extended organic-search improvements across the national home page and every branch page. The homepage now targets “השכרת רכב בישראל”; branches use visible local rental FAQs (including Tel Aviv, Herzliya and Ben Gurion Airport), accurate service-area schema and refreshed sitemap signals. After deployment, request indexing for `/he`, `/he/branches/herzliya`, `/he/branches/telaviv` and `/he/branches/airport` in Google Search Console. No migration. Deployed to Vercel Production (commit `d0dd990`).
- 2026-10-19 — Corrected the sitemap freshness signal for every branch landing page after the shared location-page SEO copy and schema update, so Herzliya, Ben Gurion Airport and the other branches are not reported as unchanged since August. No migration. Deployed to Vercel Production (commit `550e86d`); live sitemap verified.
- 2026-10-15 — Audited WhatsApp integrations; added bounded Gemini intent extraction with deterministic fallback, safer webhook validation and group filtering, simulator limits and disclosure, and regression tests. Commit `02c932a`. No migration. Deployed to Vercel Production; Gemini routing and an unset-transport webhook rejection verified live. Real WhatsApp delivery remains unverified pending YCloud onboarding.
- 2026-10-15 — Documented Daniel's review gate and the current YCloud QR Coexistence steps, including phone-based human takeover and the remaining retry/alert checks. No code or migration; Meta and YCloud number remain unconnected.
- 2026-10-07 — Published the dedicated Google Drive OAuth client with limited `drive.file` access and moved new backups to `smartcar-backups-personal`. Updated the GitHub Actions secret and local rclone configuration. Verified a full backup in [run #84](https://github.com/idogoetha5/Smart-Car-WebSite/actions/runs/37609302421): encrypted database dump and 429 vehicle images (430 stored objects including manifest). Older archives preserved. Branch `clean-main`. No migration. Deployed.
- 2026-10-07 — Fixed the scheduled backup script path on the repository default branch `main` (commit `cf649d4`); manually verified database and storage backup in [run #83](https://github.com/idogoetha5/Smart-Car-WebSite/actions/runs/37595847840). No migration. Deployed.
- 2026-10-07 — Filter the Talisman browser extension onboarding error from client-side Sentry events; application errors remain reported. No migration. Deployed to production.
- 2026-10-06 — Set the public rental minimum age to 21 in Hebrew and English terms, FAQ, guide, new-driver service page, and automated service knowledge. Branch `clean-main`. No migration. Deployed to production.
- 2026-10-01 — Redesigned every manager surface (shell, login, today, alerts, calendar, fleet, drivers, documents and quote chooser) with a consistent desktop/mobile product UI, plus prominent full-width quick-action buttons and a final interaction polish for sheets, empty states, toasts, focus states and mobile navigation. Commits `017aef4`, `741eabc`, `ea50c0a`. Brand palette preserved; no workflow, feature or automation change. No migration. Deployed and verified live.
- 2026-10-01 — The SmartCar logo in the manager header now links to the manager's "Today" page on phone and desktop. Commit `33f8491`. No migration. Deployed.
- 2026-10-01 — Added the exact admin rental and leasing quote builders to the manager app, including branded WhatsApp delivery for both. Branch `clean-main`, commit `0baf851`. No migration. Deployed.
- 2026-10-01 — Cleanup: removed stale worktree `.worktrees/damage` and leftover bundle/patch files; lint and lint:budget pass locally. Deployed (docs only).
- 2026-10-01 — Separate driver/manager sessions (`manager_auth`). Fixes tasks not showing in the driver app after a manager login. Branch `fix/separate-sessions`, merge 828849a. No migration. Deployed.
- 2026-10-01 — Rental exceptions panel, fleet add/delete with test date and km, copy polish (Codex). Commits 65aad9e, 474da35. Migrations `add-rental-alert-reviews.sql`, `add-vehicle-fleet-details.sql`. Deployed.
- 2026-10-01 — Wash and car care as their own jobs, "משימה להיום", vehicles page, task-type notifications. Commit 8affa96. Migrations `add-service-tasks.sql`, `add-urgent-tasks.sql`. Deployed.
- Earlier (Sep 2026): driver app, inspections with signature and PDF, return comparison, manager app v2 (day board, calendar, search, reschedule), Web Push, brand redesign, urgent tasks, garage tasks.
