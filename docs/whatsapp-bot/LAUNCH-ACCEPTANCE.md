# SmartCar bot — launch acceptance ledger

Updated 2026-10-23. Source: complete canonical checkout and latest fetched `origin/clean-main`. This ledger is a release gate, not a promise of perfect understanding or zero outages. A green unit suite is not evidence of real WhatsApp delivery.

| Requirement | Current evidence | State / remaining acceptance |
| --- | --- | --- |
| Natural Hebrew/English, advice vs comparison vs preparation, one useful question | Original bilingual academy, 3,072 synthetic teaching variants; prior live transcripts and UI check in incident report | Published baseline checked for selected scenarios. Expand independent multi-turn scenarios and manually read every reply; do not present generated variants as thousands of books/articles. |
| No unsolicited catalogue dump, long offer links or unnecessary name collection | Advice purpose bypass and live refusal/advice examples | Selected live scenarios pass, broad dialogue gate still open. Prices/availability must remain grounded and final consent deterministic. |
| Keep context, corrections, refusal, changed priorities, scoped forgetting vs reset | Structured facts, cumulative memory and archived history; draft/date/recall tests | Unit and selected live evidence, not proof of recall of every fact after 1,020 real model turns. Assess long-context summaries and restart persistence. |
| Gemini outage → backup → recovery, owner notification | Circuit timeout/cooldown, new outage/recovery regression on branch `codex/bot-recovery-alerts` | Local tested, not yet published. Real email acceptance/inbox receipt still unverified. Owner destination approved: ido.goetha5@gmail.com. |
| Durable inbound/reply processing, restart recovery, dedup and concurrent messages | Inbound log has provider-ID uniqueness; known duplicate retry returns early | **Launch blocker:** persist processing/reply state and recovery queue. Never blindly resend after ambiguous provider timeout. Verify provider reconciliation/idempotency rather than assuming `externalId` prevents duplicates. |
| Human takeover, clear explicit resume, phone echo mirrored in admin | Existing human-reply log, filtered 24-hour silence query, YCloud echo boundary tests | Partial implementation. Explicit operator control/resume, failure-safe handoff and real phone echo/silence test remain open. |
| All archived messages visible, latest messages update, phone-friendly UI | Local cursor API/feed: 15 tests; real local API → browser displayed 1,020 fictional rows and retained all 1,370 after a 350-message burst; failed send retained draft | Local thread fix not published. Full conversation-list discovery is still capped at 500 messages, and media is still missing. 360px fixture shows layout, but interactive mobile verification remains open. |
| Media/history sync handled without silent loss | Non-text currently becomes a placeholder; history events acknowledged only | **Open:** preserve actual type/metadata safely, protected media access, honest unsupported-type handling; verify provider payloads and sync. |
| Independent outage monitoring and automatic incident escalation | Existing Sentry plus in-process incident email | **Open:** a site cannot detect its own complete outage. Configure an independent monitor and verify real alert paths, without unapproved purchases/access changes. |
| Preserve entire production site | Complete baseline, 716 file paths/234 checksums and live gallery/X2/GSC evidence | Mandatory preflight, fresh full diff, tests/type/lint/security, build and staged/live verification before any publication. Never deploy old partial export/quarantine. |
| Official WhatsApp coexistence on Daniel's active 09-9509757 | YCloud account exists; no linked number/transport established | **External final gate:** Daniel's phone approval/QR and terms; do not migrate/delete Business app or enable customer traffic before non-phone gates pass. |

## Verification boundaries

- Simulator tests do not send customers messages or establish a WhatsApp connection. Use fictional details only.
- Retry/recovery tests must inject failures before/after persistence and provider acceptance, not just mock the happy path. Observe stale leases and concurrent workers.
- An accepted email is not proven inbox delivery; a successful text response is not proof every service recovered.
- Keep transport/customer activation off during preparation. Published progress must distinguish from local work and externally blocked activation.
- No new paid services, permission expansions, intentional feature removal or rollback without the appropriate owner approval.

## 2026-10-23 — local thread archive increment

`whatsapp-thread-feed.ts` keeps a per-mounted-phone in-memory view of already loaded database messages (not a persistence substitute). Latest-window opening, identity-ID before/after cursors and bounded multi-page forward polling prevent the oldest-200 bug and skipped bursts; loading old pages does not delete newer loaded rows. The authenticated API retains existing admin/inbox scope and returns private/no-store responses. Draft text is scoped to its phone, retained on failed/uncertain send and disabled during an in-flight send; it never retries a send automatically. A refresh error after a positively acknowledged send must not invite another send.

API/feed test evidence: `src/app/api/admin/whatsapp/conversations/[phone]/route.test.ts`, `src/lib/__tests__/whatsapp-thread-feed.test.ts`. Browser rehearsal used an isolated loopback fake PostgREST server, fake signing secret and 1,020 synthetic messages, with actual Next/API/UI code. No real database access or customer send. Full suite passed 1,065 tests before the final draft-scoping/scroll refinements; repeat required before commit/release. Desktop screenshot is retained in this task's outputs as `thread-history-1370-local.png`. The phone fixture is not yet an interaction pass and does not replace actual phone checks.
