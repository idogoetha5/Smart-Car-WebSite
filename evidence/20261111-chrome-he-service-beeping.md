# Live Chrome — Hebrew service: beeping rental (2026-11-11, public 36b92c8)
1. "היי לקחתי מכם רכב אתמול בהרצליה, הוא מצפצף כל פעם שאני נוסע מעל 90, זה תקין?" → speculative technical wording ("עשוי להיות התראה מובנית"), "ליצור קשר עם מוקד השירות" without the number, vague "איך תרצו להמשיך?".
2. "הזמנה 884512" → escalated with the office number.
Fix (next release): beeps and strange noises from a rental (not brakes/steering/smoke, which stay on the safety path) are handled like the owner's warning-light rule: immediate representative handoff with the office number, no technical advice. "ליצור/צרו קשר עם מוקד/המשרד/הסניף" now gets the office number appended. To confirm with the owner: beeps/noises treated like a warning light.

## Replay on a503373
Beep → immediate handoff with the number (fix confirmed), but the text said "נורת אזהרה". "אפשר להחליף לי רכב?" and "הזמנה 884512" both got the same generic "תודה על העדכון".
Fix (next release): beep/noise-specific handoff text; after a service handoff a replacement-car ask gets an honest "the representative checks it, no promise here" answer, and a booking number is acknowledged and attached (`serviceReference`).
