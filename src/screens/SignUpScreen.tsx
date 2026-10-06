import { useRef, useState } from 'react';
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
import { signUpWithEmail, signInWithGoogle, isAuthError } from '../auth/firebase';
import { colors, fonts } from '../theme';

export function SignUpScreen({ navigation }: ScreenProps<'SignUp'>) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const passwordRef = useRef<any>(null);
  const confirmRef = useRef<any>(null);

  const handleSignUp = async () => {
    if (!email.trim() || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match. Please try again.");
      return;
    }
    setError(null);
    setBusy(true);
    const result = await signUpWithEmail(email, password);
    setBusy(false);
    if (isAuthError(result)) {
      setError(result.message);
      return;
    }
    // Successful sign-up — App.tsx's auth listener will handle navigation.
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleBusy(true);
    const result = await signInWithGoogle();
    setGoogleBusy(false);
    if (isAuthError(result)) {
      setError(result.message);
    }
  };

  return (
    <Screen>
      <Header title="CREATE ACCOUNT" onBack={navigation.goBack} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Text style={styles.headline}>
            Start{'  '}
            <Text style={styles.headlineItalic}>saving</Text>
            {'  '}smarter.
          </Text>
          <Text style={styles.sub}>Create your Spendd account to get started.</Text>

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
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>PASSWORD</Text>
              <TextInput
                ref={passwordRef}
                style={styles.input}
                value={password}
                onChangeText={v => {
                  setPassword(v);
                  setError(null);
                }}
                placeholder="Min. 6 characters"
                placeholderTextColor={colors.textFaint}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>CONFIRM PASSWORD</Text>
              <TextInput
                ref={confirmRef}
                style={styles.input}
                value={confirmPassword}
                onChangeText={v => {
                  setConfirmPassword(v);
                  setError(null);
                }}
                placeholder="Re-enter password"
                placeholderTextColor={colors.textFaint}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                returnKeyType="done"
                onSubmitEditing={handleSignUp}
              />
            </View>
          </View>

          <View style={styles.actions}>
            <PrimaryButton
              label="CREATE ACCOUNT"
              onPress={handleSignUp}
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
            <Text style={styles.footerText}>Already have an account?{'  '}</Text>
            <TextButton
              label="SIGN IN"
              color={colors.text}
              onPress={() => navigation.navigate('Login')}
            />
          </View>

          <Text style={styles.legal}>
            By creating an account you agree to our Terms of Service and Privacy Policy.
          </Text>
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
  legal: {
    fontFamily: fonts.sans,
    fontSize: 11,
    lineHeight: 17,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 16,
  },
});
