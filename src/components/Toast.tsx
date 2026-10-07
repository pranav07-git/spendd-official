import { useEffect, useRef, useState } from 'react';
import { Animated, Text } from 'react-native';
import { makeStyles, radius, space, type } from '../theme';

/**
 * A short message that fades in above the bottom of the screen for two seconds. Render `node`
 * last inside the screen's body; `bottom` lifts it clear of a tab bar.
 */
export function useToast(bottom: number = space[6]) {
  const s = useStyles();
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (text: string) => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    setMessage(text);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
    timer.current = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => setMessage(null));
    }, 2000);
  };

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const node = message ? (
    <Animated.View
      pointerEvents="none"
      style={[s.toast, { bottom, opacity }]}
      accessibilityLiveRegion="polite"
    >
      <Text style={s.toastText}>{message}</Text>
    </Animated.View>
  ) : null;

  return { show, node };
}

const useStyles = makeStyles(c => ({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '90%',
    backgroundColor: c.ink,
    borderRadius: radius.pill,
    paddingHorizontal: space[5],
    paddingVertical: space[3],
  },
  toastText: { ...type.label, color: c.onInk },
}));
