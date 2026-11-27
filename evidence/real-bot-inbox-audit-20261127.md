# Real WhatsApp bot inbox audit — 27 November 2026

Scope: owner reported Coexistence/bot connection on Sunday 22 November at 23:20 Israel time. The authenticated SmartCar admin inbox in Chrome showed 28 conversation summaries. Its oldest visible conversation ended at 22:57 that Sunday, before activation. The inbox API selects the latest 500 messages, so this observation supports coverage of the bot's active period at the time of review. All 28 summaries were checked for bot messages; 16 threads contained a bot reply. Long threads were scrolled back to their earliest loaded messages. No message was sent to a customer. Customer names, numbers, and payment details are deliberately omitted here.

Findings from the 16 bot threads:

| Thread | Observed bot behaviour | Current assessment |
| --- | --- | --- |
| 1, leasing | Customer requested 36/48 months and 25,000/30,000 km per year; bot later treated 48/30,000 as selected. | Reproduced on current production in `adaptive-leasing-alternatives-20261127.json`; local repair preserves both alternatives and an undecided choice. Publication and fresh replay pending. |
| 2, rental extension | Direct requests to speak to someone received a generic greeting and then another permission question. | Needs current-production replay and repair if still present. |
| 3, BMW X1 airport rental | Customer requested BMW X1; bot later asked for car category. Coordinator and driver's different names were not clearly preserved in the handoff summary. | BMW memory repaired and live-retested on 27 Nov. Distinct driver/coordinator names remain to check. |
| 4, seven-seat rental | Reply `37` to driver's age question was interpreted as 37 passengers. Bot later asked car category again and dropped the requested hybrid minivan in the summary. | Needs current-production replay. A fresh live conversation stopped on its first turn because Gemini promised a dated seven-seater would be ready; local output guard added, publication and replay pending. |
| 5, existing rental | Bot sent media fallback for a non-text message; a representative then handled fuel, return place, and parking. | Human takeover was visible; no delivery or device receipt conclusion. |
| 6, current customer | Bot treated a short location update as a new rental enquiry and asked dates/category; a representative responded immediately. | Context mismatch to investigate; no customer-level action taken. |
| 7, monthly rental | Bot asked for a pickup date; representative took over before further bot turns. | No material bot failure established from this thread. |
| 8, luxury SUV rental | Bot offered the retired Highway 6 package, asked about extras again after `No`, and later gave a generic follow-up instead of answering an enlarged-vehicle question. | Highway 6 and extras regressions are already in current source; no fresh channel retest. Later advice quality remains open. |
| 9, luxury day rental | Repeated return place, driver age, and name questions; handoff summary omitted the luxury model preference. | Regressions and repairs previously recorded on 25 Nov; current live BMW preference replay is narrower. |
| 10, cheapest rental | Bot asked multiple intake questions, repeated the vehicle category after `cheapest`, misspelled a Hebrew acknowledgement, and drifted to `start a request?` after the customer gave a name. | Needs current-production replay and repair if still present. |
| 11, advance notice | Bot gave an unsourced `few hours in advance` assurance; next turn was a media fallback. | Check against approved service facts before treating as valid policy. |
| 12, completed rental payment | Customer asked for the exact final figure after return; bot gave generic rental pricing and deposit terms instead of clearly saying no final balance had been checked. | Needs current-production replay and repair if still present. |
| 13, contact question | `יוצרים קשר?` caused premature handoff and suppressed a later rental request. | Repaired with a two-turn regression on 24 Nov; current channel replay still useful. |
| 14, media only | Bot sent a text/media limitation reply. | No conversation-quality finding from the visible exchange. |
| 15, return parking | Repeated `איך אפשר לעזור לך היום?` instead of answering where to park. | Repaired with parking regressions on 24 Nov; current channel replay still useful. |
| 16, family rental | Bot skipped age intake after location and asked about additions twice after the customer requested a child seat. | Needs current-production replay and repair if still present. |

The admin inbox also displayed unmasked payment-card details in one unrelated message preview. They are not reproduced in this evidence. This is a privacy issue to address separately. Simulator handoff flags and `בדוק מסירה ללקוח` controls do not prove receipt on a customer's device or by Daniel.
