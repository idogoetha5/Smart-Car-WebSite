# Production preservation — mandatory owner direction (2026-10-22)

Never remove, overwrite, roll back, hide or omit existing SmartCar functionality or assets without telling Ido exactly what would change and receiving his explicit approval first. Permission to work on one feature is not permission to replace unrelated work. This applies to Codex, Claude, other agents and human deployment workflows.

## Incident

A manual CLI release copy based on old HEAD `3f5feaa` overlaid bot-only files and excluded what it called unrelated dirty admin work. Those admin/gallery changes were already published and committed on production `clean-main` (`b83f1c7`). The partial copy omitted `public/images/vehicle-gallery`, Search Console, mobile admin changes, and X2 display/floor logic. Its promotion replaced the whole application, not just the bot. Result: broken public photos, missing Search Console, and X2 displaying its calculation base 1060 rather than the approved advertised 850. The user explicitly authorized restoring the complete last verified release before further integration.

## Before every deployment or promotion

1. Read AGENTS.md, this file and current docs/AI-HANDBOOK.md. Fetch origin/clean-main and use it as the complete application baseline, never an older local checkout or a hand-picked file export.
2. Inspect git status and preserve all user/other-agent work. Integrate the scoped change into the current baseline; do not decide that another feature is irrelevant and therefore exclude it from a whole-site deployment.
3. Coordinate with other active publishers through the user. One release owner at a time; do not race deploy/promote/alias operations. An earlier permission to publish is not permission to override someone else's newer release.
4. Run `node scripts/ci/deploy-preservation.mjs` from the exact release directory. This requires a Git checkout containing origin/clean-main, checks the preserved features, and verifies every currently published local gallery URL against release files. The normal npm build also runs the feature/asset checks in --build mode (without Git metadata, which the remote builder may not retain). A failure blocks publication. Do not bypass it with --force, copy only tracked subsets, remove the check, or use a different deployment folder.
5. Run relevant tests, typecheck and lint. Before promotion, verify the staged build includes all gallery assets, authenticated Search Console plus All searches, the mobile admin navigation, and X2 starting display 850 / booking floor 950. Do not submit real customer bookings for a smoke test.
6. After publication verify the custom production domain, not just the staging URL: gallery images load; X2 shows 850 undated and at least 950/day when booking; Search Console has live data and its detailed page; mobile navigation persists. A Ready deployment status alone is not verification.
7. If a rollback is necessary, explicitly describe its scope and preserve newer unpublished work. Never delete database rows, storage objects or credentials to solve a deployment regression.

Documentation/CLI preflight reduce this failure mode but cannot guarantee zero future outages or prevent an independently authorized publisher from bypassing local checks. Server-enforced deployment restrictions require a separately approved platform-policy change; do not silently change access permissions.
