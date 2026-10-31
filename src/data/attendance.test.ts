import { describe, expect, it } from 'vitest';
import { dayAttendance, summarizeWeek, weekAttendance } from './attendance';
import type { WeeklySchedule, Workout } from './db';

const SUNDAY = 0;
const WEDNESDAY = 3;
const THURSDAY = 4;

function plan(effectiveFrom: string, gymDays: Record<number, string>): WeeklySchedule {
  return {
    id: effectiveFrom,
    effectiveFrom,
    updatedAt: effectiveFrom,
    days: Array.from({ length: 7 }, (_, weekday) => gymDays[weekday] ?? null),
  };
}

function workout(localDate: string, status: Workout['status'] = 'finished', extra: Partial<Workout> = {}): Workout {
  return {
    id: `${localDate}-${status}`,
    localDate,
    routineId: 'push',
    routineName: 'Push Day',
    status,
    startedAt: `${localDate}T12:00:00.000Z`,
    lastActivityAt: `${localDate}T12:00:00.000Z`,
    note: '',
    updatedAt: `${localDate}T12:00:00.000Z`,
    ...extra,
  };
}

// Wednesday 28 October 2026.
const TODAY = '2026-10-28';
const wed = new Date(2026, 9, 28);
const lastWed = new Date(2026, 9, 21);
const nextWed = new Date(2026, 10, 4);
const everyWednesday = [plan('2026-10-01', { [WEDNESDAY]: 'push' })];

const statusOf = (date: Date, schedules: WeeklySchedule[], workouts: Workout[] = []) =>
  dayAttendance(date, TODAY, schedules, workouts).status;

describe('dayAttendance', () => {
  it('counts a finished workout as done', () => {
    expect(statusOf(lastWed, everyWednesday, [workout('2026-10-21')])).toBe('done');
  });

  it('counts a past gym day with no workout as missed', () => {
    expect(statusOf(lastWed, everyWednesday)).toBe('missed');
  });

  it('does not mark today as missed while it is still going', () => {
    expect(statusOf(wed, everyWednesday)).toBe('planned');
  });

  it('shows future gym days as planned', () => {
    expect(statusOf(nextWed, everyWednesday)).toBe('planned');
  });

  it('shows non-gym days as rest', () => {
    expect(statusOf(new Date(2026, 9, 22), everyWednesday)).toBe('rest');
  });

  it('expects nothing before the first schedule existed', () => {
    expect(statusOf(new Date(2026, 8, 30), everyWednesday)).toBe('none');
  });

  it('expects nothing when there has never been a schedule', () => {
    expect(statusOf(lastWed, [])).toBe('none');
    expect(statusOf(wed, [])).toBe('none');
    expect(statusOf(nextWed, [])).toBe('none');
  });

  it('a workout that is still running is not missed', () => {
    expect(statusOf(lastWed, everyWednesday, [workout('2026-10-21', 'active')])).toBe('inProgress');
  });

  it('counts a workout done on a rest day', () => {
    expect(statusOf(new Date(2026, 9, 22), everyWednesday, [workout('2026-10-22')])).toBe('done');
  });

  it('ignores a discarded workout, so the day is missed', () => {
    const discarded = workout('2026-10-21', 'finished', { deletedAt: '2026-10-21T13:00:00.000Z' });
    expect(statusOf(lastWed, everyWednesday, [discarded])).toBe('missed');
  });

  it('changing the schedule does not rewrite past attendance', () => {
    const changed = [...everyWednesday, plan(TODAY, { [THURSDAY]: 'pull' })];
    expect(statusOf(lastWed, changed)).toBe('missed');
    expect(dayAttendance(lastWed, TODAY, changed, []).plannedRoutineId).toBe('push');
    expect(statusOf(wed, changed)).toBe('rest');
    expect(statusOf(new Date(2026, 9, 29), changed)).toBe('planned');
  });

  it('remembers which routine was planned on a past day', () => {
    const changed = [...everyWednesday, plan('2026-10-25', { [SUNDAY]: 'legs', [WEDNESDAY]: 'pull' })];
    expect(dayAttendance(lastWed, TODAY, changed, []).plannedRoutineId).toBe('push');
    expect(dayAttendance(wed, TODAY, changed, []).plannedRoutineId).toBe('pull');
  });
});

describe('week summary', () => {
  it('covers Saturday to Friday and counts only gym days', () => {
    const fiveDays = [plan('2026-10-01', { 0: 'a', 1: 'b', 2: 'c', 3: 'd', 4: 'e' })];
    const days = weekAttendance(lastWed, TODAY, fiveDays, [
      workout('2026-10-18'),
      workout('2026-10-19'),
      workout('2026-10-20'),
      workout('2026-10-22'),
    ]);
    expect(days.map((day) => day.localDate)).toEqual([
      '2026-10-17',
      '2026-10-18',
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
    ]);
    expect(days.map((day) => day.status)).toEqual(['rest', 'done', 'done', 'done', 'missed', 'done', 'rest']);
    expect(summarizeWeek(days)).toEqual({ attended: 4, expected: 5 });
  });
});
