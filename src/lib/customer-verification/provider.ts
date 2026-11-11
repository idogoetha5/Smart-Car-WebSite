// Server-only. The single place where a CVV may ever be handled.
//
// Owner decision 2026-11-11: the CVV field exists in the form but is OFF
// by default (NEXT_PUBLIC_CV_COLLECT_CVV). It is never written to the
// database, storage, logs or Sentry. Its only possible use is a one-time
// card check with the clearing company (HYP) at the moment of submit,
// once that connection is approved and configured. Until then the value
// is dropped here.

export type CardCheck =
  | { status: 'not_configured' }
  | { status: 'approved'; reference: string }
  | { status: 'declined'; reason: string };

export interface CardCheckInput {
  number: string;
  expMonth: string;
  expYear: string;
  cvv: string;
  holderId: string;
}

export function cvvCollectionEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CV_COLLECT_CVV === '1';
}

/**
 * One-time card check (J5 / "בדיקת מסגרת") with the clearing company.
 * Not connected yet: fill in HYP's API here once the account and the
 * terminal credentials are approved. Never persist `input.cvv`.
 */
export async function checkCardWithProvider(input: CardCheckInput): Promise<CardCheck> {
  void input;
  return { status: 'not_configured' };
}
