# Live Chrome — English business trip to Jerusalem (2026-11-12, public dc37ef6)
1. "hi need a car in jerusalem for a work trip, mon nov 23 morning to wed nov 25, same place" → dates stored, but Jerusalem and "same place" not stored (asked "Where would you like to pick it up?").
2. "nothing fancy. can i get an invoice for my company?" → **"Yes, we can issue an invoice for your company"** (unverified promise); vehicle not stored.
3. "great, book it. mark stein, 45, mark.stein@example.com" → intake did not start.
Fixes (next release): "car in <branch>" = pickup, "same place" = return; weekday/time-of-day words inside English date ranges; "nothing fancy"/"basic" = compact even before a question; validator `invoice_claim` (company-invoice note from the application instead); "great, book it. <first last>, …" starts intake.
