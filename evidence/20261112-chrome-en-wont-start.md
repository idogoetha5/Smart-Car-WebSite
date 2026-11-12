# Live Chrome — English: rental won't start at a gas station (2026-11-12, public 300ed99)
1. "hey the rental wont start, just clicks when i turn the key. im at a gas station near haifa" → escalated with the number, but "do not continue driving" (the car is not moving).
2. "were ok, just stuck. will someone come?" → same generic line.
3. "booking 662310" → same generic line again.
Fixes (next release): stationary breakdowns (won't start, dead battery, flat tyre) get their own first message (stay somewhere safe, don't fix it yourself, call to arrange help); "will someone come?" gets an honest "cannot send help from this chat, call … they will arrange it"; a booking number is acknowledged and attached.

## Replay on eb9feb7
All three turns passed (stationary-breakdown wording, honest "cannot send help from this chat", reference acknowledged). A cancellation request in the same conversation then got the generic safety line → fixed (next release): during a safety handoff, a cancellation request is added to the message with the published tiers when a refund is asked.
