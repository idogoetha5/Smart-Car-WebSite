# Live coaching review — 2026-10-23

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
