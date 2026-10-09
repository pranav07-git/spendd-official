import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import { makeStyles, space, type } from '../theme';

const WORDMARK = require('../assets/spendd-wordmark.png');
/** The wordmark image's own proportions (docs/brand/spendd-logo.png, cropped to the letters). */
const WORDMARK_RATIO = 119 / 783;
/** Largest the wordmark is drawn (dp); the assets are made for this width. */
const MAX_WIDTH = 260;
/** The wordmark grows in from this fraction of its size. */
const START_SCALE = 0.86;
/** Shown at least this long, so the slogan can be read even when the app is ready at once. */
const MIN_SHOW_MS = 1600;

/**
 * Launch screen: the SPENDD wordmark centred on black with "Smart money habits" under it. Stays up
 * until `ready` (the first screen is known) and the minimum time has passed, then fades out.
 */
export function SplashScreen({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const s = useStyles();
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(screenWidth * 0.62, MAX_WIDTH);
  const height = Math.round(width * WORDMARK_RATIO);

  const grow = useRef(new Animated.Value(0)).current;
  const slogan = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const [minTimePassed, setMinTimePassed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then(reduceMotion => {
        if (cancelled) {
          return;
        }
        if (reduceMotion) {
          grow.setValue(1);
          slogan.setValue(1);
          return;
        }
        Animated.parallel([
          Animated.timing(grow, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(slogan, { toValue: 1, duration: 500, delay: 300, useNativeDriver: true }),
        ]).start();
      });
    const timer = setTimeout(() => setMinTimePassed(true), MIN_SHOW_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [grow, slogan]);

  useEffect(() => {
    if (ready && minTimePassed) {
      Animated.timing(fade, { toValue: 0, duration: 320, useNativeDriver: true }).start(() => onDone());
    }
  }, [ready, minTimePassed, fade, onDone]);

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, s.root, { opacity: fade }]}
      accessible
      accessibilityLabel="Spendd. Smart money habits."
      importantForAccessibility="yes">
      {/* The wordmark sits at the exact centre; the slogan hangs below it. */}
      <View style={{ width, height }}>
        <Animated.Image
          source={WORDMARK}
          style={{
            width,
            height,
            transform: [{ scale: grow.interpolate({ inputRange: [0, 1], outputRange: [START_SCALE, 1] }) }],
          }}
          resizeMode="contain"
        />
        <Animated.Text
          style={[
            s.slogan,
            {
              opacity: slogan,
              transform: [{ translateY: slogan.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
            },
          ]}
          numberOfLines={1}>
          Smart money habits
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const useStyles = makeStyles(c => ({
  // Black like the logo and the system splash, not the app's #090909 canvas.
  root: { backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  // The app's primary (display) face, like the wordmark above it.
  slogan: {
    ...type.title,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.4,
    color: c.ink,
    position: 'absolute',
    top: '100%',
    left: -space[10],
    right: -space[10],
    marginTop: space[5],
    textAlign: 'center',
  },
}));
