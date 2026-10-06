import type { ReactNode } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LockIcon } from './Icons';
import { makeStyles, radius, space, type, useTheme } from '../theme';

/** The opening line of a screen: tight display type, left-aligned, max 4 lines. */
export function StoryHeader({ story, caption, style }: { story: string; caption?: string | null; style?: StyleProp<ViewStyle> }) {
  const s = useStyles();
  return (
    <View style={style}>
      <Text style={s.story} accessibilityRole="header" numberOfLines={4}>
        {story}
      </Text>
      {caption ? <Text style={s.caption}>{caption}</Text> : null}
    </View>
  );
}

/** Charcoal card (docs/DESIGN.md surface-1): 20 px radius, no border, no shadow. */
export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const s = useStyles();
  return (
    <View style={[s.card, padded && s.padded, style]}>
      {children}
    </View>
  );
}

/** Section title with an optional quiet action on the right. */
export function SectionHeading({ title, action, style }: { title: string; action?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const s = useStyles();
  return (
    <View style={[s.section, style]}>
      <Text style={s.heading} accessibilityRole="header">
        {title}
      </Text>
      {action}
    </View>
  );
}

/** "Read on your phone. Not stored." — privacy shown on the screen (docs/DESIGN.md). */
export function PrivacyBadge({ text, style }: { text: string; style?: StyleProp<ViewStyle> }) {
  const s = useStyles();
  const { c } = useTheme();
  return (
    <View style={[s.badge, style]}>
      <LockIcon size={14} color={c.inkMuted} strokeWidth={1.75} />
      <Text style={s.badgeText}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles(c => ({
  story: { ...type.story, color: c.ink },
  caption: { ...type.body, color: c.inkMuted, marginTop: space[2] },
  card: { backgroundColor: c.surface, borderRadius: radius.l, overflow: 'hidden' },
  padded: { padding: space[5] },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space[8], marginBottom: space[4] },
  heading: { ...type.heading, color: c.ink },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    alignSelf: 'flex-start',
    backgroundColor: c.surface,
    borderRadius: radius.pill,
    paddingHorizontal: space[3],
    paddingVertical: space[1] + 2,
  },
  badgeText: { ...type.caption, color: c.inkMuted },
}));
