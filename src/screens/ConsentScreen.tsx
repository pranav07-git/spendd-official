import { useState, type ReactNode } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { keepLocalCopy } from '@react-native-documents/picker';
import { PrimaryButton, TextButton } from '../components/Buttons';
import {
  ChartIcon,
  CheckboxCheckedIcon,
  CheckboxEmptyIcon,
  CircleCrossIcon,
  CrossIcon,
  LockIcon,
  TrashCrossIcon,
} from '../components/Icons';
import { Screen } from '../components/Screen';
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '../config';
import type { ScreenProps } from '../navigation/types';
import { saveConsent, saveStatement } from '../storage/appState';
import { colors, fonts } from '../theme';

const ACCESSED = ['Transactions you import', 'Receipts you choose to share', 'Expenses you add manually'];
const NOT_ACCESSED = ['Personal messages', 'Photos', 'Contacts'];
const NEVER = ['Sell your financial data', 'Access your contacts', 'Access photos', 'Share with advertisers'];

const PRINCIPLES: { icon: ReactNode; title: string; body: string }[] = [
  {
    icon: <LockIcon />,
    title: 'PRIVATE BY DEFAULT',
    body: 'Your statements, receipts, and transaction history are encrypted and protected.  Only you control what gets added to Spendd.',
  },
  {
    icon: <ChartIcon />,
    title: 'WHY WE NEED THIS',
    body: 'Automatically categorize spending from all your financial apps.',
  },
  {
    icon: <TrashCrossIcon />,
    title: 'YOU STAY IN CONTROL',
    body: 'Delete your data and withdraw consent at any time.',
  },
];

function openLink(url: string) {
  if (url) {
    Linking.openURL(url);
  }
}

export function ConsentScreen({ navigation, route }: ScreenProps<'Consent'>) {
  const { statement } = route.params;
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowAndContinue = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveConsent();
      if (statement) {
        // The picker's content:// URI is only readable briefly, so keep a
        // private copy for the import pipeline.
        const [copy] = await keepLocalCopy({
          files: [{ uri: statement.uri, fileName: statement.name }],
          destination: 'documentDirectory',
        });
        if (copy.status === 'error') {
          throw new Error(copy.copyError);
        }
        await saveStatement({
          name: statement.name,
          size: statement.size,
          type: statement.type,
          localUri: copy.localUri,
          importedAt: new Date().toISOString(),
        });
      }
      navigation.navigate('CreatePin');
    } catch {
      setError('We couldn’t save your statement. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <View style={styles.topBar}>
        <Text style={styles.brand}>SPENDD</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.headline}>🔒 Your data stays yours.</Text>
        <Text style={styles.body}>
          Spendd only processes the information you choose to provide so we can organize your
          spending and generate personalized insights.  No hidden access. No background tracking.
        </Text>

        <View style={[styles.card, styles.cardPadded]}>
          <Text style={styles.cardLabel}>WHAT WE'LL ACCESS</Text>
          {ACCESSED.map(item => (
            <View key={item} style={styles.listRow}>
              <CheckboxCheckedIcon size={20} />
              <Text style={styles.listText}>{item}</Text>
            </View>
          ))}
          {NOT_ACCESSED.map(item => (
            <View key={item} style={styles.listRow}>
              <View style={styles.crossBox}>
                <CrossIcon />
              </View>
              <Text style={[styles.listText, styles.listTextMuted]}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          {PRINCIPLES.map((p, i) => (
            <View key={p.title} style={[styles.principle, i > 0 && styles.principleDivider]}>
              {p.icon}
              <Text style={styles.principleTitle}>{p.title}</Text>
              <Text style={styles.principleBody}>{p.body}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.card, styles.cardPadded]}>
          <View style={styles.neverHeader}>
            <View style={styles.bullet} />
            <Text style={[styles.cardLabel, styles.neverLabel]}>WHAT WE'LL NEVER DO</Text>
          </View>
          {NEVER.map(item => (
            <View key={item} style={styles.neverRow}>
              <CircleCrossIcon />
              <Text style={styles.neverText}>{item}</Text>
            </View>
          ))}
        </View>

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreed }}
          onPress={() => setAgreed(a => !a)}
          style={styles.agreeRow}>
          <View style={styles.agreeBox}>
            {agreed ? <CheckboxCheckedIcon size={22} /> : <CheckboxEmptyIcon size={22} />}
          </View>
          <Text style={styles.agreeText}>
            I agree to{' '}
            <Text style={styles.link} onPress={() => openLink(PRIVACY_POLICY_URL)}>
              Privacy Policy
            </Text>{' '}
            and{' '}
            <Text style={styles.link} onPress={() => openLink(TERMS_OF_SERVICE_URL)}>
              Terms of Service
            </Text>{' '}
            & let Spendd organize my spending data
          </Text>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton
          label="ALLOW & CONTINUE"
          disabled={!agreed}
          loading={saving}
          onPress={allowAndContinue}
          style={styles.allow}
        />
        {/* Declining skips the statement import; nothing is stored. */}
        <TextButton label="NOT NOW" onPress={() => navigation.navigate('CreatePin')} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    height: 64,
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
  },
  brand: { fontFamily: fonts.serif, fontSize: 21, color: colors.text, letterSpacing: 0.5 },
  content: { paddingHorizontal: 20, paddingTop: 34, paddingBottom: 28 },
  headline: { fontFamily: fonts.serif, fontSize: 36, lineHeight: 46, color: colors.text },
  body: {
    fontFamily: fonts.sans,
    fontSize: 17,
    lineHeight: 28,
    color: colors.textMuted,
    marginTop: 10,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 18,
    marginTop: 40,
    overflow: 'hidden',
  },
  cardPadded: { paddingHorizontal: 24, paddingTop: 26, paddingBottom: 14 },
  cardLabel: {
    fontFamily: fonts.sans,
    fontSize: 11,
    letterSpacing: 3,
    color: colors.textMuted,
    marginBottom: 14,
  },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  crossBox: { width: 20, alignItems: 'center' },
  listText: { fontFamily: fonts.sans, fontSize: 16, color: colors.text },
  listTextMuted: { color: '#6E6E6E' },
  principle: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 22 },
  principleDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  principleTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.text,
    marginTop: 18,
  },
  principleBody: {
    fontFamily: fonts.sans,
    fontSize: 11,
    lineHeight: 18,
    color: colors.textMuted,
    marginTop: 8,
  },
  neverHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  bullet: { width: 7, height: 7, backgroundColor: colors.text },
  neverLabel: { color: colors.text, marginBottom: 0 },
  neverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    height: 58,
    marginBottom: 16,
  },
  neverText: { fontFamily: fonts.sans, fontSize: 16, color: colors.text },
  agreeRow: { flexDirection: 'row', marginTop: 56, gap: 14 },
  agreeBox: { paddingTop: 6 },
  agreeText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 24,
    color: '#8C8C8C',
  },
  link: { color: colors.text, textDecorationLine: 'underline' },
  error: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.danger,
    marginTop: 16,
  },
  allow: { marginTop: 36, minHeight: 68 },
});
