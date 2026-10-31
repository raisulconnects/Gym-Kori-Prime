import type { Unit } from '../preferences/preferences';

const LB_PER_KG = 2.20462;
const MAX_WEIGHT_KG = 1000;

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Shows a stored kg weight in the user's unit. Empty when there is no weight. */
export function formatWeight(weightKg: number | null, unit: Unit): string {
  if (weightKg === null) return '';
  return String(unit === 'lb' ? round(weightKg * LB_PER_KG, 1) : round(weightKg, 2));
}

/** Converts typed text in the user's unit to kg. Null when it's empty or not a sensible weight. */
export function parseWeight(text: string, unit: Unit): number | null {
  const value = Number(text);
  if (text.trim() === '' || !Number.isFinite(value) || value < 0) return null;
  const weightKg = unit === 'lb' ? value / LB_PER_KG : value;
  return weightKg > MAX_WEIGHT_KG ? null : round(weightKg, 3);
}

/** Converts typed reps to a whole number. Null when empty. */
export function parseReps(text: string): number | null {
  const value = Number(text);
  return text.trim() === '' || !Number.isInteger(value) || value < 0 ? null : value;
}

/** Shows a length of time as m:ss, or h:mm:ss from one hour. */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = String(safe % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}
