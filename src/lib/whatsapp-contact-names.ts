/** Read-only YCloud lookup for names missing from locally saved WhatsApp state. */
type YCloudContact = { nickname?: string | null; remarkName?: string | null };

const cache = new Map<string, { name?: string; expiresAt: number }>();

function cleanName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 80) || undefined;
}

export async function getYCloudContactName(phone: string): Promise<string | undefined> {
  const apiKey = process.env.WHATSAPP_YCLOUD_API_KEY;
  if (process.env.WHATSAPP_TRANSPORT !== 'ycloud' || !apiKey || !/^\d{8,15}$/.test(phone)) return undefined;

  const cached = cache.get(phone);
  if (cached && cached.expiresAt > Date.now()) return cached.name;

  try {
    const response = await fetch(`https://api.ycloud.com/v2/contact/contacts/%2B${phone}`, {
      headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(2500),
      cache: 'no-store',
    });
    if (response.status === 404) {
      cache.set(phone, { expiresAt: Date.now() + 60 * 60_000 });
      return undefined;
    }
    if (!response.ok) {
      cache.set(phone, { expiresAt: Date.now() + 60_000 });
      console.error('[admin/whatsapp/conversations] YCloud contact lookup unavailable:', response.status);
      return undefined;
    }
    const contact = await response.json() as YCloudContact;
    const name = cleanName(contact.nickname) || cleanName(contact.remarkName);
    cache.set(phone, { name, expiresAt: Date.now() + 10 * 60_000 });
    return name;
  } catch {
    cache.set(phone, { expiresAt: Date.now() + 60_000 });
    return undefined;
  }
}
