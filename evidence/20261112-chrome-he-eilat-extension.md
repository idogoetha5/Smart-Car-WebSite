# Live Chrome — Hebrew: extension from Eilat with a fuel question (2026-11-12, public e19c057)
1. "היי אני עם הרכב שלכם עכשיו באילת, אפשר להחזיר אותו בעוד יומיים במקום מחר?" → extension needs availability and confirmation; original return binding; offer to check (correct).
2. "ואם אני מחזיר בלי דלק מלא מה קורה?" → published full-to-full fuel policy (correct).
3. "כן תבדקו לי, הזמנה 771204" → escalated, but as a generic "נציג יבדוק את המקרה", not the extension request.
Fixes (next release): an offer up to three bot turns back counts when the customer says "כן תבדקו לי"; "אני עם הרכב שלכם" enters the service flow locally; "להחזיר … בעוד יומיים במקום מחר" counts as a change discussion.

## Replay on 73c158b
Turn 1 now handled locally with a cold "אפשר לברר על הארכה בלי להגיש בקשת שינוי" (no offer), and "כן תבדקו לי, הזמנה 771204" was still not taken as the request (the bot asked again). Fixed (next release): the local extension answer ends with "תרצו שנבדוק את ההארכה עבורכם?", and "תבדקו לי" after an extension question counts as the request even without an explicit offer.
