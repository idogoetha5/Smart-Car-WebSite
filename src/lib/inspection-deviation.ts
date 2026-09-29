export interface InspectionReading {
  odometerKm: number;
  fuelEighths: number;
}

export interface InspectionDeviation {
  hasDeviation: boolean;
  distanceKm: number | null;
  allowedKm: number;
  excessKm: number;
  fuelMissingEighths: number;
  warnings: string[];
}

/** Mileage allowance published in the booking flow and rental terms. */
export function mileageAllowanceKm(totalDays: number): number {
  const days = Math.max(1, Math.ceil(Number(totalDays) || 1));
  if (days <= 7) return 200 * days;
  if (days <= 30) return 220 * days;
  return 2500 * Math.ceil(days / 30);
}

/**
 * Compares a signed return inspection with the pickup reading for the same
 * booking. Pickup inspections have no earlier baseline, so they cannot be
 * classified as a mileage/fuel deviation on their own.
 */
export function calculateInspectionDeviation(
  pickup: InspectionReading | null,
  returned: InspectionReading,
  totalDays: number
): InspectionDeviation {
  const allowedKm = mileageAllowanceKm(totalDays);
  if (!pickup) {
    return {
      hasDeviation: false,
      distanceKm: null,
      allowedKm,
      excessKm: 0,
      fuelMissingEighths: 0,
      warnings: [],
    };
  }

  const distanceKm = returned.odometerKm - pickup.odometerKm;
  const excessKm = Math.max(0, distanceKm - allowedKm);
  const fuelMissingEighths = Math.max(0, pickup.fuelEighths - returned.fuelEighths);
  const warnings: string[] = [];

  if (distanceKm < 0) {
    warnings.push('קריאת הקילומטראז׳ בהחזרה נמוכה מקריאת המסירה');
  } else if (excessKm > 0) {
    warnings.push(`חריגת קילומטראז׳ של ${excessKm.toLocaleString('he-IL')} ק״מ`);
  }

  if (fuelMissingEighths > 0) {
    warnings.push(`חסרים ${fuelMissingEighths}/8 מיכל דלק ביחס למסירה`);
  }

  return {
    hasDeviation: warnings.length > 0,
    distanceKm,
    allowedKm,
    excessKm,
    fuelMissingEighths,
    warnings,
  };
}
