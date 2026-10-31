import { Fragment } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { BottomNav } from './components/BottomNav';
import { ResumeWorkout } from './components/ResumeWorkout';
import { ThemeBand } from './components/ThemeDecorations';
import { usePreferences } from './preferences/PreferencesContext';
import { FinishWorkoutScreen } from './screens/FinishWorkoutScreen';
import { ForgotPasswordScreen } from './screens/ForgotPasswordScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { LanguageScreen } from './screens/LanguageScreen';
import { LoginScreen } from './screens/LoginScreen';
import { ResetPasswordScreen } from './screens/ResetPasswordScreen';
import { RoutineEditorScreen } from './screens/RoutineEditorScreen';
import { RoutinesScreen } from './screens/RoutinesScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TodayScreen } from './screens/TodayScreen';
import { WorkoutDetailScreen } from './screens/WorkoutDetailScreen';
import { WorkoutScreen } from './screens/WorkoutScreen';

/** Sends people who haven't chosen a language to the first-launch screen. */
function RequireLanguage() {
  const { language } = usePreferences();
  return language ? <Outlet /> : <Navigate to="/welcome" replace />;
}

/** Login screens, which signed-in people skip. */
function SignedOutOnly() {
  const { status } = useAuth();
  if (status === 'loading') return <main className="flex-1" />;
  return status === 'signedIn' ? <Navigate to="/today" replace /> : <Outlet />;
}

/** Everything else. Screens read the account's data, so they wait until it has been opened. */
function RequireAccount() {
  const { status, userId } = useAuth();
  if (status === 'loading') return <main className="flex-1" />;
  if (status === 'signedOut') return <Navigate to="/login" replace />;
  return (
    <Fragment key={userId}>
      <ResumeWorkout />
      <Outlet />
    </Fragment>
  );
}

function WithBottomNav() {
  return (
    <>
      <Outlet />
      <BottomNav />
    </>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
          <ThemeBand />
          <Routes>
            <Route path="/welcome" element={<LanguageScreen />} />
            <Route element={<RequireLanguage />}>
              <Route element={<SignedOutOnly />}>
                <Route path="/login" element={<LoginScreen />} />
                <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
              </Route>
              <Route element={<RequireAccount />}>
                <Route element={<WithBottomNav />}>
                  <Route path="/today" element={<TodayScreen />} />
                  <Route path="/routines" element={<RoutinesScreen />} />
                  <Route path="/history" element={<HistoryScreen />} />
                </Route>
                <Route path="/history/:workoutId" element={<WorkoutDetailScreen />} />
                <Route path="/workout" element={<WorkoutScreen />} />
                <Route path="/workout/finish" element={<FinishWorkoutScreen />} />
                <Route path="/routines/new" element={<RoutineEditorScreen />} />
                <Route path="/routines/:routineId" element={<RoutineEditorScreen />} />
                <Route path="/settings" element={<SettingsScreen />} />
                <Route path="/reset-password" element={<ResetPasswordScreen />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/today" replace />} />
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
