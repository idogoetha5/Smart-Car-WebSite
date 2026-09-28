/**
 * Guard for the seed/reseed/update scripts that write image URLs into the
 * vehicles table.
 *
 * Commit 87d004c deleted 311 unused local images. Five of these scripts still
 * carry the old /images/vehicles/*.png paths — 180 files that now 404 in
 * production. Running any of them unchanged would write dead URLs over the
 * live Supabase URLs and take down every image on the fleet pages.
 *
 * Two independent locks, because either alone is too easy to defeat by
 * accident:
 *
 *   1. requireExplicitOptIn() — refuses to run without ALLOW_ASSET_WRITE=1.
 *      Nobody reaches a database mutation by running a file by mistake.
 *   2. assertUrlsReachable() — refuses to write any URL that does not answer
 *      200. This is the one that actually catches the stale-path bug, and it
 *      keeps catching it for whatever the next stale path turns out to be.
 */

const OPT_IN = 'ALLOW_ASSET_WRITE';

export function requireExplicitOptIn(scriptName) {
  if (process.env[OPT_IN] !== '1') {
    console.error(`
${scriptName} refuses to run.

It writes vehicle image URLs into the database. Since 87d004c the local
/images/vehicles/*.png paths in this file no longer exist — they were deleted
and now 404 in production. Running this as-is would overwrite the working
Supabase URLs with dead ones.

Fix the URLs in this file first, then re-run with:

    ${OPT_IN}=1 node ${scriptName}

Every URL is checked for a 200 before anything is written, so a stale path
will still stop the run.
`);
    process.exit(1);
  }
}

/**
 * Verifies every URL answers 200 before any mutation. Local paths are rejected
 * outright: the database must hold absolute Supabase URLs, and a leading-slash
 * path is exactly the stale-asset bug this exists to prevent.
 */
export async function assertUrlsReachable(urls) {
  const unique = [...new Set(urls)];
  const local = unique.filter((u) => !/^https?:\/\//.test(u));

  if (local.length) {
    console.error(`\nRefusing to write ${local.length} non-absolute image path(s).`);
    console.error('The database needs absolute Supabase URLs. Examples:');
    for (const u of local.slice(0, 5)) console.error(`  ${u}`);
    process.exit(1);
  }

  console.log(`Checking ${unique.length} image URL(s)...`);
  const broken = [];

  // Small batches: enough to be quick, gentle enough not to look like a flood.
  const BATCH = 10;
  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async (url) => {
        try {
          const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
          return { url, ok: res.ok, status: res.status };
        } catch (err) {
          return { url, ok: false, status: err.message };
        }
      }),
    );
    for (const r of results) if (!r.ok) broken.push(r);
  }

  if (broken.length) {
    console.error(`\nRefusing to write: ${broken.length} of ${unique.length} URL(s) are not reachable.`);
    for (const b of broken.slice(0, 10)) console.error(`  ${b.status}  ${b.url}`);
    if (broken.length > 10) console.error(`  ... and ${broken.length - 10} more`);
    process.exit(1);
  }

  console.log(`All ${unique.length} URL(s) reachable.`);
}
