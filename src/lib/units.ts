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

const MIN_BODY_WEIGHT_KG = 20;
const MAX_BODY_WEIGHT_KG = 400;
const MIN_HEIGHT_CM = 50;
const MAX_HEIGHT_CM = 280;
const CM_PER_INCH = 2.54;
const INCHES_PER_FOOT = 12;

/** Converts typed body weight to kg. Null when it isn't a believable weight for a person. */
export function parseBodyWeight(text: string, unit: Unit): number | null {
  const weightKg = parseWeight(text, unit);
  return weightKg !== null && weightKg >= MIN_BODY_WEIGHT_KG && weightKg <= MAX_BODY_WEIGHT_KG ? weightKg : null;
}

const validHeight = (cm: number) => (cm >= MIN_HEIGHT_CM && cm <= MAX_HEIGHT_CM ? round(cm, 1) : null);

/** Converts typed centimetres. Null when it isn't a believable height. */
export function parseHeightCm(text: string): number | null {
  const value = Number(text);
  return text.trim() === '' || !Number.isFinite(value) ? null : validHeight(value);
}

/** Converts typed feet and inches to centimetres. Null when it isn't a believable height. */
export function parseFeetInches(feetText: string, inchesText: string): number | null {
  const feet = Number(feetText);
  const inches = Number(inchesText);
  if (feetText.trim() === '' || !Number.isInteger(feet) || !Number.isInteger(inches)) return null;
  if (inches < 0 || inches >= INCHES_PER_FOOT) return null;
  return validHeight((feet * INCHES_PER_FOOT + inches) * CM_PER_INCH);
}

/** Shows a height in feet and inches, to the nearest inch. */
export function toFeetInches(heightCm: number): { feet: number; inches: number } {
  const totalInches = Math.round(heightCm / CM_PER_INCH);
  return { feet: Math.floor(totalInches / INCHES_PER_FOOT), inches: totalInches % INCHES_PER_FOOT };
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
