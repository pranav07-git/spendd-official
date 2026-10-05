import type { ReactNode } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { GlassSheen } from './Glass';
import { LockIcon } from './Icons';
import { elevation, makeStyles, radius, space, type, useTheme } from '../theme';

/** The opening sentence of a screen (DESIGN.md §5.3): plain language, left-aligned, max 3 lines. */
export function StoryHeader({ story, caption, style }: { story: string; caption?: string | null; style?: StyleProp<ViewStyle> }) {
  const s = useStyles();
  return (
    <View style={style}>
      <Text style={s.story} accessibilityRole="header" numberOfLines={3}>
        {story}
      </Text>
      {caption ? <Text style={s.caption}>{caption}</Text> : null}
    </View>
  );
}

/** Surface card: radius l, elevation 1 (shadow in light, outline in dark). */
export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const s = useStyles();
  const { c, isDark } = useTheme();
  return (
    <View style={[s.card, elevation(1, c, isDark), padded && s.padded, style]}>
      {isDark ? <GlassSheen /> : null}
      {children}
    </View>
  );
}

/** Section heading with an optional quiet action on the right. */
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

/** "Read on your phone. Not stored." — privacy shown on the screen (DESIGN.md §5.12). */
export function PrivacyBadge({ text, style }: { text: string; style?: StyleProp<ViewStyle> }) {
  const s = useStyles();
  const { c } = useTheme();
  return (
    <View style={[s.badge, style]}>
      <LockIcon size={14} color={c.peacock} />
      <Text style={s.badgeText}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles(c => ({
  story: { ...type.story, color: c.ink },
  caption: { ...type.caption, color: c.inkMuted, marginTop: space[1] },
  card: { backgroundColor: c.surface, borderRadius: radius.l, overflow: 'hidden' },
  padded: { padding: space[4] },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space[8], marginBottom: space[3] },
  heading: { ...type.heading, color: c.ink },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    alignSelf: 'flex-start',
    backgroundColor: c.peacockSoft,
    borderRadius: radius.pill,
    paddingHorizontal: space[3],
    paddingVertical: space[1] + 2,
  },
  badgeText: { ...type.caption, color: c.ink },
}));
