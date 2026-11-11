# Chrome live — casual Hebrew home delivery for a week (2026-11-11, public 8db0660)

1. "היי, אתם מביאים רכב עד הבית? אני ברמת גן" → delivery to an address by arrangement; asks car type and dates. Pass.
2. "אחלה. מיום ראשון הבא לשבוע בדיוק, קטן, אני לבד. ושיאספו אתו מהבית בסוף גם" → pickup 15/11, compact, 1 passenger stored; **return date not derived** from "לשבוע בדיוק"; delivery/collection location not stored; asked return date.
3. "יאללה. רוני בדיקה, בן 52" → **FAILED**: identical reply repeated; intake not started; name lost.

Repairs: exact trip lengths (לשבוע/לשבועיים/ל-N ימים/for a week/for N days) set the return date from a known pickup (approximate/hypothetical excluded); home delivery and collection are stored by city ("מסירה עד הבית (רמת גן)", "איסוף מהבית (רמת גן)"), never a street address; "יאללה." followed by a two-word name (optionally with age) starts the request. Tests added.
