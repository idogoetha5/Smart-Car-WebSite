# Live Chrome — Hebrew: home delivery to Petah Tikva (2026-11-12, public b1c2b59)
1. "היי, אפשר שתביאו לי רכב הביתה לפתח תקווה? מ-3.12 עד 7.12" → dates stored, but asked "מאיפה תרצו לאסוף את הרכב?" (home delivery not recognised).
2. "יש לי רק כרטיס דביט, זה בסדר?" → credit card in the renter's name, debit not accepted (published, correct).
3. "ומה הביטוח כולל?" → published basic cover with excess (correct).
Fix (next release): "תביאו לי רכב הביתה ל<city>" = home delivery with the city.

## Replay on 8600d7d
Home delivery to Petah Tikva recognised (fix confirmed), collection from home stored. "רכב קטן, אני לבד. תפתח בקשה, רינה שמש בת 35" → asked for the name (the "תפתח בקשה" clause was picked and rejected instead of the name). Model wrote "בתואֵם מראש" (vowel mark, wrong word).
Fixes (next release): the first valid two-word clause is the name; vowel marks removed from model wording and "בתואם מראש" → "בתיאום מראש".

## Replay on fa2994f
Full flow passed: home delivery and home collection (Petah Tikva), compact, 1 passenger, 24+, רינה שמש → summary → "אני מאשרת" → simulation receipt → follow-up answered without promising times. Remaining: the turn adding home collection got a generic vehicle paragraph. Fixed (next release): it now says the collection was noted and asks for the car.
