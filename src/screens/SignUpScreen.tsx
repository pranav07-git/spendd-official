import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { PrimaryButton, OutlineButton, TextButton } from '../components/Buttons';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import type { ScreenProps } from '../navigation/types';
import { signUpWithEmail, signInWithGoogle, isAuthError } from '../auth/firebase';
import { makeStyles, radius, SCREEN_PADDING, space, type, useTheme } from '../theme';

export function SignUpScreen({ navigation }: ScreenProps<'SignUp'>) {
  const s = useStyles();
  const { c } = useTheme();
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
      <Header title="Create account" onBack={navigation.goBack} />
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Text style={s.headline}>Start saving smarter</Text>
          <Text style={s.sub}>Create your Spendd account to get started.</Text>

          {error ? <Text style={s.errorBanner}>{error}</Text> : null}

          <View style={s.form}>
            <View style={s.field}>
              <Text style={s.label}>EMAIL</Text>
              <TextInput
                style={s.input}
                value={email}
                onChangeText={v => {
                  setEmail(v);
                  setError(null);
                }}
                placeholder="you@example.com"
                placeholderTextColor={c.inkSubtle}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>PASSWORD</Text>
              <TextInput
                ref={passwordRef}
                style={s.input}
                value={password}
                onChangeText={v => {
                  setPassword(v);
                  setError(null);
                }}
                placeholder="Min. 6 characters"
                placeholderTextColor={c.inkSubtle}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>CONFIRM PASSWORD</Text>
              <TextInput
                ref={confirmRef}
                style={s.input}
                value={confirmPassword}
                onChangeText={v => {
                  setConfirmPassword(v);
                  setError(null);
                }}
                placeholder="Re-enter password"
                placeholderTextColor={c.inkSubtle}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                returnKeyType="done"
                onSubmitEditing={handleSignUp}
              />
            </View>
          </View>

          <View style={s.actions}>
            <PrimaryButton
              label="Create account"
              onPress={handleSignUp}
              loading={busy}
              disabled={googleBusy}
            />
            <View style={s.divider}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>OR</Text>
              <View style={s.dividerLine} />
            </View>
            <OutlineButton
              label="Continue with Google"
              onPress={handleGoogleSignIn}
              disabled={busy || googleBusy}
            />
          </View>

          <View style={s.footer}>
            <Text style={s.footerText}>Already have an account?{'  '}</Text>
            <TextButton
              label="Sign in"
              color={c.ink}
              onPress={() => navigation.navigate('Login')}
            />
          </View>

          <Text style={s.legal}>
            By creating an account you agree to our Terms of Service and Privacy Policy.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const useStyles = makeStyles(c => ({
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: SCREEN_PADDING, paddingBottom: space[8] },
  headline: { ...type.story, fontSize: 32, lineHeight: 38, color: c.ink, marginTop: space[6] },
  sub: { ...type.body, color: c.inkMuted, marginTop: space[2], marginBottom: space[6] },
  errorBanner: {
    ...type.caption,
    color: c.low,
    backgroundColor: c.surfaceSunken,
    borderLeftWidth: 3,
    borderLeftColor: c.low,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: radius.s,
    marginBottom: space[5],
  },
  form: { gap: space[5] },
  field: { gap: space[2] },
  label: { ...type.caption, letterSpacing: 1.5, color: c.inkMuted },
  input: {
    ...type.body,
    color: c.ink,
    borderBottomWidth: 1,
    borderBottomColor: c.line,
    paddingVertical: space[3],
  },
  actions: { gap: space[4], marginTop: space[8] },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  dividerLine: { flex: 1, height: 1, backgroundColor: c.line },
  dividerText: { ...type.caption, letterSpacing: 1.5, color: c.inkSubtle },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space[6],
  },
  footerText: { ...type.body, color: c.inkMuted },
  legal: {
    ...type.caption,
    color: c.inkSubtle,
    textAlign: 'center',
    marginTop: space[5],
    paddingHorizontal: space[4],
  },
}));
