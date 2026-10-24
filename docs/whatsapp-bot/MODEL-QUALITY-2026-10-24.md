# Model-quality review — in progress

The customer model is still a single `gemini-3.5-flash-lite`. Published progress
and original coaching have not established the full conversational acceptance
gate. No model weights were trained and no claim of reading whole commercial
books is made.

Actual fictional multi-turn reviews caught: accidental foreign-script characters
inside Hebrew words, an English correction answered in Hebrew, unsupported cargo
fit and monthly-exit assumptions, and date collection while merely comparing.
Controller failures also replaced valid model replies or mistook advice correction
for editing stored facts. Preserved controller fixes are integrated on latest
production source; invalid-language output gets at most one same-model content
repair, with the remaining generation budget. Provider failures and customer
messages/actions are not automatically retried by that repair.

Two recent candidate retests answered the cargo and cover corrections usefully.
The business correction still failed language validation and fell back to an
irrelevant leasing policy before the new repair. It is a failure, not a pass.
The source task's `outputs/live-coaching-*.json` retains both raw interpretation
and final replies. Seeded historical entries are never counted as model turns.

## Private comparison, not a customer-model switch

Google describes [Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite)
as optimised for economical high-volume execution and lists
[Gemini 3.8 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash)
as its more capable Flash model. That does not itself prove better Hebrew service.
Compare real adaptive replies, latency and token use before selecting a model.

`/he/admin/bot-evaluation` uses a full-admin-only endpoint with a fixed
Gemini3.8Flash override scoped to that asynchronous request. Public model headers,
the customer model and all WhatsApp transport settings stay unchanged. The same
isolated simulator flow creates no real customer request/message. The endpoint
adds a12/hour limit using existing distributed-or-instance limiter semantics;
this is not a new billing cap. Payload is bounded256KB, thinking is low, and
numeric usage is reported where provided. Experimental failures do not emit
production model-outage emails. No new provider key or service purchase is needed.

Published [Google pricing](https://ai.google.dev/gemini-api/docs/pricing), checked
October24: Gemini3.8Flash standard input$0.75/million and output$3.75/million
through December31,2026, then$1.50/$7.50. FlashLite input$0.30/output$2.50.
Any cost estimate must use actual token counts, including thinking where charged,
and distinguish estimated uncached cost from an invoice. No comparison result or
default-model change is claimed yet.

## Remaining gates

- At least24 complete independent6–10turn real-model dialogues, read end-to-end,
  covering all actual website entry builders and service/readiness cases.
- Repeat observed failures on the exact rebuilt candidate, not only mock responses.
- Actual model failure/backup/recovery behaviour and honest escalation outcomes.
- Durable processing, idempotent business actions and sends, explicit operator
  ownership/resume, all-conversation discovery and media/history handling.
- Independent monitoring; the current email test receipt is verified, but a site
  cannot detect its own complete outage.
- Daniel's phone coexistence approval remains a separate final external gate;
  customer WhatsApp must not be activated silently.
