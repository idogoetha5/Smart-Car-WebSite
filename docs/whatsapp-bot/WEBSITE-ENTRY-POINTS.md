# WhatsApp entry inventory — complete source search, 2026-10-23

Scope: all `src` TypeScript/TSX/JSON occurrences of wa.me, whatsapp.com,
whatsapp: and send?phone. Re-run when adding builders. Empty text is valid: no
code word, fixed format or reliable referrer is required. Customer text is editable
and untrusted, even when it resembles a builder. No public buttons were removed.

## Customer → business, actual prefilled families

1. `src/app/[locale]/rental/[id]/page.tsx`:
   - HE: `שלום, אשמח לעזרה לגבי {make} {model}`
   - EN: `Hi, I'd like help with the {make} {model}`
   Vehicle-specific interest, not booking consent or verified date availability.
2. `src/app/[locale]/leasing/LeasingInquirySection.tsx`, handleWhatsApp:
   Actual builder is Hebrew even on the English route; do NOT invent an English
   source variant. Exact shape (values are interpolated):

   ```text
   היי! אני מעוניין בליסינג על {year} {make} {model}

   פרטי הבקשה:
   🚗 רכב: {year} {make} {model}
   📅 משך חוזה: {duration} חודשים
   📍 קילומטרז׳: {formatted mileage} ק״מ לשנה
   💰 מחיר חודשי משוער: ₪{formatted monthlyPrice}

   אשמח לקבל פרטים נוספים, תודה!
   ```

   Unlimited mileage substitutes `ללא הגבלה` for the whole mileage label.
   Preserve the estimate as a reported calculator estimate, NOT customer budget,
   approved price, reserved car or verified unlimited-mileage entitlement.
3. `src/app/[locale]/cars-for-sale/page.tsx`:
   - HE: `שלום, אני מעוניין לקנות רכב מהצי שלכם. אנא עדכנו אותי כשיהיו רכבים למכירה.`
   - EN: `Hello, I'm interested in buying a car from your fleet. Please notify me when cars become available.`
   Interest/notification request, not proof of stock or completed subscription.
4. `src/app/api/admin/bookings/[id]/route.ts`, confirmation email's deposit link:
   - HE: `שלום, אני רוצה לשלם מקדמה עבור ההזמנה שלי מספר #{orderId}`
   - EN: `Hello, I would like to pay the deposit for booking #{orderId}`
   Reference is not authentication. Do not expose booking/account data or request
   card details. Distinguish reservation advance payment from rental security hold.

## Customer → business, no prefill

`WhatsAppFloat.tsx`; home page CTA; contact page; delivery/[city] page;
catalog/VehicleGrid.tsx. Home `sameAs` is metadata, not another message builder.
All use 97299509757. A blank WhatsApp composer means the bot only sees what the
person actually sends. Do not claim which page they visited.

## Staff → customer builders (not inbound prospect templates)

- Admin/manager leasing quotations: `api/admin/quote-whatsapp`, message helper:
  HE `שלום {name},\nמצורפת הצעת ליסינג מס׳ {number} מבית SmartCar.\n{link}\n\nנשמח לעמוד לרשותך בכל שאלה.\nצוות SmartCar`;
  EN `Hello {name},\nAttached is SmartCar leasing quotation no. {number}.\n{link}\n\nWe will be happy to answer any questions.\nSmartCar`.
- Rental quote/confirmation: `api/admin/rental-quote-whatsapp` delegates to
  `rentalQuoteWhatsAppMessage` in `src/lib/rental-quote.ts`, using HE/EN COPY.
  Greeting, document kind/number, requested branded short link and actual validity
  date. A customer forwarding this text does not authenticate the document.
  Do not discard the distinction between quotation and booking confirmation.
- Driver task messages in `src/lib/driver-on-the-way.ts`: onTheWayMessage,
  arrivedMessage, signedCopyMessage, returnReminderMessage; onTheWayLink opens
  the customer's number. These are Hebrew staff-authored delivery/return,
  signed-document and reminder messages, NOT permission for the bot to assert
  driver location, ETA, receipt or rescheduling. Replies need actual task data or
  human handling. Do not copy a driver's first-person identity.
- Admin customer-details, leasing-requests, leads and bookings; manager TaskSheet:
  phone-only links to the customer; no prefilled text. Quote admin pages consume
  the API builders above rather than a separate independent template.

## Dialogue acceptance still open

For each inbound family: original shape, edited/missing field, changed estimate,
added question and later correction. Include both actual source languages where
present, English customer translation of leasing as a customer-written variation,
free greeting, curious prospect, ready customer, returning customer and post-rental
service. Never label edited test values real offers. Full multi-turn live evidence,
not just this inventory, is required before customer activation.
