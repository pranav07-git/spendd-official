import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { PrimaryButton } from '../components/Buttons';
import { Header } from '../components/Header';
import {
  BotIcon,
  ChartIcon,
  CheckboxCheckedIcon,
  CheckboxEmptyIcon,
  CircleCrossIcon,
  CrossIcon,
  LockIcon,
  TrashCrossIcon,
} from '../components/Icons';
import { Card, PrivacyBadge, StoryHeader } from '../components/Layout';
import { Screen } from '../components/Screen';
import type { ScreenProps } from '../navigation/types';
import { saveConsent } from '../storage/appState';
import { makeStyles, radius, SCREEN_PADDING, SECTION_GAP, space, type, TOUCH_TARGET, useTheme } from '../theme';

const ACCESSED: { title: string; detail?: string }[] = [
  { title: 'Payment screenshots you share with Spendd' },
  { title: 'Spends you add yourself' },
  {
    title: 'Spendd',
    detail: 'Your monthly totals, and the names and UPI IDs of businesses you paid.',
  },
];
const NOT_ACCESSED = ['Your messages', 'Your photo gallery', 'Your contacts'];
const NEVER = [
  'Sell your financial data',
  'Share your data with advertisers',
  'Send your screenshots or transaction list anywhere',
  'Look through your contacts or photos',
];

type Principle = { icon: (color: string) => ReactNode; title: string; body: string };

const PRINCIPLES: Principle[] = [
  {
    icon: color => <LockIcon color={color} />,
    title: 'Read on your phone',
    body: 'Screenshots are read on this phone and stay on it. Only you decide what goes into Spendd.',
  },
  {
    icon: color => <BotIcon color={color} />,
    title: 'Spendd',
    body: 'Spendd sends your monthly totals, and the names and UPI IDs of businesses you paid, to our server. It uses Google Gemini to write your insights and sort new shops into categories. It never gets your screenshots, your transaction list, or anything about people you pay.',
  },
  {
    icon: color => <ChartIcon color={color} />,
    title: 'Why we need this',
    body: 'So Spendd can sort spends from all your payment apps into categories for you.',
  },
  {
    icon: color => <TrashCrossIcon color={color} />,
    title: 'You stay in control',
    body: 'Delete your data or take back your consent any time.',
  },
];

export function ConsentScreen({ navigation }: ScreenProps<'Consent'>) {
  const s = useStyles();
  const { c } = useTheme();
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowAndContinue = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveConsent();
      navigation.navigate('CreatePin');
    } catch {
      setError('Couldn’t save that on this phone. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Header title="Spendd" />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <StoryHeader story="Your data stays yours." />
        <Text style={s.body}>
          Spendd only uses what you choose to give it, to sort your spends and show you insights. No hidden access.
        </Text>
        <PrivacyBadge text="Screenshots are read on your phone." style={s.badge} />

        <Text style={s.sectionTitle} accessibilityRole="header">
          What Spendd uses
        </Text>
        <Card>
          {ACCESSED.map(item => (
            <View key={item.title} style={s.listRow}>
              <View style={s.listIcon}>
                <CheckboxCheckedIcon size={20} color={c.success} />
              </View>
              <View style={s.listTextWrap}>
                <Text style={s.listText}>{item.title}</Text>
                {item.detail ? <Text style={s.listDetail}>{item.detail}</Text> : null}
              </View>
            </View>
          ))}
          <View style={s.divider} />
          {NOT_ACCESSED.map(item => (
            <View key={item} style={s.listRow}>
              <View style={s.listIcon}>
                <CrossIcon size={14} color={c.inkSubtle} />
              </View>
              <Text style={[s.listText, s.listTextMuted]}>
                {item}
                <Text style={s.listDetail}> · not used</Text>
              </Text>
            </View>
          ))}
        </Card>

        <Text style={s.sectionTitle} accessibilityRole="header">
          How it works
        </Text>
        <Card padded={false}>
          {PRINCIPLES.map((p, i) => (
            <View key={p.title} style={[s.principle, i > 0 && s.principleDivider]}>
              <View style={s.principleIcon}>{p.icon(c.peacock)}</View>
              <View style={s.listTextWrap}>
                <Text style={s.principleTitle}>{p.title}</Text>
                <Text style={s.principleBody}>{p.body}</Text>
              </View>
            </View>
          ))}
        </Card>

        <Text style={s.sectionTitle} accessibilityRole="header">
          What Spendd will never do
        </Text>
        <Card>
          {NEVER.map(item => (
            <View key={item} style={s.listRow}>
              <View style={s.listIcon}>
                <CircleCrossIcon size={18} color={c.low} />
              </View>
              <Text style={s.listText}>{item}</Text>
            </View>
          ))}
        </Card>

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreed }}
          onPress={() => setAgreed(a => !a)}
          style={s.agreeRow}>
          <View style={s.agreeBox}>
            {agreed ? <CheckboxCheckedIcon size={22} color={c.info} /> : <CheckboxEmptyIcon size={22} color={c.inkMuted} />}
          </View>
          <Text style={s.agreeText}>
            I agree to the{' '}
            <Text style={s.link} onPress={() => navigation.navigate('Legal', { doc: 'privacy' })}>
              Privacy Policy
            </Text>{' '}
            and{' '}
            <Text style={s.link} onPress={() => navigation.navigate('Legal', { doc: 'terms' })}>
              Terms of Use
            </Text>
            , and I'm happy for Spendd to organise my spending data.
          </Text>
        </Pressable>

        {error ? <Text style={s.error}>{error}</Text> : null}

        <PrimaryButton
          label="Allow and continue"
          disabled={!agreed}
          loading={saving}
          onPress={allowAndContinue}
          style={s.allow}
        />
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles(c => ({
  content: { paddingHorizontal: SCREEN_PADDING, paddingTop: space[4], paddingBottom: space[6] },
  body: { ...type.body, color: c.inkMuted, marginTop: space[3] },
  badge: { marginTop: space[4] },
  sectionTitle: { ...type.heading, color: c.ink, marginTop: SECTION_GAP, marginBottom: space[3] },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3], paddingVertical: space[2] },
  listIcon: { width: 22, height: 24, alignItems: 'center', justifyContent: 'center' },
  listTextWrap: { flex: 1 },
  listText: { ...type.body, color: c.ink, flex: 1 },
  listTextMuted: { color: c.inkMuted },
  listDetail: { ...type.caption, color: c.inkMuted },
  divider: { height: 1, backgroundColor: c.line, marginVertical: space[2] },
  principle: { flexDirection: 'row', gap: space[3], padding: space[4] },
  principleDivider: { borderTopWidth: 1, borderTopColor: c.line },
  principleIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.m,
    backgroundColor: c.peacockSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  principleTitle: { ...type.bodyStrong, color: c.ink },
  principleBody: { ...type.caption, color: c.inkMuted, marginTop: space[1] },
  agreeRow: { flexDirection: 'row', gap: space[3], marginTop: SECTION_GAP, minHeight: TOUCH_TARGET },
  agreeBox: { paddingTop: 1 },
  agreeText: { ...type.body, color: c.inkMuted, flex: 1 },
  link: { ...type.bodyStrong, color: c.info },
  error: { ...type.caption, color: c.low, marginTop: space[4] },
  allow: { marginTop: space[6], marginBottom: space[4] },
}));
