const NAMES = [
  'Arnold Press',
  'Back Extension',
  'Barbell Curl',
  'Barbell Row',
  'Bench Press',
  'Bent-Over Reverse Fly',
  'Bicycle Crunch',
  'Bulgarian Split Squat',
  'Cable Crunch',
  'Cable Fly',
  'Cable Row',
  'Calf Raise',
  'Chest Dip',
  'Chest Fly Machine',
  'Chest Press Machine',
  'Chin Up',
  'Close-Grip Bench Press',
  'Concentration Curl',
  'Crunch',
  'Deadlift',
  'Decline Bench Press',
  'Dumbbell Bench Press',
  'Dumbbell Curl',
  'Dumbbell Fly',
  'Dumbbell Row',
  'Dumbbell Shoulder Press',
  'Face Pull',
  'Front Raise',
  'Front Squat',
  'Glute Bridge',
  'Goblet Squat',
  'Hack Squat',
  'Hammer Curl',
  'Hanging Leg Raise',
  'Hip Thrust',
  'Incline Bench Press',
  'Incline Dumbbell Press',
  'Lat Pulldown',
  'Lateral Raise',
  'Leg Curl',
  'Leg Extension',
  'Leg Press',
  'Lunge',
  'Overhead Press',
  'Overhead Triceps Extension',
  'Plank',
  'Preacher Curl',
  'Pull Up',
  'Push Up',
  'Rear Delt Fly',
  'Romanian Deadlift',
  'Russian Twist',
  'Seated Calf Raise',
  'Seated Row',
  'Shoulder Press',
  'Shrug',
  'Skull Crusher',
  'Squat',
  'Step Up',
  'T-Bar Row',
  'Treadmill',
  'Triceps Dip',
  'Triceps Pushdown',
  'Upright Row',
  'Walking Lunge',
];

function toId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export interface ExerciseOption {
  id: string;
  name: string;
}

/** Built-in IDs come from the names, so never rename an entry. Add a new one instead. */
export const BUILT_IN_EXERCISES: ExerciseOption[] = NAMES.map((name) => ({ id: toId(name), name }));

/** Makes "push-up", "Push Up" and "pushup" compare as the same text. */
export function exerciseKey(name: string): string {
  return name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

/** Finds exercises containing the search text, in alphabetical order. */
export function searchExercises(exercises: ExerciseOption[], query: string): ExerciseOption[] {
  const key = exerciseKey(query);
  return exercises
    .filter((exercise) => exerciseKey(exercise.name).includes(key))
    .sort((first, second) => first.name.localeCompare(second.name));
}
