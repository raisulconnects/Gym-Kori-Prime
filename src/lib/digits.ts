const BANGLA_DIGITS = '০১২৩৪৫৬৭৮৯';

/** Shows a number or numeric text with Bangla digits. */
export function toBanglaDigits(value: number | string): string {
  return String(value).replace(/\d/g, (digit) => BANGLA_DIGITS.charAt(Number(digit)));
}

/** Converts typed Bangla digits to English digits, so values are stored one way. */
export function normalizeDigits(value: string): string {
  return value.replace(/[০-৯]/g, (digit) => String(BANGLA_DIGITS.indexOf(digit)));
}
