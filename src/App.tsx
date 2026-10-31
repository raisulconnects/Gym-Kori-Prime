import { useTranslation } from 'react-i18next';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { ResumeWorkout } from './components/ResumeWorkout';
import { ThemeBand } from './components/ThemeDecorations';
import { usePreferences } from './preferences/PreferencesContext';
import { EmptyListScreen } from './screens/EmptyListScreen';
import { FinishWorkoutScreen } from './screens/FinishWorkoutScreen';
import { LanguageScreen } from './screens/LanguageScreen';
import { RoutineEditorScreen } from './screens/RoutineEditorScreen';
import { RoutinesScreen } from './screens/RoutinesScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TodayScreen } from './screens/TodayScreen';
import { WorkoutScreen } from './screens/WorkoutScreen';

/** Sends people who haven't chosen a language to the first-launch screen. */
function RequireLanguage() {
  const { language } = usePreferences();
  return language ? <Outlet /> : <Navigate to="/welcome" replace />;
}

function WithBottomNav() {
  return (
    <>
      <Outlet />
      <BottomNav />
    </>
  );
}

function HistoryScreen() {
  const { t } = useTranslation();
  return (
    <EmptyListScreen title={t('history.title')} emptyTitle={t('history.emptyTitle')} emptyBody={t('history.emptyBody')} />
  );
}

export function App() {
  return (
    <BrowserRouter>
      <ResumeWorkout />
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
        <ThemeBand />
        <Routes>
          <Route path="/welcome" element={<LanguageScreen />} />
          <Route element={<RequireLanguage />}>
            <Route element={<WithBottomNav />}>
              <Route path="/today" element={<TodayScreen />} />
              <Route path="/routines" element={<RoutinesScreen />} />
              <Route path="/history" element={<HistoryScreen />} />
            </Route>
            <Route path="/workout" element={<WorkoutScreen />} />
            <Route path="/workout/finish" element={<FinishWorkoutScreen />} />
            <Route path="/routines/new" element={<RoutineEditorScreen />} />
            <Route path="/routines/:routineId" element={<RoutineEditorScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
          </Route>
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
