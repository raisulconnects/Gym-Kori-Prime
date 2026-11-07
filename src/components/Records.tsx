import { Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ExerciseRecords, RecordKind, RecordValue, SessionRecords } from '../data/records';
import { formatWeight } from '../lib/units';
import { usePreferences } from '../preferences/PreferencesContext';
import { useFormat } from '../preferences/useFormat';

/** Always has text beside the icon, so a record never relies on color alone. */
export function RecordBadge({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-accent">
      <Trophy aria-hidden="true" size={16} strokeWidth={2.5} />
      {label ?? t('records.newRecord')}
    </span>
  );
}

/** Every record kind a session broke, in a fixed order, for summaries. */
export function brokenKinds(records: SessionRecords): RecordKind[] {
  const kinds = new Set(Object.values(records.bySet).flat());
  if (records.volume) kinds.add('volume');
  return (['heaviest', 'oneRepMax', 'mostReps', 'volume'] as const).filter((kind) => kinds.has(kind));
}

/** Shows records in the user's unit and language. */
export function useRecordText() {
  const { t } = useTranslation();
  const { unit } = usePreferences();
  const format = useFormat();
  const unitName = t(`units.${unit}`);

  const weight = (weightKg: number, whole = false) => {
    const shown = formatWeight(weightKg, unit);
    return `${format.number(whole ? String(Math.round(Number(shown))) : shown)} ${unitName}`;
  };

  const value = (kind: RecordKind, record: RecordValue): string => {
    if (kind === 'heaviest') {
      return t('records.weightReps', { weight: weight(record.value), reps: format.number(record.set?.reps ?? 0) });
    }
    if (kind === 'mostReps') return t('records.reps', { count: record.value, shown: format.number(record.value) });
    // Estimates and totals are shown whole, so they don't look more exact than they are.
    return weight(record.value, true);
  };

  return {
    value,
    /** The record people most want to beat: the heaviest set, or the most reps for bodyweight work. */
    best(records: ExerciseRecords): string | null {
      if (records.heaviest) return value('heaviest', records.heaviest);
      if (records.mostReps) return value('mostReps', records.mostReps);
      return null;
    },
  };
}
