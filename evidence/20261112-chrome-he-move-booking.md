# Live Chrome — Hebrew: move an upcoming booking (2026-11-12, public f04f261)
1. "היי יש לי הזמנה לשבוע הבא, אפשר להזיז אותה ביומיים?" → extension wording ("before the original return"), not the pre-pickup date-change rule.
2. "מספר הזמנה 556120" → "shall we pass it on?" again.
3. "במקום ראשון שיהיה שלישי, אותו מספר ימים" → "נעדכן את הבקשה" (claim) and the same question again; no handoff.
4. "ויש על זה תשלום?" → published rule (free up to 48h before pickup, subject to availability) — correct.
Fixes (next release): "יש לי הזמנה / I have a booking" enters the service flow; moving an upcoming booking gets the published 48-hour rule and asks for the reference and new dates (application wording, `policyLocked` so the model cannot replace it); a concrete new date ("במקום ראשון שיהיה שלישי") is a change request and hands off; validator rejects "נעדכן/שינינו את הבקשה".

## Replay on d9ac586
Move story passed: 48h rule + reference + new date → handoff with the number. Remaining: "ויש על זה תשלום?" after the handoff spoke about "the existing return date". Fixed (next release): the 48h free date-change rule is repeated, with a representative confirming any price difference.

## English cancellation on d9ac586
"need to cancel my car booking for this saturday. do i get my money back?" → published tiers (correct). "ref 440871" → model asked "note this cancellation for review?" (no handoff). "how long until the refund comes through?" → invented "within a few business days".
Fixed (next release): "my car booking" enters the service flow and counts as a cancellation request; "ref 440871" is a reference; validator `refund_timing` rejects unpublished refund timing.
