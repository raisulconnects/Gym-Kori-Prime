import { normalizeDigits } from '../lib/digits';
import { useFormat } from '../preferences/useFormat';

/**
 * A whole-number box that accepts English or Bangla digits. The value is always
 * kept in English digits and shown in the user's language.
 */
export function NumberField({
  label,
  value,
  onChange,
  maxLength = 2,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}) {
  const format = useFormat();
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      autoComplete="off"
      value={format.number(value)}
      onChange={(event) => onChange(normalizeDigits(event.target.value).replace(/\D/g, '').slice(0, maxLength))}
      className="field field-number"
    />
  );
}
