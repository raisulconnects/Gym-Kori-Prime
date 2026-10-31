import { describe, expect, it } from 'vitest';
import { BUILT_IN_EXERCISES, exerciseKey, searchExercises } from './exerciseCatalog';

describe('built-in exercises', () => {
  it('have unique IDs', () => {
    const ids = BUILT_IN_EXERCISES.map((exercise) => exercise.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('exerciseKey', () => {
  it('ignores case, spaces and hyphens', () => {
    expect(exerciseKey('Push-Up')).toBe(exerciseKey('push up'));
    expect(exerciseKey('Push-Up')).toBe(exerciseKey('PUSHUP'));
  });

  it('keeps Bangla letters', () => {
    expect(exerciseKey('আমার ব্যায়াম')).not.toBe('');
  });
});

describe('searchExercises', () => {
  it('matches however the name is typed', () => {
    const names = searchExercises(BUILT_IN_EXERCISES, 'pushup').map((exercise) => exercise.name);
    expect(names).toContain('Push Up');
  });

  it('returns everything in alphabetical order for an empty search', () => {
    const results = searchExercises(BUILT_IN_EXERCISES, '');
    expect(results).toHaveLength(BUILT_IN_EXERCISES.length);
    expect(results[0]?.name).toBe('Arnold Press');
  });

  it('returns nothing when there is no match', () => {
    expect(searchExercises(BUILT_IN_EXERCISES, 'zzz')).toEqual([]);
  });
});
