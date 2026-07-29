'use client';

/**
 * Shared SWR plumbing for client-side data loading.
 *
 * Every client component that used to fetch in `useEffect` and then call
 * `setState` goes through here instead. That pattern is what the React
 * Compiler flags as `react-hooks/set-state-in-effect`: the effect runs, sets
 * state, and triggers a second render pass on every mount. SWR reads through
 * `useSyncExternalStore`, so there is no effect and no cascading render — and
 * it brings request deduplication and a real `mutate()` for refreshing after
 * a mutation, which the hand-rolled version had to re-implement per page.
 */

import useSWR, { type SWRConfiguration } from 'swr';

/** Carries the HTTP status so callers can branch on it (401 in particular). */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message?: string) {
    super(message ?? `Request failed with status ${status}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

/** Fetches JSON and throws {@link HttpError} on a non-2xx response. */
export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new HttpError(res.status);
  return (await res.json()) as T;
}

/**
 * Unwraps the `{ data: ... }` envelope the app's own API routes answer with.
 * A missing `data` key yields `null` rather than `undefined`, so SWR still
 * treats the request as resolved instead of pending.
 */
export async function dataFetcher<T>(url: string): Promise<T | null> {
  const json = await fetcher<{ data?: T }>(url);
  return json.data ?? null;
}

/** One shared identity, so `useMemo` deps downstream do not churn while loading. */
const EMPTY: never[] = [];

/**
 * The list read every admin screen performs: load once, expose a loading
 * flag, and hand back `mutate` both for refreshing after a write and for
 * applying an optimistic change without a round trip.
 *
 * Pass `null` as the url to hold the request back until it is wanted — SWR
 * treats a null key as "not ready yet" and simply does not fetch.
 */
export function useApiList<T>(url: string | null, options?: SWRConfiguration) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<T[] | null>(
    url,
    dataFetcher,
    options,
  );
  return { items: (data ?? EMPTY) as T[], error, isLoading, isValidating, mutate };
}
