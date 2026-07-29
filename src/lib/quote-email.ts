interface QuoteEmailContentInput {
  customerName: string;
  quoteNumber: string;
  validUntil: string;
  officePhone: string;
  officeEmail: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character] ?? character;
  });
}

export function buildQuoteEmailContent(input: QuoteEmailContentInput) {
  const customerName = input.customerName.trim();
  const quoteNumber = input.quoteNumber.trim();
  const validUntil = input.validUntil.trim();
  const officePhone = input.officePhone.trim();
  const officeEmail = input.officeEmail.trim();
  const subject = `SmartCar | הצעת מחיר מס׳ ${quoteNumber}`;

  const text = [
    `שלום ${customerName},`,
    '',
    'תודה שפנית ל־SmartCar.',
    '',
    'מצורפת הצעת המחיר שהכנו עבורך בהתאם לפרטים שסוכמו. בקובץ המצורף מופיעים פרטי הרכב, התשלומים והתנאים הרלוונטיים.',
    `ההצעה בתוקף עד ${validUntil}.`,
    '',
    'נשמח לעמוד לרשותך בכל שאלה ולסייע בהמשך התהליך.',
    '',
    'בברכה,',
    'צוות SmartCar',
    officePhone,
    officeEmail,
    'www.smartcar.co.il',
  ].join('\n');

  const safeCustomerName = escapeHtml(customerName);
  const safeQuoteNumber = escapeHtml(quoteNumber);
  const safeValidUntil = escapeHtml(validUntil);
  const safeOfficePhone = escapeHtml(officePhone);
  const safeOfficeEmail = escapeHtml(officeEmail);

  const html = `
<!doctype html>
<html lang="he" dir="rtl">
  <body style="margin:0;background:#f4f7f6;font-family:Arial,'Helvetica Neue',sans-serif;color:#17312d;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7f6;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #dde7e5;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:#2d5f5f;padding:24px 30px;color:#ffffff;">
                <div style="font-size:24px;font-weight:700;letter-spacing:.5px;">SMART CAR</div>
                <div style="margin-top:7px;font-size:14px;color:#dcebea;">הצעת מחיר מס׳ ${safeQuoteNumber}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:30px;font-size:16px;line-height:1.75;">
                <p style="margin:0 0 18px;">שלום ${safeCustomerName},</p>
                <p style="margin:0 0 18px;">תודה שפנית ל־SmartCar.</p>
                <p style="margin:0 0 18px;">מצורפת הצעת המחיר שהכנו עבורך בהתאם לפרטים שסוכמו. בקובץ המצורף מופיעים פרטי הרכב, התשלומים והתנאים הרלוונטיים.</p>
                <p style="margin:0 0 18px;"><strong>ההצעה בתוקף עד ${safeValidUntil}.</strong></p>
                <p style="margin:0 0 24px;">נשמח לעמוד לרשותך בכל שאלה ולסייע בהמשך התהליך.</p>
                <p style="margin:0;">בברכה,<br><strong>צוות SmartCar</strong></p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 30px;background:#eef5f4;font-size:14px;line-height:1.8;color:#385853;">
                <span dir="ltr">${safeOfficePhone}</span>
                &nbsp;|&nbsp;
                <a href="mailto:${safeOfficeEmail}" style="color:#2d5f5f;text-decoration:none;">${safeOfficeEmail}</a>
                &nbsp;|&nbsp;
                <a href="https://www.smartcar.co.il" style="color:#2d5f5f;text-decoration:none;">smartcar.co.il</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();

  return { subject, text, html };
}
