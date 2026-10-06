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
import { PrimaryButton, TextButton } from '../components/Buttons';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import type { ScreenProps } from '../navigation/types';
import { sendPasswordReset, isAuthError } from '../auth/firebase';
import { colors, fonts } from '../theme';

type State = 'idle' | 'sent';

export function ForgotPasswordScreen({ navigation }: ScreenProps<'ForgotPassword'>) {
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
        <Header title="CHECK EMAIL" onBack={navigation.goBack} />
        <View style={styles.successBody}>
          <Text style={styles.successIcon}>📬</Text>
          <Text style={styles.successTitle}>Email sent</Text>
          <Text style={styles.successBody2}>
            We sent a password reset link to{'\n'}
            <Text style={styles.successEmail}>{email.trim()}</Text>
          </Text>
          <Text style={styles.successHint}>
            Check your inbox (and spam folder). The link expires in 1 hour.
          </Text>
          <View style={styles.successActions}>
            <PrimaryButton
              label="BACK TO SIGN IN"
              onPress={() => navigation.navigate('Login')}
            />
            <TextButton
              label="RESEND EMAIL"
              color={colors.textMuted}
              onPress={() => setScreenState('idle')}
            />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="RESET PASSWORD" onBack={navigation.goBack} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Text style={styles.headline}>
            Forgot{'  '}
            <Text style={styles.headlineItalic}>your password?</Text>
          </Text>
          <Text style={styles.sub}>
            Enter the email address linked to your account and we'll send you a reset link.
          </Text>

          {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

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
              returnKeyType="done"
              onSubmitEditing={handleReset}
            />
          </View>

          <View style={styles.actions}>
            <PrimaryButton label="SEND RESET LINK" onPress={handleReset} loading={busy} />
            <TextButton
              label="BACK TO SIGN IN"
              color={colors.textMuted}
              onPress={() => navigation.navigate('Login')}
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
    fontSize: 38,
    lineHeight: 46,
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
  // Success state
  successBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  successIcon: { fontSize: 56 },
  successTitle: {
    fontFamily: fonts.serif,
    fontSize: 32,
    color: colors.text,
    marginTop: 8,
  },
  successBody2: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 24,
    color: colors.textMuted,
    textAlign: 'center',
  },
  successEmail: { fontFamily: fonts.sansSemiBold, color: colors.text },
  successHint: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textFaint,
    textAlign: 'center',
  },
  successActions: { width: '100%', gap: 12, marginTop: 24 },
});
