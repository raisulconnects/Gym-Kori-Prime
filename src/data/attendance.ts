import { daysOfWeek, toLocalDate } from '../lib/week';
import type { WeeklySchedule, Workout } from './db';
import { scheduleOn } from './store';

/**
 * - `done`: a workout was finished that day
 * - `inProgress`: a workout started that day is still running
 * - `missed`: a gym day that has ended with no workout
 * - `planned`: a gym day that is today or still to come
 * - `rest`: a planned rest day
 * - `none`: before the user had any schedule, so nothing was expected
 */
export type DayStatus = 'done' | 'inProgress' | 'missed' | 'planned' | 'rest' | 'none';

export interface AttendanceDay {
  date: Date;
  localDate: string;
  status: DayStatus;
  /** The routine the schedule had planned for this day. */
  plannedRoutineId: string | null;
  workouts: Workout[];
}

export function dayAttendance(
  date: Date,
  today: string,
  schedules: WeeklySchedule[],
  workouts: Workout[],
): AttendanceDay {
  const localDate = toLocalDate(date);
  const onDay = workouts.filter((workout) => workout.localDate === localDate && !workout.deletedAt);
  const active = schedules.filter((schedule) => !schedule.deletedAt);
  const plannedRoutineId = scheduleOn(active, localDate)[date.getDay()] ?? null;
  const hadSchedule = active.some((schedule) => schedule.effectiveFrom <= localDate);

  let status: DayStatus;
  if (onDay.some((workout) => workout.status === 'finished')) status = 'done';
  else if (onDay.length > 0) status = 'inProgress';
  else if (active.length === 0 || (localDate <= today && !hadSchedule)) status = 'none';
  else if (!plannedRoutineId) status = 'rest';
  else status = localDate < today ? 'missed' : 'planned';

  return { date, localDate, status, plannedRoutineId, workouts: onDay };
}

/** Attendance for the Saturday-to-Friday week containing `date`. */
export function weekAttendance(
  date: Date,
  today: string,
  schedules: WeeklySchedule[],
  workouts: Workout[],
): AttendanceDay[] {
  return daysOfWeek(date).map((day) => dayAttendance(day, today, schedules, workouts));
}

/** Counts gym days attended out of those expected. Rest days and days before a schedule don't count. */
export function summarizeWeek(days: AttendanceDay[]): { attended: number; expected: number } {
  const expected = days.filter((day) => day.status !== 'rest' && day.status !== 'none').length;
  return { attended: days.filter((day) => day.status === 'done').length, expected };
}
