# Chrome live — casual Hebrew leasing for a self-employed driver (2026-11-09, public f7e6a5d)

1. "היי אני עצמאי ומחפש ליסינג לרכב לעבודה, ספק בן 3 שנים. עושה בערך 25 אלף קמ בשנה…" → leasing interest, 36 months, 25,000 km stored. Pass.
2. "מעדיף היברידי… תקציב עד 2500 בחודש. אולי אם אעלה ל3000…?" → budget 2,500 kept; hypothetical 3,000 did not overwrite (model wording merged them as "2,500 עד 3,000"). Pass with wording note.
3. "קומפקטי. אני לא רוצה שיתקשרו אליי עכשיו, רק תגיד מה בדרך כלל כלול בליסינג? ביטוח וטיפולים?" → conditional (only if in the offer/contract); no handoff. Pass.
4. "טוב אוקיי, שמישהו יחזור אליי מחר בבוקר. מה רשמת עליי?" → **FAILED**: no handoff; model claimed "המערכת תעביר את הבקשה לנציג שיחזור אליך מחר בבוקר" (false action + timing promise). Vehicle preference (compact hybrid) not in commercial memory.

Repair: explicit callback requests (שמישהו יחזור אליי, תחזרו אליי, call me back, have someone call me) escalate unless declined in the same message; the validator rejects wording that announces passing a case on or promises a call time. Tests added. Open: commercial vehicle preference "קומפקטי היברידי" not stored.
