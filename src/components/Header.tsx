import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ArrowLeftIcon } from './Icons';
import { makeStyles, radius, SCREEN_PADDING, space, TOUCH_TARGET, type } from '../theme';

type HeaderProps = {
  title: string;
  onBack?: () => void;
  /** Actions on the right, usually one or two HeaderButtons. */
  right?: ReactNode;
  /** Kept for compatibility; every header has the same divider now. */
  bordered?: boolean;
};

/**
 * The one screen header (the My money style): a large left-aligned title, an optional back arrow
 * before it, optional actions after it, and a divider underneath.
 */
export function Header({ title, onBack, right }: HeaderProps) {
  const s = useStyles();
  return (
    <View style={[s.bar, onBack && s.barWithBack]}>
      {onBack ? (
        <HeaderButton label="Go back" onPress={onBack}>
          <ArrowLeftIcon />
        </HeaderButton>
      ) : null}
      <Text style={s.title} accessibilityRole="header" numberOfLines={1}>
        {title}
      </Text>
      {right ? <View style={s.right}>{right}</View> : null}
    </View>
  );
}

/** A 44 dp icon button for a Header. `active` marks a toggle that's on (e.g. a filter in use). */
export function HeaderButton({
  label,
  onPress,
  active = false,
  expanded,
  children,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
  expanded?: boolean;
  children: ReactNode;
}) {
  const s = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      onPress={onPress}
      style={({ pressed }) => [s.button, active && s.buttonActive, pressed && s.pressed]}>
      {children}
    </Pressable>
  );
}

const useStyles = makeStyles(c => ({
  bar: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    paddingLeft: SCREEN_PADDING,
    // Icon buttons are wider than their glyphs; pull them out so the glyphs line up with the content.
    paddingRight: SCREEN_PADDING - space[3],
    borderBottomWidth: 1,
    borderBottomColor: c.line,
  },
  barWithBack: { paddingLeft: SCREEN_PADDING - space[3] },
  title: { ...type.title, color: c.ink, flex: 1 },
  right: { flexDirection: 'row', alignItems: 'center' },
  button: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: radius.s,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonActive: { backgroundColor: c.surfaceSunken },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
}));
