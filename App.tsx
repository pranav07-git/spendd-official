import { useEffect, useRef, useState } from 'react';
import { AppState, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  createNavigationContainerRef,
  DarkTheme,
  DefaultTheme,
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
import { HomeScreen } from './src/screens/home/HomeScreen';
import { IntroScreen } from './src/screens/IntroScreen';
import { LegalScreen } from './src/screens/LegalScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { SetBudgetScreen } from './src/screens/SetBudgetScreen';
import { SignUpScreen } from './src/screens/SignUpScreen';
import { StoryScreen } from './src/screens/StoryScreen';
import { TransactionDetailsScreen } from './src/screens/TransactionDetailsScreen';
import { UnlockScreen } from './src/screens/UnlockScreen';
import { clearAppState, isSetupComplete } from './src/storage/appState';
import { clearSecureData, hasPin } from './src/storage/secure';
import { loadSession, onAuthStateChanged } from './src/auth/session';
import { ThemeProvider, useTheme } from './src/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** Back in Spendd after longer than this away, and it asks for the PIN again. */
const RELOCK_AFTER_MS = 30_000;
/** Screens shown before there is a PIN to ask for (sign-in and setup), and the lock screen itself. */
const UNLOCKED_ROUTES: (keyof RootStackParamList)[] = [
  'Intro',
  'Login',
  'SignUp',
  'Consent',
  'CreatePin',
  'ConfirmPin',
  'Biometric',
  'Unlock',
  'Legal',
];

/** Locks Spendd again when it comes back after a while in the background. */
function useRelock() {
  const leftAt = useRef<number | null>(null);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'background') {
        leftAt.current = Date.now();
        return;
      }
      if (state !== 'active' || leftAt.current == null) {
        return;
      }
      const away = Date.now() - leftAt.current;
      leftAt.current = null;
      const route = navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : undefined;
      if (away < RELOCK_AFTER_MS || !route || UNLOCKED_ROUTES.includes(route)) {
        return;
      }
      hasPin()
        .then(locked => {
          if (locked) {
            navigationRef.reset({ index: 0, routes: [{ name: 'Unlock' }] });
          }
        })
        .catch(() => {});
    });
    return () => sub.remove();
  }, []);
}


/** Signed-out screens: the welcome screen and sign-in. Signing in moves on from these. */
const AUTH_ROUTES: (keyof RootStackParamList)[] = ['Intro', 'Login', 'SignUp'];

/** Where a signed-in user goes: unlock if this phone is set up, otherwise the rest of setup. */
async function routeForSignedIn(): Promise<keyof RootStackParamList> {
  if ((await isSetupComplete()) && (await hasPin())) {
    return 'Unlock';
  }
  // A setup abandoned midway restarts from consent rather than leaving a stray PIN.
  await Promise.all([clearSecureData(), clearAppState()]);
  return 'Consent';
}

async function resolveInitialRoute(): Promise<keyof RootStackParamList> {
  return (await loadSession()) ? routeForSignedIn() : 'Intro';
}

/**
 * Moves the app along when the account changes: signing in or signing up continues to setup
 * or unlock; signing out returns to the welcome screen. Only acts on screens where that change
 * matters, so it never interrupts setup or the app itself.
 */
function useAuthStateNavigation() {
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(async user => {
      if (!navigationRef.isReady()) {
        return;
      }
      const route = navigationRef.getCurrentRoute()?.name;
      const onAuthScreen = route != null && AUTH_ROUTES.includes(route);
      if (!user) {
        if (!onAuthScreen) {
          navigationRef.reset({ index: 0, routes: [{ name: 'Intro' }] });
        }
        return;
      }
      if (onAuthScreen) {
        const next = await routeForSignedIn();
        navigationRef.reset({ index: 0, routes: [{ name: next }] });
      }
    });
    return unsubscribe;
  }, []);
}

function AppRoot() {
  const { c, isDark } = useTheme();
  const navTheme: Theme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      background: c.bg,
      card: c.surface,
      text: c.ink,
      border: c.line,
      primary: c.marigold,
    },
  };
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);
  useAuthStateNavigation();
  useRelock();

  useEffect(() => {
    resolveInitialRoute()
      .catch(() => 'Intro' as const)
      .then(setInitialRoute);
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      {initialRoute ? (
        <NavigationContainer ref={navigationRef} theme={navTheme}>
          <Stack.Navigator
            initialRouteName={initialRoute}
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: c.bg },
            }}>
            <Stack.Screen name="Intro" component={IntroScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
            <Stack.Screen name="Consent" component={ConsentScreen} />
            <Stack.Screen name="CreatePin" component={CreatePinScreen} />
            <Stack.Screen name="ConfirmPin" component={ConfirmPinScreen} />
            <Stack.Screen name="Biometric" component={BiometricScreen} />
            <Stack.Screen name="Unlock" component={UnlockScreen} />
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="TransactionDetails" component={TransactionDetailsScreen} />
            <Stack.Screen name="AddTransaction" component={AddTransactionScreen} />
            <Stack.Screen name="Story" component={StoryScreen} options={{ animation: 'fade' }} />
            <Stack.Screen name="SetBudget" component={SetBudgetScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="ChangePin" component={ChangePinScreen} />
            <Stack.Screen name="Legal" component={LegalScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      ) : (
        <View style={[styles.splash, { backgroundColor: c.bg }]} />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({ splash: { flex: 1 } });

function App() {
  return (
    <ThemeProvider>
      <AppRoot />
    </ThemeProvider>
  );
}

export default App;
