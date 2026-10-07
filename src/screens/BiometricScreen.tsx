import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { PrimaryButton, TextButton } from '../components/Buttons';
import { Header } from '../components/Header';
import { FingerprintIcon } from '../components/Icons';
import { Card, StoryHeader } from '../components/Layout';
import { Screen } from '../components/Screen';
import type { ScreenProps } from '../navigation/types';
import { markSetupComplete } from '../storage/appState';
import { useFirstName } from '../storage/useFirstName';
import { enableBiometrics, getBiometryType } from '../storage/secure';
import { makeStyles, radius, SCREEN_PADDING, space, type, useTheme } from '../theme';

export function BiometricScreen({ navigation }: ScreenProps<'Biometric'>) {
  const name = useFirstName();
  const s = useStyles();
  const { c } = useTheme();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const glow = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.6, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [glow]);

  const finish = async () => {
    await markSetupComplete();
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  const enable = async () => {
    setMessage(null);
    if (!(await getBiometryType())) {
      setMessage('No fingerprint or face unlock is set up on this phone. Add one in Settings, or choose Maybe later.');
      return;
    }
    setBusy(true);
    try {
      await enableBiometrics();
      await finish();
    } catch {
      setMessage('Fingerprint unlock didn’t turn on. Try again, or choose Maybe later.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title="Fingerprint unlock" onBack={navigation.goBack} />

      <View style={s.body}>
        <StoryHeader
          story={name ? `Hi ${name}, open Spendd with a touch.` : 'Open Spendd with a touch.'}
          caption="Faster than your PIN, and just as safe. You can still use your PIN any time."
        />

        <View style={s.stage}>
          <Card style={s.tile} padded={false}>
            <Animated.View style={[s.glow, { opacity: glow, transform: [{ scale: glow }] }]} />
            <FingerprintIcon size={64} color={c.ink} strokeWidth={1.6} />
          </Card>
        </View>

        {message ? <Text style={s.message}>{message}</Text> : null}
      </View>

      <View style={s.actions}>
        <PrimaryButton label="Turn on fingerprint unlock" onPress={enable} loading={busy} />
        <TextButton label="Maybe later" onPress={finish} style={s.later} />
      </View>
    </Screen>
  );
}

const useStyles = makeStyles(c => ({
  body: { flex: 1, paddingTop: space[6], paddingHorizontal: SCREEN_PADDING },
  stage: { flex: 1, minHeight: 240, alignItems: 'center', justifyContent: 'center' },
  tile: {
    width: 180,
    height: 180,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 128,
    height: 128,
    borderRadius: radius.pill,
    backgroundColor: c.marigoldSoft,
  },
  message: { ...type.caption, color: c.low, textAlign: 'center', marginBottom: space[3] },
  actions: { paddingHorizontal: SCREEN_PADDING, paddingBottom: space[4] },
  later: { marginTop: space[2] },
}));
