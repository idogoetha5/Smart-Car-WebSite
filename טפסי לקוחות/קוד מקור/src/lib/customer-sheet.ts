import { createAdminClient } from "@/lib/supabase/server";

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [350, 1_100];
const REQUEST_TIMEOUT_MS = 8_000;

export interface CustomerSheetRow {
  id: string;
  createdAt: string;
  fullName: string;
  dateOfBirth: string;
  passportNumber: string;
  driverLicenseNumber: string;
  country: string;
  city: string;
  address: string;
  postalCode?: string;
  phone: string;
  israelAddress?: string;
  email: string;
  locale: "he" | "en";
}

export interface SheetSyncResult {
  ok: boolean;
  attempts: number;
  error: string | null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeError(value: unknown): string {
  return value instanceof Error
    ? value.message.slice(0, 400)
    : "Unknown Google Sheets error";
}

export async function enqueueCustomerSheetSync(
  formId: string,
): Promise<boolean> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("customer_sheet_outbox").upsert(
    {
      form_id: formId,
      status: "pending",
      next_attempt_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "form_id", ignoreDuplicates: true },
  );

  if (error) {
    console.error(
      "[customer-sheet][ALERT] could not queue form %s: %s",
      formId,
      error.message,
    );
    return false;
  }
  return true;
}

async function resolveCustomerSheetSync(formId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("customer_sheet_outbox")
    .delete()
    .eq("form_id", formId);
  if (error)
    console.error(
      "[customer-sheet][ALERT] could not clear form %s from retry queue: %s",
      formId,
      error.message,
    );
}

async function recordCustomerSheetFailure(
  formId: string,
  attempts: number,
  errorMessage: string,
): Promise<void> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("customer_sheet_outbox")
    .select("attempts")
    .eq("form_id", formId)
    .maybeSingle();
  const totalAttempts = Number(data?.attempts ?? 0) + attempts;
  const { error } = await supabase
    .from("customer_sheet_outbox")
    .update({
      attempts: totalAttempts,
      last_error: errorMessage.slice(0, 500),
      // The project cron runs once a day, so leave the row due and let the
      // next sweep pick it up regardless of what time the first send failed.
      next_attempt_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("form_id", formId);
  if (error)
    console.error(
      "[customer-sheet][ALERT] could not update retry for form %s: %s",
      formId,
      error.message,
    );
}

/**
 * Sends one Tel Aviv customer form to the private Apps Script endpoint.
 * The form id is the idempotency key; the script refuses to append it twice.
 */
export async function syncCustomerToSheet(
  row: CustomerSheetRow,
): Promise<SheetSyncResult> {
  const endpoint = process.env.CUSTOMER_SHEETS_WEBHOOK_URL?.trim();
  const secret = process.env.CUSTOMER_SHEETS_WEBHOOK_SECRET?.trim();
  if (!endpoint || !secret) {
    const error = "Google Sheets webhook is not configured";
    console.error("[customer-sheet][ALERT] %s (ref %s)", error, row.id);
    await recordCustomerSheetFailure(row.id, 0, error);
    return { ok: false, attempts: 0, error };
  }

  let attempts = 0;
  let lastError = "Google Sheets did not accept the row";

  for (let index = 0; index < MAX_ATTEMPTS; index++) {
    attempts = index + 1;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, row }),
        redirect: "follow",
        signal: controller.signal,
      });
      const body = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (response.ok && body?.ok === true) {
        await resolveCustomerSheetSync(row.id);
        return { ok: true, attempts, error: null };
      }
      lastError =
        body?.error?.slice(0, 400) ||
        `Google Sheets returned ${response.status}`;
      if (response.status >= 400 && response.status < 500) break;
    } catch (error) {
      lastError = safeError(error);
    } finally {
      clearTimeout(timeout);
    }

    if (index < MAX_ATTEMPTS - 1) await sleep(BACKOFF_MS[index] ?? 1_100);
  }

  console.error(
    "[customer-sheet][ALERT] form %s not synced after %s attempt(s)",
    row.id,
    attempts,
  );
  await recordCustomerSheetFailure(row.id, attempts, lastError);
  return { ok: false, attempts, error: lastError };
}

interface PendingSheetRow {
  form_id: string;
  attempts: number;
}

interface StoredCustomerForm {
  id: string;
  created_at: string;
  full_name: string;
  date_of_birth: string;
  passport_number: string;
  driver_license_number: string;
  country: string;
  city: string;
  address: string;
  postal_code: string | null;
  phone: string;
  israel_address: string | null;
  email: string;
  locale: "he" | "en";
}

function storedFormToSheetRow(form: StoredCustomerForm): CustomerSheetRow {
  return {
    id: form.id,
    createdAt: form.created_at,
    fullName: form.full_name,
    dateOfBirth: form.date_of_birth,
    passportNumber: form.passport_number,
    driverLicenseNumber: form.driver_license_number,
    country: form.country,
    city: form.city,
    address: form.address,
    postalCode: form.postal_code ?? "",
    phone: form.phone,
    israelAddress: form.israel_address ?? "",
    email: form.email,
    locale: form.locale,
  };
}

export async function retryPendingCustomerSheetSync(
  limit = 20,
): Promise<{ swept: number; delivered: number; pending: number }> {
  const supabase = createAdminClient();
  const { data: pendingRows, error } = await supabase
    .from("customer_sheet_outbox")
    .select("form_id, attempts")
    .eq("status", "pending")
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error(
      "[customer-sheet][cron] could not read retry queue:",
      error.message,
    );
    return { swept: 0, delivered: 0, pending: 0 };
  }

  let delivered = 0;
  let stillPending = 0;
  for (const pending of (pendingRows ?? []) as PendingSheetRow[]) {
    const { data: form, error: formError } = await supabase
      .from("customer_details_forms")
      .select(
        "id, created_at, full_name, date_of_birth, passport_number, driver_license_number, country, city, address, postal_code, phone, israel_address, email, locale",
      )
      .eq("id", pending.form_id)
      .eq("branch_id", "telaviv")
      .maybeSingle();
    if (formError || !form) {
      stillPending++;
      console.error(
        "[customer-sheet][cron] form %s is unavailable for retry",
        pending.form_id,
      );
      continue;
    }

    const result = await syncCustomerToSheet(
      storedFormToSheetRow(form as StoredCustomerForm),
    );
    if (result.ok) delivered++;
    else stillPending++;
  }

  return { swept: pendingRows?.length ?? 0, delivered, pending: stillPending };
}
