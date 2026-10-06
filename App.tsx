import { useEffect, useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
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
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { HomeScreen } from './src/screens/home/HomeScreen';
import { IntroScreen } from './src/screens/IntroScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { SetBudgetScreen } from './src/screens/SetBudgetScreen';
import { SignUpScreen } from './src/screens/SignUpScreen';
import { StoryScreen } from './src/screens/StoryScreen';
import { TransactionDetailsScreen } from './src/screens/TransactionDetailsScreen';
import { UnlockScreen } from './src/screens/UnlockScreen';
import { clearAppState, isSetupComplete } from './src/storage/appState';
import { clearSecureData, hasPin } from './src/storage/secure';
import { getCurrentUser, onAuthStateChanged } from './src/auth/firebase';
import { ThemeProvider, useTheme } from './src/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

async function resolveInitialRoute(): Promise<keyof RootStackParamList> {
  const firebaseUser = getCurrentUser();
  if (!firebaseUser) {
    return 'Intro';
  }
  if ((await isSetupComplete()) && (await hasPin())) {
    return 'Unlock';
  }
  // A setup abandoned midway restarts from scratch rather than leaving a stray PIN.
  await Promise.all([clearSecureData(), clearAppState()]);
  return 'Intro';
}

function useAuthStateNavigation() {
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(async user => {
      if (!navigationRef.isReady()) {
        return;
      }
      if (!user) {
        navigationRef.reset({ index: 0, routes: [{ name: 'Intro' }] });
        return;
      }
      if ((await isSetupComplete()) && (await hasPin())) {
        navigationRef.reset({ index: 0, routes: [{ name: 'Unlock' }] });
        return;
      }
      navigationRef.reset({ index: 0, routes: [{ name: 'Intro' }] });
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
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
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
