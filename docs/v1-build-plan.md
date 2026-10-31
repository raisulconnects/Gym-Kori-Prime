# Gym Kori (জিম করি): V1 Build Plan

Approved design: https://claude.ai/artifact/W7bJittkzVyMK67bZ48aH8

## What V1 is

A mobile-first installable web app for one person tracking their own training. The user sets a weekly routine, checks in, ticks off what they did, and sees their attendance and workout history. It comes in English and Bangla, with three themes: Modern, Nakshi Kantha and Rickshaw Art.

V1 is ready when one person can do all of this on a real phone, in any theme and either language, without losing data on a weak signal.

## Stack

| Part | Choice |
|---|---|
| App | React, TypeScript, Vite |
| Styling | Tailwind CSS with theme variables |
| Translations | `react-i18next` |
| Install and offline loading | `vite-plugin-pwa` |
| Phone storage | Dexie (IndexedDB) |
| Login and database | Supabase (Postgres) |
| Hosting | Vercel |
| Tests | Vitest and Playwright |
| Native app (after V1) | Capacitor |

## Rules from the first commit

- **No fixed colors, fonts or corner sizes in screens.** They come from theme variables.
- **No interface text typed into screens.** It comes from the English and Bangla translation files.
- **The phone saves first.** Workout actions write to Dexie immediately, then sync to Supabase. They never wait for the network.
- **Weights are stored in kg as plain numbers.** Bangla digits and lb are only for entry and display.
- **Every table is protected per user.** Supabase row-level security stops one user reading another's data.

## Data model

| Table | Holds |
|---|---|
| `profiles` | Display name, language, theme, weight unit |
| `exercises` | Built-in exercises (no owner) and users' own exercises |
| `routines` | A user's named routines |
| `routine_exercises` | Exercises in a routine, in order, with target sets and reps |
| `weekly_schedules` | Routine or rest for each weekday, with the date it applies from |
| `workouts` | Local date, routine, start and end time, edited duration, note |
| `workout_exercises` | Exercises in a workout, including skipped and extra ones |
| `workout_sets` | Weight in kg, reps, done or not |

All IDs are created on the phone so records can be made offline. Synced tables also record when a row was last updated and when it was deleted.

## Behavior rules

- **Changing the schedule never rewrites history.** Schedule changes apply from a given date, so old attendance stays accurate.
- **Missed days are worked out, not stored.** A scheduled day counts as missed once it has ended with no workout.
- **Days follow the phone's local date.** A workout belongs to the date it started on.
- **An unfinished workout survives closing the app.** Reopening returns to it.
- **A forgotten Finish can't quietly ruin the data.** On reopening after a long gap, the app asks the user to confirm the duration.
- **Sync conflicts:** the most recent change wins. This is enough for one person on a few devices.
- **Workouts follow the schedule.** Rest days have no check-in in V1.

## Milestones

Everything is built and proven locally first, then deployed step by step. V1 is a website used in the phone's browser, and adding it to the home screen is optional.

**Build order:** 1, 2 and 4 (done), then 5 and 7, which work on the phone with no accounts. Then 3 and 6, which need Supabase. Deployment and 8 come last.

Each milestone ends with something that can be tried on a phone, using `npm run phone` on the same Wi-Fi until the app is deployed.

### 1. Project setup
- Git repository, Vite app, Tailwind, linting and test tools
- Vercel previews are added at the deployment stage
- **Done when:** the app runs locally and opens on a phone on the same Wi-Fi.

### 2. Themes, language and app shell
- Three themes as variables, with their decorations
- English and Bangla files, Bangla digits and dates, fonts loaded per theme and language
- Bottom tabs and the Settings screen
- **Done when:** switching theme and language in Settings changes everything instantly and survives a reload.

### 3. Accounts
- Supabase project, tables and row-level security
- First-launch language choice, sign-up, login, Google sign-in, password reset, log out
- Delete account
- Saved language, theme and unit
- **Done when:** two test accounts can't see each other's data, and preferences follow a user to another device.

### 4. Exercises, routines and schedule
- Built-in exercise list in English, plus search and custom exercises
- Routine editor
- Weekly schedule with rest days
- **Done when:** a user can build a week of routines and see today's plan on the home screen.

### 5. Workout session
- Check-in, pre-filled sets, one-tap ticks, editing weight and reps
- Skip, extra sets and exercises, and notes
- Last session's numbers from real data
- Rest timer, with the screen kept awake
- Finish screen with editable duration
- **Done when:** a full workout can be logged in airplane mode and is still there after closing the app.

### 6. Sync and offline
- Installable app that opens with no signal
- Background sync of changes in both directions, with a clear "not synced yet" state
- **Done when:** a workout logged offline appears on a second device after reconnecting, with nothing lost or duplicated.

### 7. History and attendance
- Weekly attendance, including missed and rest days
- Past workouts and their details
- Week starts on Saturday
- **Done when:** History matches what was logged, including after a schedule change.

### 8. Launch check
- Check every screen in all 6 theme and language combinations
- Test on a real Android phone and iPhone, including installing the app and a weak connection
- Accessibility check against the design skill's checklist
- Final review of the Bangla wording
- Privacy policy page and a custom email sender for account emails
- Production domain
- **Done when:** the launch checklist passes and a few real people finish a week of workouts without data problems.

## Tests

- **Automatic tests:** digit conversion, kg and lb, missed-day logic, duration, sync conflicts.
- **End-to-end test of the main flow:** sign up, set the week, check in, log a workout offline, sync, see it in History.
- **Screenshot checks:** the main screens in all 6 combinations.

## What the owner needs to provide

| When | What |
|---|---|
| Milestone 3 | Supabase account and a Google Cloud project for Google sign-in |
| Deployment | GitHub and Vercel accounts |
| Milestone 8 | Domain, sender email address, privacy policy details, an iPhone and Android phone for testing |

## Known limits and risks

- **Rest timer:** the web version can't reliably alert on a locked phone. The screen stays awake instead, and lock-screen alerts arrive with the native app.
- **iPhone storage:** Safari can clear data for websites that haven't been used for a while, so unsynced workouts are the main risk. The app syncs as soon as it can and shows when something hasn't synced.
- **Costs:** Vercel's free plan is non-commercial only, and Supabase's free plan pauses inactive projects. Both need paid plans before real launch or making money.
- **Bangla wording:** written by Claude and not yet reviewed by the owner.

## Not in V1

Analytics and charts, personal records, body measurements, streaks, ready-made programs, exercise videos, weight suggestions, social features, wearable sync, nutrition, AI coaching, and the native app.
