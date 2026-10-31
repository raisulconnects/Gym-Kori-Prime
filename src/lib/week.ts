const SATURDAY = 6;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

/** Returns the seven days of the week containing `date`, from Saturday to Friday. */
export function daysOfWeek(date: Date): Date[] {
  const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const daysSinceSaturday = (noon.getDay() - SATURDAY + 7) % 7;
  const saturday = noon.getTime() - daysSinceSaturday * DAY_IN_MS;
  return Array.from({ length: 7 }, (_, index) => new Date(saturday + index * DAY_IN_MS));
}

export function isSameDay(first: Date, second: Date): boolean {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}
