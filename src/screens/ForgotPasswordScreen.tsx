import { useState } from 'react';
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
import { sendPasswordReset, isAuthError } from '../auth/firebase';
import { makeStyles, radius, SCREEN_PADDING, space, type, useTheme } from '../theme';

type State = 'idle' | 'sent';

export function ForgotPasswordScreen({ navigation }: ScreenProps<'ForgotPassword'>) {
  const s = useStyles();
  const { c } = useTheme();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [screenState, setScreenState] = useState<State>('idle');

  const handleReset = async () => {
    if (!email.trim()) {
      setError('Enter your account email address.');
      return;
    }
    setError(null);
    setBusy(true);
    const result = await sendPasswordReset(email);
    setBusy(false);
    if (result && isAuthError(result)) {
      setError(result.message);
      return;
    }
    setScreenState('sent');
  };

  if (screenState === 'sent') {
    return (
      <Screen>
        <Header title="Check email" onBack={navigation.goBack} />
        <View style={s.successBody}>
          <Text style={s.successIcon}>📬</Text>
          <Text style={s.successTitle}>Email sent</Text>
          <Text style={s.successBody2}>
            We sent a password reset link to{'\n'}
            <Text style={s.successEmail}>{email.trim()}</Text>
          </Text>
          <Text style={s.successHint}>
            Check your inbox (and spam folder). The link expires in 1 hour.
          </Text>
          <View style={s.successActions}>
            <PrimaryButton
              label="Back to sign in"
              onPress={() => navigation.navigate('Login')}
            />
            <TextButton
              label="Resend email"
              color={c.inkMuted}
              onPress={() => setScreenState('idle')}
            />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Reset password" onBack={navigation.goBack} />
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Text style={s.headline}>Forgot your password?</Text>
          <Text style={s.sub}>
            Enter the email address linked to your account and we'll send you a reset link.
          </Text>

          {error ? <Text style={s.errorBanner}>{error}</Text> : null}

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
              returnKeyType="done"
              onSubmitEditing={handleReset}
            />
          </View>

          <View style={s.actions}>
            <PrimaryButton label="Send reset link" onPress={handleReset} loading={busy} />
            <TextButton
              label="Back to sign in"
              color={c.inkMuted}
              onPress={() => navigation.navigate('Login')}
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
  successBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SCREEN_PADDING,
    gap: space[4],
  },
  successIcon: { fontSize: 56 },
  successTitle: { ...type.title, color: c.ink, marginTop: space[2] },
  successBody2: { ...type.body, color: c.inkMuted, textAlign: 'center' },
  successEmail: { ...type.bodyStrong, color: c.ink },
  successHint: { ...type.caption, color: c.inkSubtle, textAlign: 'center' },
  successActions: { width: '100%', gap: space[3], marginTop: space[6] },
}));
