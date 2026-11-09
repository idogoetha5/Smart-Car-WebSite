# Chrome live — casual English tourist couple (2026-11-09, public 488bd06)

1. "hey do u rent cars to tourists? we land in tlv on the 20th" → yes, airport 24/7, documents; pickupDate 20/11 stored. Pass.
2. "cool. its me and my gf, staying a week, fly back from tlv too. something small is fine. my licence is from germany thats ok right?" → **local fallback dropped the licence question**; "me and my gf" not counted.
3. "the 27th i guess. but u didnt answer about my german licence lol" → return 27/11 stored; licence answered conditionally (IDP/translation may be required). Pass.
4. "yeah airport both ways. how much is the deposit btw" → deposit answered from approved facts, but **model said "Pickup and return at Ben Gurion Airport are set" while state had no locations** (said-but-not-saved).
5. "ok sounds good lets do it. im lukas, 29" → **FAILED**: intake not started (offer was "Would you like a price quote…?"), name and age not kept, asked pickup again.

Local repair: local fallbacks prepend the approved answer for direct policy questions (documents/insurance/deposit/age/fuel/mileage); foreign-licence topic and wider licence-assurance rejection; "me and my gf"/"אני ואשתי" = 2 travellers (not with a third person or hypotheticals); "airport both ways"/"pick up and return at X"/"לאסוף ולהחזיר ב…"/"… הלוך ושוב" store both legs for known branches; validator rejects "set/recorded/רשמתי" claims for routes or dates not in state; quote offers count as invitations; "im lukas, 29" captures name privately and the 24+ group once intake starts. Tests added.

## Second English couple on 2bb5906 (Sarah, Jerusalem)

1. "hi! me and my husband are coming to israel dec 3 for 10 days. need a car from jerusalem, nothing fancy" → passengers 2, 3/12–13/12, pickup jerusalem stored. Asked return place. Pass.
2. "back in jerusalem. is insurance included or do we need to buy extra?" → insurance answered, **return place not stored**.
3. "ok great. lets book it, I'm Sarah, 45" → intake started, name + 24+ kept (2bb5906 fix works), but asked "Where will you return it?" again.
4. "jerusalem, i said that already" → **FAILED: same question again** (loop).

Repair: a known-branch answer right after the return/pickup question is stored (explore or intake), lower-case branch names normalised. Tests added.

## Sarah replay on 3d8c3d0

- Turns 1–3: return place stored from "back in jerusalem"; turn 3 "ok great. lets book it, I'm Sarah, 45" → full correct summary immediately. Pass.
- "ok I confirm" → simulated submission (casual consent fix works live). Pass.
- "thanks! so is the car reserved now? and when will we hear back with the price" → **FAILED**: "What dates do you need the car?" (receipt context lost on a price question).
- "oh wait can we add a child seat? my niece might join for one day" → model: "We can add a child seat to your request" — implied editing a sent request.
Repair: receipt answers cover reserved/hold/hear-back and add that price and availability come with SmartCar's reply and nothing is charged before acceptance; post-submit additions/changes are passed to the team once with an honest "already sent" reply. Tests added.
