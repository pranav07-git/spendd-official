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
import { HomeScreen } from './src/screens/home/HomeScreen';
import { IntroScreen } from './src/screens/IntroScreen';
import { SetBudgetScreen } from './src/screens/SetBudgetScreen';
import { StatementScreen } from './src/screens/StatementScreen';
import { StoryScreen } from './src/screens/StoryScreen';
import { TransactionDetailsScreen } from './src/screens/TransactionDetailsScreen';
import { UnlockScreen } from './src/screens/UnlockScreen';
import { clearAppState, isSetupComplete } from './src/storage/appState';
import { shouldRelock } from './src/storage/autoLock';
import { clearSecureData, hasPinWithRetry } from './src/storage/secure';
import { colors } from './src/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

const theme: Theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.background, card: colors.background },
};

async function resolveInitialRoute(): Promise<keyof RootStackParamList> {
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

function App() {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);
  useRelockOnReturn();

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
            <Stack.Screen name="Intro" component={IntroScreen} />
            <Stack.Screen name="Statement" component={StatementScreen} />
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
        <View style={styles.splash} />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: colors.background },
});

export default App;
