# Office mobile upgrade — approved scope (19 October 2026)

Owner approved the 40-item research proposal, with these binding exceptions:
- Item 19 (today/tomorrow delivery/return dashboard) is NOT approved. Do not add it or restore the booking graph.
- Item 22 (responsible staff member and follow-up reminder) applies ONLY to contact-form enquiries for now. Bot/human-handoff enquiries may be added later; no bot activation is authorized by this UI task.
- Item 3 must preserve the current mobile booking cards and their visible actions. Tapping the summary opens complete details; it does not replace the list with a new layout.
- Keep the established navigation order, official logo, dark teal brand, add-to-home-screen support and automatic deployment updates. No install-explanation button. No printed QR/link changes.
- Progressive disclosure: advanced tools in details/sheets, not a wall of new controls. No automatic external messages, payment charging or price publication without the representative's action.

## Delivery checklist

This is a phased programme, not a claim that every item is already implemented.

| Items | Scope | State |
|---|---|---|
| 1–2 | Persistent rental/leasing drafts; update without losing typing | Implemented; lifecycle interaction tests passed; device QA pending |
| 3 | Complete booking sheet, retain phone cards | Implemented; touch interaction tests passed; visual QA pending |
| 4–5 | Phone/reference search, status and explicit date filters | Implemented, including saved search/filter/scroll context |
| 6 | Accurate approval/email result, in-flight protection | Implemented; tests cover false mail result, duplicate taps and rejection version race |
| 7–8 | Compact quotation stages and reachable summary/send controls | Pending |
| 9–14 | Unified quote history, customer fill, clone/version, templates, pre-send review, conversion | Pending |
| 15–18 | Action dashboard, correct metric definitions, actionable summaries | Metric labels, missing-data handling, pending-booking action and linked recent bookings implemented; broader action centre pending |
| 19 | Today/tomorrow operations summary | Excluded by owner |
| 20–21 | Unified customer context and in-admin leads | In-admin leads implemented; unified customer/quote context pending |
| 22 | Contact-form enquiries ONLY: owner/reminder | Implemented as in-app due list, status, owner label and internal note; no automatic customer messages or push alerts |
| 23–25 | Linked repeat enquiries, contextual WhatsApp, actual sheet health | Pending |
| 26–31 | Catalogue/fleet distinction, mobile pricing, price preview, fleet context, leasing/sales and documents/reviews | Pending |
| 32–37 | Consistent brand/type, touch sizing, return context, sheets/toasts, network/keyboard recovery | In progress on booking/draft flows; remaining screens pending |
| 38 | Recoverable archive before permanent deletion | Pending schema/API work |
| 39 | Individual office identities, permissions and audit trail | Pending identity/onboarding design; do not invent user credentials |
| 40 | Isolated test workflow and targeted operational monitoring | Pending |

## Acceptance

At 360px and larger: no horizontal page scroll; primary touch controls ≥44px; booking card action positions retained; complete readable detail values; keyboard and safe-area clearance. Test restore after reload/background, exact email outcomes, failed network, duplicate taps, filter/search persistence and existing customer/office mail behavior. Never test by modifying genuine customer bookings. No driver/manager UI redesign in this phase.

## Verification record for first increment

- 794 unit/component tests pass, including actual DOM click flows in an isolated Happy DOM test environment (dev dependency pinned to 21.0.3). TypeScript and lint budget pass; one existing lint warning remains.
- No public test/review route was added. A proposed temporary unauthenticated review route was rejected by the safety review and was not written; replaced with isolated component tests. Real production customer records were not modified for UI tests.
- `20261019182757_contact_lead_followup.sql` applied in Production. Transactional insert/update/stale-version checks rolled back cleanly; table remains empty after verification. RLS enabled; anon/authenticated cannot read, service role can update. The existing lead export and customer-form insert do not read this internal table.
- Supabase security advisors: new table's no-policy INFO is intentional service-role-only access. Existing unrelated function/search-path/password advisories remain; see [security-definer checks](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) and [search-path checks](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable).
- Dependency audit reports 23 advisories in existing packages (19 high, 4 moderate; no happy-dom advisory). Review in a separate compatible dependency-upgrade increment; do not apply suggested major downgrades or `audit fix --force` to Next.js/PDF tooling blindly.
- First increment deployed to Vercel Production (`aeca885`, Ready). Signed-in Chrome checked at 360px: dashboard, preserved booking cards, detail sheet with fixed actions while scrolling, readable addresses/dates/extras and collapsed date/status filter. Lead list loaded from the authenticated API; a contact-form detail exposes the intended owner/status/Israel-time/note fields. No genuine customer record was changed or external message sent.
- Dashboard has separate direct links to the in-admin leads workspace and the existing Google sheet, stacked full-width on phones and side-by-side on larger screens.
