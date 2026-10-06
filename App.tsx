import { useEffect, useState } from 'react';
import { AppState, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  createNavigationContainerRef,
  DarkTheme,
  NavigationContainer,
  type Theme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './src/navigation/types';
import { AddTransactionScreen } from './src/screens/AddTransactionScreen';
import { BiometricScreen } from './src/screens/BiometricScreen';
import { ChangePinScreen } from './src/screens/ChangePinScreen';
import { ConfirmPinScreen } from './src/screens/ConfirmPinScreen';
import { ConsentScreen } from './src/screens/ConsentScreen';
import { CreatePinScreen } from './src/screens/CreatePinScreen';
import { EditProfileScreen } from './src/screens/EditProfileScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { HomeScreen } from './src/screens/home/HomeScreen';
import { IntroScreen } from './src/screens/IntroScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { SetBudgetScreen } from './src/screens/SetBudgetScreen';
import { SignUpScreen } from './src/screens/SignUpScreen';
import { StatementScreen } from './src/screens/StatementScreen';
import { StoryScreen } from './src/screens/StoryScreen';
import { TransactionDetailsScreen } from './src/screens/TransactionDetailsScreen';
import { UnlockScreen } from './src/screens/UnlockScreen';
import { clearAppState, isSetupComplete } from './src/storage/appState';
import { shouldRelock } from './src/storage/autoLock';
import { clearSecureData, hasPinWithRetry } from './src/storage/secure';
import { getCurrentUser, onAuthStateChanged } from './src/auth/firebase';
import { colors } from './src/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

const theme: Theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.background, card: colors.background },
};

/**
 * Resolves the screen to show on launch:
 *  1. No Firebase user  → 'Intro' (shows Sign In / Sign Up entry)
 *  2. Firebase user, setup complete, PIN exists → 'Unlock'
 *  3. Firebase user, setup not complete → 'Intro' (continues onboarding)
 */
async function resolveInitialRoute(): Promise<keyof RootStackParamList> {
  const firebaseUser = getCurrentUser();
  if (!firebaseUser) {
    // Not signed in to cloud account yet.
    return 'Intro';
  }

  if (await isSetupComplete()) {
    let pinSaved: boolean;
    try {
      pinSaved = await hasPinWithRetry();
    } catch {
      // The keychain can't be read right now; keep everything and ask for the PIN.
      return 'Unlock';
    }
    if (pinSaved) {
      return 'Unlock';
    }
  }

  // A setup abandoned midway restarts from scratch rather than leaving a stray PIN.
  await Promise.all([clearSecureData(), clearAppState()]);
  return 'Intro';
}

/** Asks for the PIN again when the app comes back after a while in the background. */
function useRelockOnReturn() {
  useEffect(() => {
    let backgroundedAt: number | null = null;
    const sub = AppState.addEventListener('change', state => {
      if (state === 'background') {
        backgroundedAt = Date.now();
        return;
      }
      if (state !== 'active') {
        return;
      }
      const route = navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : undefined;
      if (shouldRelock(backgroundedAt, Date.now(), route)) {
        navigationRef.reset({ index: 0, routes: [{ name: 'Unlock' }] });
      }
      backgroundedAt = null;
    });
    return () => sub.remove();
  }, []);
}

/**
 * Watches Firebase auth state after the app has launched.
 * When the user signs out mid-session, redirect back to Intro.
 * When the user signs in (e.g. from LoginScreen), navigate to
 * the appropriate next step.
 */
function useAuthStateNavigation() {
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(async user => {
      if (!navigationRef.isReady()) {
        return;
      }
      if (!user) {
        // User signed out — go back to intro.
        navigationRef.reset({ index: 0, routes: [{ name: 'Intro' }] });
        return;
      }
      // User just signed in — decide where to send them.
      if (await isSetupComplete()) {
        let pinSaved = false;
        try {
          pinSaved = await hasPinWithRetry();
        } catch { /* ignore */ }
        if (pinSaved) {
          navigationRef.reset({ index: 0, routes: [{ name: 'Unlock' }] });
          return;
        }
      }
      // New user or incomplete setup → onboarding.
      navigationRef.reset({ index: 0, routes: [{ name: 'Intro' }] });
    });
    return unsubscribe;
  }, []);
}

function App() {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);
  useRelockOnReturn();
  useAuthStateNavigation();

  useEffect(() => {
    resolveInitialRoute()
      .catch(() => 'Intro' as const)
      .then(setInitialRoute);
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      {initialRoute ? (
        <NavigationContainer ref={navigationRef} theme={theme}>
          <Stack.Navigator
            initialRouteName={initialRoute}
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: colors.background },
            }}>
            {/* Onboarding / landing */}
            <Stack.Screen name="Intro" component={IntroScreen} />

            {/* Cloud auth */}
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />

            {/* PIN + biometric setup */}
            <Stack.Screen name="Statement" component={StatementScreen} />
            <Stack.Screen name="Consent" component={ConsentScreen} />
            <Stack.Screen name="CreatePin" component={CreatePinScreen} />
            <Stack.Screen name="ConfirmPin" component={ConfirmPinScreen} />
            <Stack.Screen name="Biometric" component={BiometricScreen} />

            {/* App lock */}
            <Stack.Screen name="Unlock" component={UnlockScreen} />

            {/* Main app */}
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="TransactionDetails" component={TransactionDetailsScreen} />
            <Stack.Screen name="AddTransaction" component={AddTransactionScreen} />
            <Stack.Screen name="Story" component={StoryScreen} options={{ animation: 'fade' }} />
            <Stack.Screen name="SetBudget" component={SetBudgetScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="ChangePin" component={ChangePinScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      ) : (
        <View style={styles.splash} />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: colors.background },
});

export default App;
