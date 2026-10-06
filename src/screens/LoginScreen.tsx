import { useState } from 'react';
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
import { signInWithEmail, signInWithGoogle, isAuthError } from '../auth/firebase';
import { makeStyles, radius, SCREEN_PADDING, space, type, useTheme } from '../theme';

export function LoginScreen({ navigation }: ScreenProps<'Login'>) {
  const s = useStyles();
  const { c } = useTheme();
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
      <Header title="Sign in" onBack={navigation.goBack} />
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Text style={s.headline}>Welcome back</Text>
          <Text style={s.sub}>Sign in to continue tracking your spending.</Text>

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
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>PASSWORD</Text>
              <TextInput
                style={s.input}
                value={password}
                onChangeText={v => {
                  setPassword(v);
                  setError(null);
                }}
                placeholder="••••••••"
                placeholderTextColor={c.inkSubtle}
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
              label="Forgot password?"
              color={c.inkMuted}
              style={s.forgotLink}
              onPress={() => navigation.navigate('ForgotPassword')}
            />
          </View>

          <View style={s.actions}>
            <PrimaryButton
              label="Sign in"
              onPress={handleLogin}
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
            <Text style={s.footerText}>Don't have an account?{'  '}</Text>
            <TextButton
              label="Sign up"
              color={c.ink}
              onPress={() => navigation.navigate('SignUp')}
            />
          </View>
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
  forgotLink: { alignSelf: 'flex-end', marginTop: -space[2] },
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
}));
