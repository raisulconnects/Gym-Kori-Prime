import { useState } from 'react';
import { normalizeDigits } from '../lib/digits';
import { useFormat } from '../preferences/useFormat';

function cleanNumber(text: string, decimal: boolean): string {
  const digits = normalizeDigits(text).replace(/,/g, '.');
  if (!decimal) return digits.replace(/\D/g, '');
  const [whole = '', ...fractions] = digits.replace(/[^\d.]/g, '').split('.');
  return fractions.length > 0 ? `${whole}.${fractions.join('')}` : whole;
}

/**
 * A number box that saves every change while the user types. It keeps its own text, so a
 * half-typed value like "62." isn't overwritten by the saved number.
 */
export function LiveNumberField({
  label,
  value,
  decimal = false,
  maxLength,
  className,
  onChange,
}: {
  label: string;
  /** The saved value in English digits. Shown whenever the box isn't being edited. */
  value: string;
  decimal?: boolean;
  maxLength: number;
  className: string;
  onChange: (value: string) => void;
}) {
  const format = useFormat();
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <input
      aria-label={label}
      inputMode={decimal ? 'decimal' : 'numeric'}
      autoComplete="off"
      value={format.number(editing ?? value)}
      onFocus={() => setEditing(value)}
      onBlur={() => setEditing(null)}
      onChange={(event) => {
        const cleaned = cleanNumber(event.target.value, decimal).slice(0, maxLength);
        setEditing(cleaned);
        onChange(cleaned);
      }}
      className={className}
    />
  );
}
