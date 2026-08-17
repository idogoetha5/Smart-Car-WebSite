/**
 * Escalation SMS to Daniel via Twilio's REST API (plain fetch — no SDK,
 * this is the only thing we need it for). Kept deliberately short: Hebrew
 * SMS is UCS-2, 70 chars/segment (67 once multi-part), so this is detail
 * behind a phone call, not the full conversation.
 */

const TWILIO_SEND_URL = (accountSid: string) =>
  `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export async function sendEscalationSms(params: {
  customerPhone: string;
  reason: string;
  lastMessage: string;
}): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  const toNumber = process.env.DANIEL_ALERT_PHONE;

  if (!accountSid || !authToken || !fromNumber || !toNumber) {
    console.error('[sms-alert][ALERT] escalation SMS not sent — Twilio not fully configured');
    return false;
  }

  const body = `סמארטקאר - נדרש נציג\n${truncate(params.reason, 40)}\nלקוח: ${params.customerPhone}\n"${truncate(params.lastMessage, 60)}"`;

  try {
    const res = await fetch(TWILIO_SEND_URL(accountSid), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      },
      body: new URLSearchParams({ From: fromNumber, To: toNumber, Body: body }),
    });

    if (!res.ok) {
      console.error(`[sms-alert][ALERT] escalation SMS failed with ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[sms-alert][ALERT] escalation SMS errored:', (err as Error)?.message);
    return false;
  }
}
