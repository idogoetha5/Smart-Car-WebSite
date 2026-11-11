# Chrome live — casual English leasing, relocated for work (2026-11-09, public a365bc0)

1. "hi, do you do leasing? relocated to israel for work, need a car for about 2 years" → leasing, 24 months. Pass.
2. "mostly city driving, maybe 12k km a year. budget around 3000 a month. is insurance included?" → **mileage not stored** (asked again); insurance answered with the **rental** cover text.
3. "actually make it 3 years if thats cheaper per month. and i only have a us licence, problem?" → model said it switched to 36 months, **state stayed 24**; licence answered conditionally.
4. "ok cool. can someone call me tomorrow with offers? what do you have on me so far" → **FAILED**: no handoff, recall ignored, asked kilometres again (loop).

Repairs: "maybe/around N km a year" stored (only if/what-if is hypothetical); explicit choice verbs ("make it 3 years") win over a trailing price condition; rental policy side-answers are never added to leasing/sale replies; "can someone call me", "אפשר שמישהו יתקשר אליי" escalate; "what do you have on me so far / מה רשמת" lists the saved enquiry, keeping the callback acknowledgement. Tests added.
