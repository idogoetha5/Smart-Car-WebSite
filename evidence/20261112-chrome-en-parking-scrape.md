# Live Chrome — English: rental scraped in a parking lot (2026-11-12, public 614fa1f)
1. "ugh someone scraped my rental in a parking lot in tel aviv, small dent on the rear door. nobody hurt" → **no handoff**; "report within one hour" without the number.
2. "do i have to pay for it?" → **"Yes … repair costs up to that excess amount are the renter's responsibility"** (liability decided in chat).
3. "can i keep driving it?" → generic "send the booking reference".
4. "ok thanks, my booking is 905512" → same generic line (reference not parsed).
Fixes (next release): "my rental" + scrape/dent is a damage report (handoff with the number, report-within-an-hour wording); validator `liability_claim`; "my booking is 905512" is a reference.
