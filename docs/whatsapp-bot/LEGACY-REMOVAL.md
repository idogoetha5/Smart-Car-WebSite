# Legacy conversation removal

The rebuilt webhook and simulator use `whatsapp-rebuild.ts`,
`whatsapp-rebuild-gemini.ts` and `whatsapp-rebuild-store.ts`. Before deletion,
the old `whatsapp-flow.ts` graph was unreachable from every active site route
and component. Its 81 obsolete source, training, script and test files were
removed from this checkout. The reviewed preservation baseline now omits only
the deleted files (38 previously required entries).

The signed WhatsApp transport, message log, human silence rule, kill switch,
Gemini connection, incident monitoring, scheduled closing job and admin inbox
remain in place. The customer's untracked local file
`src/app/api/whatsapp/simulator/route 2.ts` was preserved, excluded from
TypeScript and excluded from deployments. It is not an application route.

Verification after removal: TypeScript, the remaining test suite, release
preservation preflight, protected deployment build and real-model fictional
dialogues. The customer WhatsApp switch stays off until owner launch approval.
