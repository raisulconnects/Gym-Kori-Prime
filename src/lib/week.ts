const SATURDAY = 6;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

/** Returns the seven days of the week containing `date`, from Saturday to Friday. */
export function daysOfWeek(date: Date): Date[] {
  const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const daysSinceSaturday = (noon.getDay() - SATURDAY + 7) % 7;
  const saturday = noon.getTime() - daysSinceSaturday * DAY_IN_MS;
  return Array.from({ length: 7 }, (_, index) => new Date(saturday + index * DAY_IN_MS));
}

/** The date on the user's own calendar, as YYYY-MM-DD. These sort correctly as text. */
export function toLocalDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function isSameDay(first: Date, second: Date): boolean {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}
