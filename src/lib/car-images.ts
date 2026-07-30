const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://iovpoxmdsgsstaduggvb.supabase.co';

export const VEHICLE_BUCKET_URL = `${SUPABASE_URL}/storage/v1/object/public/vehicles`;

/**
 * Vehicle photos live in the public `vehicles` Supabase bucket, but the
 * cars-for-sale admin form takes a free-text URL. A bare filename, or an
 * `/images/vehicles/...` path — a location that has never existed under
 * `public/` — saves without complaint and then 404s on the card. Resolve
 * those against the bucket; leave anything else exactly as entered so a real
 * local asset or an external URL still works.
 */
export function resolveVehicleImageUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith('data:')) return trimmed;

  const path = trimmed.replace(/^\/+/, '');
  const isBucketPath =
    path.startsWith('images/vehicles/') || path.startsWith('vehicles/') || !path.includes('/');
  if (!isBucketPath) return trimmed;

  const filename = path.split('/').pop();
  if (!filename) return null;
  return `${VEHICLE_BUCKET_URL}/${encodeURI(filename)}`;
}
