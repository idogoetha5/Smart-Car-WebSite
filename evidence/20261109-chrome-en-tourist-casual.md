# Chrome live — casual English tourist couple (2026-11-09, public 488bd06)

1. "hey do u rent cars to tourists? we land in tlv on the 20th" → yes, airport 24/7, documents; pickupDate 20/11 stored. Pass.
2. "cool. its me and my gf, staying a week, fly back from tlv too. something small is fine. my licence is from germany thats ok right?" → **local fallback dropped the licence question**; "me and my gf" not counted.
3. "the 27th i guess. but u didnt answer about my german licence lol" → return 27/11 stored; licence answered conditionally (IDP/translation may be required). Pass.
4. "yeah airport both ways. how much is the deposit btw" → deposit answered from approved facts, but **model said "Pickup and return at Ben Gurion Airport are set" while state had no locations** (said-but-not-saved).
5. "ok sounds good lets do it. im lukas, 29" → **FAILED**: intake not started (offer was "Would you like a price quote…?"), name and age not kept, asked pickup again.

Local repair: local fallbacks prepend the approved answer for direct policy questions (documents/insurance/deposit/age/fuel/mileage); foreign-licence topic and wider licence-assurance rejection; "me and my gf"/"אני ואשתי" = 2 travellers (not with a third person or hypotheticals); "airport both ways"/"pick up and return at X"/"לאסוף ולהחזיר ב…"/"… הלוך ושוב" store both legs for known branches; validator rejects "set/recorded/רשמתי" claims for routes or dates not in state; quote offers count as invitations; "im lukas, 29" captures name privately and the 24+ group once intake starts. Tests added.
