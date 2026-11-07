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
| `profiles` | Display name, language, theme, weight unit, and optional gender and height |
| `exercises` | Built-in exercises (no owner) and users' own exercises |
| `routines` | A user's named routines |
| `routine_exercises` | Exercises in a routine, in order, with target sets and reps |
| `weekly_schedules` | Routine or rest for each weekday, with the date it applies from |
| `workouts` | Local date, routine, start and end time, edited duration, note |
| `workout_exercises` | Exercises in a workout, including skipped and extra ones |
| `workout_sets` | Weight in kg, reps, done or not |
| `body_weights` | Optional body weight in kg, one entry per day, so the history is kept |

All IDs are created on the phone so records can be made offline. Synced tables also record when a row was last updated and when it was deleted.

### Ready for future features

- **Adding is safe:** new features can add tables and optional columns without touching existing data. Dexie and Postgres both handle this through versioned migrations.
- **History can't be rewritten:** workouts keep their own copy of the routine name and their own sets, so editing or deleting a routine leaves them alone.
- **Analytics needs no reshaping:** weights are plain kg, dates are the user's local date, and each set is its own row.
- **Sync is prepared:** IDs are created on the phone, and rows carry update and delete times.

### To add when the feature needs it

- **Time and distance sets:** a set only holds weight and reps today, so Plank and Treadmill are logged as reps. Optional duration and distance columns, plus a type on each exercise, can be added later.
- **Muscle groups:** the built-in exercise list only has names. Charts by muscle group will need this added.
- **More body measurements:** chest, arms and others get their own table in V2. Body weight is already kept in `body_weights`.

### Accounts and ownership

- **Profile:** display name, language, theme and weight unit, stored per user. Gender and height are optional, and need a connection to change.
- **On the phone:** each account has its own local database, so people sharing a phone can't see each other's data and logging out loses nothing. Data created before accounts moves into the first account to log in.
- **Row ownership:** every Supabase table has a user ID and row-level security. Rows can't be erased except by deleting the account, which removes all of them.

### How sync works

- **What needs sending:** a row needs backing up whenever its `updatedAt` differs from the last version the server confirmed, so every change is picked up automatically.
- **When it runs:** on opening the app, about 2 seconds after a change, on reconnecting, on returning to the app, and every minute while it's open.
- **What's new:** the server stamps each row with the time it arrived. Devices ask for anything after the last stamp they saw, using the server's clock rather than their own.
- **Conflicts:** each row is compared on its own, and the most recent change wins on both the device and the server.

### Setting up Supabase

1. Run each file in `supabase/migrations/` in the Supabase SQL editor, in order. Each runs once.
2. Under Authentication, URL Configuration, set the Site URL and add the app's address to the redirect URLs.
3. Turn off Confirm email, run `npm run verify:supabase` to check that accounts can't reach each other's data, then turn Confirm email back on.

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

**Build order:** 1 to 7 are done. Deployment is in progress, and 8 comes last.

**Sign-in:** V1 starts with email and password. Google sign-in moves to a later release.

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
- First-launch language choice, sign-up, login with email and password, password reset, log out
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
| Milestone 3 | A free Supabase project, for its URL and public key |
| Deployment | GitHub and Vercel accounts |
| Milestone 8 | Domain, sender email address, privacy policy details, an iPhone and Android phone for testing |

## Known limits and risks

- **Rest timer:** the web version can't reliably alert on a locked phone. The screen stays awake instead, and lock-screen alerts arrive with the native app.
- **iPhone storage:** Safari can clear data for websites that haven't been used for a while, so unsynced workouts are the main risk. The app syncs as soon as it can and shows when something hasn't synced.
- **Costs:** Vercel's free plan is non-commercial only, and Supabase's free plan pauses inactive projects. Both need paid plans before real launch or making money.
- **Device clocks:** the most recent change is judged by each device's clock, so a phone with a badly wrong clock can win or lose a conflict it shouldn't. This only matters when the same row is edited on two devices.
- **Two devices offline at once:** starting a workout on both creates two workouts, and adding the same new custom exercise on both creates two entries. Nothing is lost, and both can be seen.
- **Bangla wording:** written by Claude and not yet reviewed by the owner.

## Not in V1

Analytics and charts, personal records, measurements beyond body weight, streaks, ready-made programs, exercise videos, weight suggestions, social features, wearable sync, nutrition, AI coaching, and the native app.

## After V1

V1's launch check comes first. Later versions start only after it passes, and each milestone gets its own branch as before.

### V2: Progress

The goal is to show people they're getting stronger, mostly from data V1 already collects. The same rules as V1 still apply: themes and translations stay out of screen code, the phone saves first, and every table has row-level security.

| # | Milestone | What it adds | Builds on |
|---|---|---|---|
| 1 | **Exercise history and personal records** | Each exercise's past sessions, the heaviest weight, best set and estimated one-rep max, with a mark when a record is beaten during a workout | Sets already logged |
| 2 | **Progress charts** | Strength over time per exercise, weekly training volume, and body weight over time | Sets and `body_weights` |
| 3 | **Streaks** | Weeks in a row with all planned gym days done, shown on Today and History | Attendance and the weekly schedule |
| 4 | **More body measurements** | Optional chest, arms, waist and others, with dated history | A new table shaped like `body_weights` |
| 5 | **Google sign-in** | Signing up and logging in with a Google account, alongside email and password | Supabase Auth |

**Done when:** a user can open any exercise and see their records and progress chart, see their streak, and track their body over time, in all 6 theme and language combinations, offline as well as online.

#### Gaps to fill first

- **Time and distance sets:** Plank and Treadmill are logged as reps today. Add a type to each exercise (weight and reps, time, or distance) and optional duration and distance columns on sets, before charts are built for them.
- **Muscle groups:** add a muscle group to each built-in exercise and let people set one on their own exercises. Charts by muscle group need this.
- **Weekly volume rules:** decide whether warm-up and skipped sets count. Only sets marked done count by default.

#### Decided for milestone 1 (built)

- **Where:** a fourth bottom tab, **Progress**, lists every exercise done, and each opens its own screen with records and past sessions. Exercise names in past workouts link there too.
- **Records:** heaviest weight, estimated 1-rep max (Epley, sets of 12 reps or fewer), most reps, and best session volume. Bodyweight exercises only show most reps.
- **Rules:** only done sets in finished, kept workouts count. A record must beat earlier workouts, so equalling one doesn't count, and the first time doing an exercise sets no records.
- **Showing records:** a "New record" badge and a short vibration on the set, a list on the finish screen, and badges kept in past workouts. During a workout, the record to beat appears next to "Last time".
- **Stored:** nowhere. Records are worked out from the logged sets, so they need no syncing and disappear with a discarded workout.

#### To decide before later milestones

- Whether a streak counts weeks with every planned day done, or any gym day.
- Which chart library to use. It must work offline and follow the theme colors.

### V3: Guidance

Ready-made programs, exercise videos, and suggestions for when to increase the weight.

### V4: Extras

The native app (Capacitor), social features, wearable sync, nutrition and AI coaching.
