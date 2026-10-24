import { createAdminClient } from '@/lib/supabase/server';

export interface LeadExportRow {
  key: string;
  source: string;
  name: string;
  phone: string;
  email: string;
  createdAt: string;
  details: string;
  /** Only included in the private inbox; never silently hide an office enquiry. */
  internal?: boolean;
}

const INTERNAL_NAMES = new Set([
  'דניאל דניאל', 'דניאל נרדאה', 'daniel daniel', 'daniel nardea',
  'עידו גויטע', 'ido goetha',
]);

export function isCustomerLead(name: string): boolean {
  const normalized = name.normalize('NFKC').replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
  return Boolean(normalized) && !INTERNAL_NAMES.has(normalized)
    && !/בדיק[הת]/.test(normalized) && !/\btest\b/i.test(normalized);
}

/** Full reconciliation feed: a missed poll never loses an older lead. */
export async function getCustomerLeads({ includeInternal = false }: { includeInternal?: boolean } = {}): Promise<LeadExportRow[]> {
  const client = createAdminClient();
  const sources = [
    { table: 'bookings', prefix: 'booking', label: 'השכרה', columns: 'id,customer_name,customer_phone,customer_email,pickup_location,dropoff_location,created_at' },
    { table: 'leasing_requests', prefix: 'leasing', label: 'ליסינג', columns: 'id,customer_name,customer_phone,customer_email,created_at' },
    { table: 'contact_leads', prefix: 'contact', label: 'צור קשר', columns: 'id,name,phone,email,message,created_at' },
    { table: 'whatsapp_rental_requests', prefix: 'whatsapp', label: 'וואטסאפ', columns: 'id,customer_name,phone,customer_email,pickup_location,dropoff_location,created_at' },
  ];
  const groups = await Promise.all(sources.map(async (source) => {
    const rows: LeadExportRow[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client.from(source.table).select(source.columns)
        .order('created_at').order('id').range(offset, offset + 499);
      if (error) throw new Error(`Lead source unavailable: ${source.table}`);
      // Dynamic source selection has one shared, deliberately narrow shape.
      const records = data as unknown as Record<string, unknown>[];
      for (const record of records) {
        const name = String(record.customer_name ?? record.name ?? '');
        const filtered = !isCustomerLead(name);
        const internal = Boolean(name.trim()) && filtered;
        if (filtered && !includeInternal) continue;
        rows.push({
          key: `${source.prefix}:${record.id}`, source: source.label, name: name || 'ללא שם',
          phone: String(record.customer_phone ?? record.phone ?? ''),
          email: String(record.customer_email ?? record.email ?? ''),
          createdAt: String(record.created_at ?? ''),
          ...(includeInternal ? { internal } : {}),
          details: source.prefix === 'contact' ? String(record.message ?? '')
            : source.prefix === 'leasing' ? ''
              : `${record.pickup_location ?? ''} → ${record.dropoff_location ?? ''}`,
        });
      }
      if (records.length < 500) return rows;
    }
  }));
  return groups.flat().sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.key.localeCompare(b.key));
}
