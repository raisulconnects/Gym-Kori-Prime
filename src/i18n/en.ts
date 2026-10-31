export const en = {
  app: { name: 'Gym Kori' },
  nav: {
    mainMenu: 'Main menu',
    today: 'Today',
    routines: 'Routines',
    history: 'History',
  },
  today: {
    thisWeek: 'This week',
    label: 'Today',
    noPlanTitle: 'No plan yet',
    noPlanBody: 'Add a routine and choose your gym days to see your plan here.',
    setUpWeek: 'Set up my week',
  },
  week: {
    todaySuffix: 'today',
  },
  routines: {
    title: 'Routines',
    emptyTitle: 'No routines yet',
    emptyBody: 'Your saved routines and weekly schedule will appear here.',
  },
  history: {
    title: 'History',
    emptyTitle: 'No workouts yet',
    emptyBody: 'Your attendance and past workouts will appear here.',
  },
  settings: {
    title: 'Settings',
    open: 'Open settings',
    backToToday: 'Today',
    language: 'Language',
    theme: 'Theme',
    units: 'Weight unit',
    themes: {
      modern: 'Modern',
      kantha: 'Nakshi Kantha',
      rickshaw: 'Rickshaw Art',
    },
    unitNames: {
      kg: 'Kilograms (kg)',
      lb: 'Pounds (lb)',
    },
  },
};

export type Translations = typeof en;
