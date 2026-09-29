/**
 * TODO(legal): replace with the business-supplied declaration text for
 * pickup and return inspections, in both languages. Per the same rule
 * already followed for the customer-details consent text
 * (src/components/customer-details/CustomerDetailsForm.tsx) — real
 * legal/business wording only, never invented here.
 *
 * Left as a visible placeholder rather than blank so a PDF generated before
 * the real text is supplied is obviously not final.
 */
export const INSPECTION_DECLARATION: Record<'pickup' | 'return', { he: string; en: string }> = {
  pickup: {
    he: '[TODO – טקסט הצהרה משפטית לקבלת רכב יסופק על ידי העסק]',
    en: '[TODO – legal declaration text for vehicle pickup to be supplied by the business]',
  },
  return: {
    he: '[TODO – טקסט הצהרה משפטית להחזרת רכב יסופק על ידי העסק]',
    en: '[TODO – legal declaration text for vehicle return to be supplied by the business]',
  },
};
