# SmartCar bot — launch acceptance ledger

26 Oct 2026 update: the rebuilt core and fictional production demo pass a scripted completed rental flow. A durable message journal and operator email fallback are published, with the journal migration applied. The owner's first unscripted live conversation then exposed repeated consent questions, an unnecessary pickup-hour question, and repeated questions for supplied details. The core now moves a clear “yes” into deterministic intake, blocks hour questions, captures short date/location replies, and has a full guided-request regression. The owner requires preconnection conversation acceptance before any YCloud onboarding; the live number remains unconnected and the kill switch is OFF. A green simulated suite cannot prove flawless free-form conversation, real YCloud delivery or phone echo; these remain explicit gates.

Updated 2026-10-23. Source: complete canonical checkout and latest fetched `origin/clean-main`. This ledger is a release gate, not a promise of perfect understanding or zero outages. A green unit suite is not evidence of real WhatsApp delivery.

| Requirement | Current evidence | State / remaining acceptance |
| --- | --- | --- |
| Natural Hebrew/English, advice vs comparison vs preparation, one useful question | Original bilingual academy, 3,072 synthetic teaching variants; prior live transcripts and UI check in incident report | Published baseline checked for selected scenarios. Expand independent multi-turn scenarios and manually read every reply; do not present generated variants as thousands of books/articles. |
| No unsolicited catalogue dump, long offer links or unnecessary name collection | Advice purpose bypass and live refusal/advice examples | Selected live scenarios pass, broad dialogue gate still open. Prices/availability must remain grounded and final consent deterministic. |
| Keep context, corrections, refusal, changed priorities, scoped forgetting vs reset | Structured facts, cumulative memory, retained archive; new local bounded older-customer quote retrieval and per-field forget boundaries | Unit seeded1020-history evidence and selected live short-dialogue evidence, not proof of recall of every fact after1020real model turns. New retrieval still needs staged/live verification. |
| Gemini outage → backup → recovery, owner notification | Circuit timeout/cooldown, published outage/recovery hooks | Code published; real email acceptance/inbox receipt still unverified. Owner destination approved: ido.goetha5@gmail.com. |
| Durable inbound/reply processing, restart recovery, dedup and concurrent messages | Inbound log has provider-ID uniqueness; known duplicate retry returns early | **Launch blocker:** persist processing/reply state and recovery queue. Never blindly resend after ambiguous provider timeout. Verify provider reconciliation/idempotency rather than assuming `externalId` prevents duplicates. |
| Human takeover, clear explicit resume, phone echo mirrored in admin | Existing human-reply log, filtered 24-hour silence query, YCloud echo boundary tests | Partial implementation. Explicit operator control/resume, failure-safe handoff and real phone echo/silence test remain open. |
| All archived messages visible, latest messages update, phone-friendly UI | Published cursor API/feed; local actual API/UI displayed1020 fictional rows and1370 after burst. Latest360px interactive test loaded all1020 with no overflow and44pxsend, preserving the accepted-send warning | Thread pagination published. Full conversation-list discovery is still capped at500messages and media is missing. New accepted/unlogged-send UI increment is local until next release. No claim of real phone echo/delivery. |
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

Later direct local-app360px rehearsal supersedes the earlier iframe limitation:
actual Next/API/UI loaded all1020 fictional messages interactively with no
horizontal overflow; send button44px. A server-only fake provider accepted the
send while fake history persistence failed. API returned200/historySynced=false;
UI cleared draft and warned not to resend. External network was blocked in the
local server and all secrets/data were fictional. Screenshot retained outside
release tree: outputs/inbox-accepted-unlogged-mobile.png. This does not prove
real provider delivery, durable processing or persistent human ownership.

`whatsapp-thread-feed.ts` keeps a per-mounted-phone in-memory view of already loaded database messages (not a persistence substitute). Latest-window opening, identity-ID before/after cursors and bounded multi-page forward polling prevent the oldest-200 bug and skipped bursts; loading old pages does not delete newer loaded rows. The authenticated API retains existing admin/inbox scope and returns private/no-store responses. Draft text is scoped to its phone, retained on failed/uncertain send and disabled during an in-flight send; it never retries a send automatically. A refresh error after a positively acknowledged send must not invite another send.

API/feed test evidence: `src/app/api/admin/whatsapp/conversations/[phone]/route.test.ts`, `src/lib/__tests__/whatsapp-thread-feed.test.ts`. Browser rehearsal used an isolated loopback fake PostgREST server, fake signing secret and 1,020 synthetic messages, with actual Next/API/UI code. No real database access or customer send. Full suite passed 1,065 tests before the final draft-scoping/scroll refinements; repeat required before commit/release. Desktop screenshot is retained in this task's outputs as `thread-history-1370-local.png`. The phone fixture is not yet an interaction pass and does not replace actual phone checks.
