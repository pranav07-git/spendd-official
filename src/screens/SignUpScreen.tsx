import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { PrimaryButton, TextButton } from '../components/Buttons';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import type { ScreenProps } from '../navigation/types';
import { MIN_PASSWORD, signUpWithEmail, isAuthError } from '../auth/session';
import { makeStyles, radius, SCREEN_PADDING, space, type, useTheme } from '../theme';

export function SignUpScreen({ navigation }: ScreenProps<'SignUp'>) {
  const s = useStyles();
  const { c } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const emailRef = useRef<any>(null);
  const passwordRef = useRef<any>(null);
  const confirmRef = useRef<any>(null);

  const handleSignUp = async () => {
    // The keyboard's Done key calls this too, and only the button is disabled while busy.
    if (busy) {
      return;
    }
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setError('Fill in every field to create your account.');
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError('Those passwords don’t match.');
      return;
    }
    setError(null);
    setBusy(true);
    const result = await signUpWithEmail(name, email, password);
    setBusy(false);
    if (isAuthError(result)) {
      setError(result.message);
      return;
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
              <Text style={s.label}>Name</Text>
              <TextInput
                style={s.input}
                value={name}
                onChangeText={v => {
                  setName(v);
                  setError(null);
                }}
                placeholder="What should we call you?"
                placeholderTextColor={c.inkSubtle}
                maxLength={60}
                autoCapitalize="words"
                autoCorrect={false}
                autoComplete="name"
                textContentType="name"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>Email</Text>
              <TextInput
                ref={emailRef}
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
              <Text style={s.label}>Password</Text>
              <TextInput
                ref={passwordRef}
                style={s.input}
                value={password}
                onChangeText={v => {
                  setPassword(v);
                  setError(null);
                }}
                placeholder={`Min. ${MIN_PASSWORD} characters`}
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
              <Text style={s.label}>Confirm password</Text>
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
            <PrimaryButton label="Create account" onPress={handleSignUp} loading={busy} />
          </View>

          <View style={s.footer}>
            <Text style={s.footerText}>Already have an account?{'  '}</Text>
            <TextButton
              label="Sign in"
              color={c.ink}
              onPress={() => navigation.replace('Login')}
            />
          </View>

          <Text style={s.legal}>
            By creating an account you agree to our{' '}
            <Text style={s.legalLink} onPress={() => navigation.navigate('Legal', { doc: 'terms' })}>
              Terms of Use
            </Text>{' '}
            and{' '}
            <Text style={s.legalLink} onPress={() => navigation.navigate('Legal', { doc: 'privacy' })}>
              Privacy Policy
            </Text>
            .
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
  label: { ...type.caption, color: c.inkMuted },
  input: {
    ...type.body,
    color: c.ink,
    borderBottomWidth: 1,
    borderBottomColor: c.line,
    paddingVertical: space[3],
  },
  actions: { gap: space[4], marginTop: space[8] },
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
  legalLink: { color: c.info },
}));
