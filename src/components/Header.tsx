import { Pressable, Text, View } from 'react-native';
import { ArrowLeftIcon } from './Icons';
import { makeStyles, SCREEN_PADDING, TOUCH_TARGET, type } from '../theme';

type HeaderProps = {
  title: string;
  onBack?: () => void;
  /** Kept for compatibility; all headers share one quiet style now. */
  bordered?: boolean;
};

/** Back arrow and a centred title. */
export function Header({ title, onBack }: HeaderProps) {
  const s = useStyles();
  return (
    <View style={s.bar}>
      {onBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8} onPress={onBack} style={s.back}>
          <ArrowLeftIcon />
        </Pressable>
      ) : null}
      <Text style={s.title} accessibilityRole="header" numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

const useStyles = makeStyles(c => ({
  bar: { height: 56, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 64 },
  back: {
    position: 'absolute',
    left: SCREEN_PADDING - 10,
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...type.heading, color: c.ink },
}));
