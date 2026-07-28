# Operational findings requiring action outside this repository

Investigated 2026-07-28. Each item below was verified against the live
system, not inferred. None of these can be fixed by a code change, so they
are recorded here rather than left implicit.

---

## 1. Email authentication: DKIM and DMARC are absent

Verified by DNS lookup against `smartcar.co.il`:

| Record | State | Value |
|---|---|---|
| SPF | **present** | `v=spf1 include:spf.protection.outlook.com -all` |
| MX | present | `smartcar-co-il.mail.protection.outlook.com` |
| DKIM `selector1._domainkey` | **not configured** | — |
| DKIM `selector2._domainkey` | **not configured** | — |
| DMARC `_dmarc` | **not configured** | — |

SPF is correctly set with a hard fail (`-all`) and points at Microsoft 365,
which matches the MX. The two pieces that prove a message actually came
from SmartCar — DKIM signing and a DMARC policy — are missing.

Consequence: a receiving server has no signature to check and no published
policy telling it what to do with a forged message. This both weakens
deliverability of genuine mail and leaves the domain spoofable.

**Not changed here.** DNS was deliberately left untouched: the correct
DKIM CNAME targets are issued per tenant by Microsoft 365 and must be read
from the admin centre, never guessed.

To complete:
1. Microsoft 365 admin centre → Settings → Domains → smartcar.co.il →
   DKIM → enable signing. It will supply the two CNAME targets.
2. Publish `selector1._domainkey` and `selector2._domainkey` as CNAMEs to
   exactly those targets.
3. Only once DKIM is verified, publish DMARC in monitoring mode first:
   `_dmarc TXT "v=DMARC1; p=none; rua=mailto:<mailbox>"`.
4. Read the aggregate reports for a few weeks, confirm all legitimate
   senders pass, then move `p=none` → `quarantine` → `reject`.

Going straight to `p=reject` before DKIM is verified would send legitimate
mail to junk.

---

## 2. HSTS: the live header does not match the code

| Source | Value |
|---|---|
| `next.config.ts` | `max-age=63072000; includeSubDomains; preload` |
| Live `www.smartcar.co.il` | `max-age=31536000; includeSubDomains` |
| Live apex `smartcar.co.il` | `max-age=31536000; includeSubDomains` |

The response carries `server: Vercel` with a `x-vercel-id` and no
intermediate proxy header (no Cloudflare `cf-ray`, no `x-served-by`), so
nothing between Vercel and the client is rewriting it.

Conclusion: **Vercel's own domain-level HSTS setting is taking precedence
over the header in `next.config.ts`** — identical on both hostnames, and
exactly Vercel's default one-year value without `preload`.

This is not a security regression (one year with `includeSubDomains` is a
sound policy) but it does mean the value in the repo is not the value being
served, which is the kind of drift that makes a config file untrustworthy.

To complete: set the policy in the Vercel dashboard (Project → Settings →
Domains → HSTS) and make `next.config.ts` match, so there is one source of
truth. Note `preload` is a one-way door — submitting to the preload list is
hard to reverse and should be a deliberate decision, not a side effect.

---

## 3. Dependency advisories: 5 high, 3 moderate — all nested inside Next.js

`npm audit --omit=dev` reports 8 advisories. Top-level dependencies are
already current: `next@16.2.12` (the version the middleware advisory asked
for) and `sharp@0.35.3`.

Every remaining advisory comes from a copy of a package nested **inside**
Next.js's own dependency tree:

- `next` → `node_modules/next/node_modules/sharp@0.34.5` (libvips CVEs)
- `next` → `postcss`
- transitive `brace-expansion`, `fast-uri`, `@opentelemetry/*`

The top-level `sharp@0.35.3` upgrade does not replace the copy Next.js
bundles for its own image optimiser, so the finding survives the upgrade.

`npm audit fix --force` proposes downgrading to `next@9.3.3` — a five-major
downgrade that would break the entire application. It must not be run.

**No claim is made here that any of these is exploitable in this
application.** Establishing that requires checking whether the vulnerable
code path is reachable — for the libvips CVEs, whether attacker-controlled
image data reaches the optimiser. Untrusted uploads are not accepted; images
come from the admin flow and Supabase storage.

To complete: re-check on each Next.js release and upgrade when Next ships a
patched nested `sharp`/`postcss`. CI now reports the audit on every run and
fails only on a *new critical* advisory, so this stays visible without
blocking unrelated work.

---

## 4. Vercel is not connected to GitHub

Pushing to `clean-main` does **not** trigger a deployment. The project has
no Git integration at the project level, so production deploys happen via
`vercel --prod` from a clean checkout.

Deployments made this way still record the commit SHA, and the ones made
today are not marked `gitDirty`, so provenance is intact — but it means a
merged change is not live until someone deploys explicitly.

To complete: connect the GitHub repository in Vercel (Project → Settings →
Git) so `clean-main` deploys automatically and preview deployments exist
for pull requests. This is also what the CI workflow assumes long-term.
