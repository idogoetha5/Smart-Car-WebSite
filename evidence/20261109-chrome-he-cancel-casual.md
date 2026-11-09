# Chrome live — casual Hebrew cancellation (2026-11-09, public f65ac21)

1. "היי הזמנתי אצלכם רכב לסופש אבל יש לנו בלאגן במשפחה וכנראה לא נסע. כמה זה עולה לבטל?" → cancellation tiers from terms; asks booking number. Pass (no empathy for the family situation; "מדיניות הביטוח וההשכרה" odd).
2. "וואלה. טוב בואו נבטל, מספר הזמנה 552211. האיסוף היה בשישי. הכסף חוזר לאשראי?" → **FAILED**: not recognised as a cancellation decision; no review queued; reference saved.
3. "אז זה מבוטל עכשיו? אני צריכה לדעת שלא יחייבו אותי" → says nothing is cancelled automatically, but no path to a person; garbled Hebrew "מועד הביטוח וההשכרה והמועד שבו תפנו…".

Repair: everyday decisions (בואו נבטל, תבטלו לי, let's cancel it, cancel it) queue the cancellation for review; questions ("אם נבטל…?", "what happens if we cancel it?") stay advisory. Tests added. Hebrew model wording quality remains open.

## Recheck on eaf4a5b
- "שלום, יש לי הזמנה לשבוע הבא אבל הטיול בוטל. תבטלו לי בבקשה, מספר הזמנה 778190" → cancellation queued once, reference kept, not confirmed. Pass; but reply said "ולא שינוי תאריכים" because "הטיול בוטל" matched a status pattern.
- "וכמה מהכסף אקבל בחזרה? זה עוד שבוע" → generic reply, refund question unanswered.
Repair: status wording only for real status questions; refund wording (בחזרה/הכסף חוזר/get my money back) answered with the published cancellation tiers and an explicit not-automatic/representative-confirms clause. One older test updated to accept the more specific conditional wording.
