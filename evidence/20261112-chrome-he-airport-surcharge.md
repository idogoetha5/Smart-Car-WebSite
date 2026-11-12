# Live Chrome — Hebrew airport surcharge questions (2026-11-12)
Owner decisions: mention the surcharge, not the amount; answer like a person; mention the website only if the customer asks about it.
On f2429db: "ובאתר … זה כבר היה כלול?" got copied instruction wording ("רק אם הלקוח שואל…") → fixed in 4df3324 (customer-facing fact text, `instruction_leak` validator).
On 4df3324: 1) "אם אני אוסף את הרכב בנתב״ג יש תוספת?" → yes, amount and final price with a representative, 24/7 by arrangement, no website mention. 2) "ובאתר … זה כבר היה כלול?" → not included in the website estimate. 3) "כמה בערך התוספת?" → no amount (correct) but invented "because it varies" → validator `invented_reason` (next release).
On 32469f0: "כמה בערך התוספת?" → "נקבעת בהתאם להזמנה" (again an invented reason). Next release: surcharge, amount and website answers are fixed wording from the application, not model text.
