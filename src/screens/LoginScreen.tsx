import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { PrimaryButton, OutlineButton, TextButton } from '../components/Buttons';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import type { ScreenProps } from '../navigation/types';
import { signInWithEmail, signInWithGoogle, isAuthError } from '../auth/firebase';
import { colors, fonts } from '../theme';

export function LoginScreen({ navigation }: ScreenProps<'Login'>) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setError(null);
    setBusy(true);
    const result = await signInWithEmail(email, password);
    setBusy(false);
    if (isAuthError(result)) {
      setError(result.message);
      return;
    }
    // Successful sign-in — App.tsx's auth listener will handle navigation.
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleBusy(true);
    const result = await signInWithGoogle();
    setGoogleBusy(false);
    if (isAuthError(result)) {
      setError(result.message);
    }
    // Successful sign-in — App.tsx's auth listener will handle navigation.
  };

  return (
    <Screen>
      <Header title="SIGN IN" onBack={navigation.goBack} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Text style={styles.headline}>
            Welcome{'  '}
            <Text style={styles.headlineItalic}>back.</Text>
          </Text>
          <Text style={styles.sub}>Sign in to continue tracking your spending.</Text>

          {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>EMAIL</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={v => {
                  setEmail(v);
                  setError(null);
                }}
                placeholder="you@example.com"
                placeholderTextColor={colors.textFaint}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>PASSWORD</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={v => {
                  setPassword(v);
                  setError(null);
                }}
                placeholder="••••••••"
                placeholderTextColor={colors.textFaint}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
            </View>

            <TextButton
              label="FORGOT PASSWORD?"
              color={colors.textMuted}
              style={styles.forgotLink}
              onPress={() => navigation.navigate('ForgotPassword')}
            />
          </View>

          <View style={styles.actions}>
            <PrimaryButton
              label="SIGN IN"
              onPress={handleLogin}
              loading={busy}
              disabled={googleBusy}
            />
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>
            <OutlineButton
              label="CONTINUE WITH GOOGLE"
              onPress={handleGoogleSignIn}
              loading={googleBusy}
              disabled={busy}
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account?{'  '}</Text>
            <TextButton
              label="SIGN UP"
              color={colors.text}
              onPress={() => navigation.navigate('SignUp')}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32 },
  headline: {
    fontFamily: fonts.serif,
    fontSize: 42,
    lineHeight: 50,
    color: colors.text,
    marginTop: 40,
    letterSpacing: -0.5,
  },
  headlineItalic: { fontFamily: fonts.serifItalic },
  sub: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 24,
    color: colors.textMuted,
    marginTop: 12,
    marginBottom: 32,
  },
  errorBanner: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.danger,
    backgroundColor: '#2A1515',
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
  },
  form: { gap: 20 },
  field: { gap: 8 },
  label: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.textMuted,
  },
  input: {
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 12,
  },
  forgotLink: { alignSelf: 'flex-end', marginTop: -8 },
  actions: { gap: 16, marginTop: 40 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.textFaint,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  footerText: { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted },
});
