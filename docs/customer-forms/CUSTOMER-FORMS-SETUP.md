# SmartCar customer forms setup

The public form is available in Hebrew and English:

- `/he/customer-details?branch=herzliya`
- `/en/customer-details?branch=herzliya`

Replace the `branch` value with `telaviv`, `jerusalem`, or `airport` for the
other branches. Each branch QR uses its own URL, and the branch is assigned
automatically without asking the customer to choose it.

Printable A4 posters are available at:

- `/he/customer-details/qr/herzliya`
- `/he/customer-details/qr/telaviv`
- `/he/customer-details/qr/jerusalem`
- `/he/customer-details/qr/airport`

## Database

Run `database/migrations/add-customer-details-forms-table.sql` once in the Supabase SQL
Editor before publishing. The table is protected by row-level security and is
read through the authenticated SmartCar admin area only.

The admin category is at `/he/admin/customer-details`. Forms are grouped by
branch and can also be filtered to one branch.

## Branch email routing

Add these variables in Vercel when each branch has its own mailbox:

| Branch | Environment variable |
|---|---|
| Herzliya | `CUSTOMER_FORMS_EMAIL_HERZLIYA` |
| Tel Aviv | `CUSTOMER_FORMS_EMAIL_TELAVIV` |
| Jerusalem | `CUSTOMER_FORMS_EMAIL_JERUSALEM` |
| Ben Gurion Airport | `CUSTOMER_FORMS_EMAIL_AIRPORT` |

Until a branch-specific value is configured, the form uses
`CUSTOMER_FORMS_EMAIL_FALLBACK`. If that is also absent, it uses
`office@smartcar.co.il`.

The notification email contains the complete submitted form, as requested.
Because it contains passport and driving-licence numbers, each branch mailbox
should use two-factor authentication and access should be limited to staff who
need the information.
