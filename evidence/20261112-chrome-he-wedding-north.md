# Live Chrome — Hebrew, casual: car for a brother's wedding up north (2026-11-12, public 87253b8)
1. "הייי מה קורה😊 … לחתונה של אחי בצפון … אנחנו 4 + תיק כל אחד. בערך מה 17 לחודש הבא עד ה 20, אוסף מת"א" → dates and 4 people stored; the reply said "נרשם איסוף מתל אביב" but **the pickup was not stored** ("ת"א" not read); awkward "איזו חזרת סניף תרצו להגדיר?".
2. "רגע לא, עדיף מה 18. וזה יוצא יקר?" → pickup date corrected to 18; **no price line**, and asked "מאיפה תרצו לאסוף" again.
Fixes (next release): ת"א / ת״א / תא / י-ם / TLV abbreviations expanded for location parsing; "יוצא יקר?" / "יקר?" trigger the owner price line.

## Replay on c7ca250
Price line now given; return "בת"א" read. Still: the first message's "מה 17 לחודש הבא עד ה 20" was not parsed locally (asked for dates), the model stored the pickup as the raw "ת"א", and "סבבה תרשום על שם אלון ברק, אני 29" did not start intake.
Fixes (next release): "D לחודש הבא עד D" / "D עד D לחודש הבא"; stored abbreviations expanded to the branch name; "תרשום על שם <name>" / "book it under <name>" start intake and give the name.
