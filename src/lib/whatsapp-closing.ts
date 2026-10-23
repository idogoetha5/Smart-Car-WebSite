/** Compatibility for the scheduled route: inactivity no longer expires a chat. */
export function closingNotice(locale: 'he' | 'en' | undefined) {
  return locale === 'en'
    ? 'Your conversation details are still here. We can continue where we left off.'
    : 'פרטי השיחה עדיין שמורים. אפשר להמשיך מאיפה שעצרנו.';
}

/** Do not query or message customers with the retired automatic-deletion warning. */
export async function sendClosingNotices(_now = Date.now()) {
  void _now;
  return { checked: 0, sent: 0 };
}
