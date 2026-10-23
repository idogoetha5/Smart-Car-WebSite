# Live coaching review — 2026-10-23

## Combined progress published, further adaptive defects retained

Protected PR2 merged as29fa24e, production dpl_7oTxkrA3iNMa7duCZzjGg3fYeoNz
READY on both domains. Exact candidate5039ef3: notification refusal answered
directly without phone/URL/catalogue, airport1am advice stayed autonomous.
Leasing dialogue retained25,000km, calculator estimate vs budget, flexibility;
changing only model preserved other facts. One answer inferred long trips from
mileage: quality issue, not verified customer fact. Actual public Gemini advice
also returned without catalogue or rental action. These are selected examples,
not completed24-dialogue acceptance or weight training.

Next adaptive turns exposed two controller failures on the candidate: requesting
the office number (contactInformationRequested=true, correct Gemini answer) was
replaced by the active sales catalogue; Hebrew ובלי להעביר לנציג still triggered
handoff despite Gemini policy/explanation. Both exact regressions now have local
fixes. They require rebuilt live retests; do not silently count failures as passes.

## Progress release and newly identified controller failures

Progress `8a942ab` is published as `dpl_7WZjgceTY8qXBsP3M1nuZsDxz5v4` on both
custom domains. GitHub CI39965483083 verify/audit completed successfully.
Production-config candidate and public-domain checks read 172 cars, X2
display850/floor950, three distributed exact gallery samples and HE/EN pages.
The public simulator returned Gemini; transport remains unconnected/off.

These subsequent baseline dialogues exposed failures beyond prompt wording:

- Fleet-sale notification follow-up: Gemini correctly said no automatic signup
  existed, but the car-sale controller replaced it with a price/spec catalogue.
  Local fix: explicit semantic notificationRequest channel; retain the model's
  answer without inventory reads, transaction creation or losing selected-car data.
- Personal deposit complaint: Gemini returned intent representative + purpose
  complaint, but the FAQ shortcut returned its text with escalated=false. Local
  fix: contact-information-only exemption must not swallow real staff intents.
  Regression asserts handedOff and escalate=true; ordinary phone inquiry stays
  autonomous. Present-tense unsupported outreach claims are filtered as well.
- Leasing correction: customer wrote 25 אלף; Gemini correctly answered 25,000,
  retained corrected mileage and distinguished calculator estimate from budget.
  Numeric guard rejected the equivalent quantity and triggered a legacy fallback
  (including unsupported included-maintenance wording) and an unrelated passenger
  question. Local fix: derive exact thousand-unit equivalences only from supplied
  evidence, never generated memory; retain the useful model reply. Backup now
  describes contractual checks without inventing inclusions, quote preparation,
  repeated multi-field questions or a maximum package fitting excessive mileage.

Focused code tests are not conversational-quality evidence. New fixes/controlling
service charter still require live candidate retests and unseen scenarios. Live
baseline transcripts are retained fully in task outputs; no customer data used.
Do not represent the original four-turn review below as the complete test corpus.

Isolated live Gemini simulator dialogues, NOT customer conversations. All four
reported turns returned source `gemini`, model `gemini-3.5-flash-lite`. No WhatsApp
message, booking or subscription created. Full fictional transcripts are in the
task workspace outputs/live-coaching-family.json and live-coaching-sale.json.

## Family / taxi comparison: three adaptive turns

Customer asked whether to rent or use taxis, mentioning a baby and deposit worry.
Reply called rental generally better value and the deposit 'בסך הכל ביטחון'.
Failure: comparison without route/cost evidence; minimisation of credit impact.
The customer clarified two Tel Aviv trips and credit limit, not budget. Gemini
then recommended taxis/public transport without pressure. After declining rental
and requesting recall, Gemini correctly retained couple+baby, Tel Aviv and
credit-limit concern. This is evidence for this dialogue, not universal memory.

## Fleet-sale website entry: one English turn

Actual entry text: Hello, I’m interested in buying a car from your fleet. Please
notify me when cars become available.

Reply described occasional fleet sales and redirected to sales page/telephone.
Failure: did not answer whether notification signup was possible. No false signup
claim. Follow-up remains open.

## Changes and evidence boundaries

FINAL_REPLY_COACHING now explicitly addresses credit-hold minimisation, premature
taxi cost comparisons, editable website messages, estimates vs binding quotes,
enquiry vs booking, notification requests vs completed subscriptions, and booking
reference vs authentication. These changes are LOCAL, not yet live-verified.
Do not report them as demonstrated improvements or completed release.

Runtime connection verified: whatsapp-gemini.ts includes SALES_SERVICE_CURRICULUM,
FINAL_REPLY_COACHING and getConversationAcademy in provider systemInstruction.
This is inference guidance, not Gemini weight training.

Read the body (steps 1–6) of
https://business.gov.au/people/customers/handle-customer-complaints on 2026-10-23.
Original coaching adaptations: address actual concerns, retain commitments,
do not invent follow-up. Australian law is NOT imported as SmartCar policy.

Next: complete actual website entry inventory and edited variants; finish live
adaptive dialogues; verify revised coaching on unseen scenarios; preserve the
whole website through release gates. Technical pagination tests are NOT evidence
of conversational quality.
