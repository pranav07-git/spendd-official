import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { PrimaryButton, TextButton } from '../components/Buttons';
import { Header } from '../components/Header';
import { FingerprintIcon } from '../components/Icons';
import { Screen } from '../components/Screen';
import { USER_NAME } from '../config';
import type { ScreenProps } from '../navigation/types';
import { markSetupComplete } from '../storage/appState';
import { enableBiometrics, getBiometryType } from '../storage/secure';
import { colors, fonts } from '../theme';

const BACKDROP_ROTATIONS = [-12, 8, 24, 40];

function Backdrop() {
  return (
    <Svg width={420} height={420} viewBox="0 0 420 420" style={styles.backdrop} pointerEvents="none">
      {BACKDROP_ROTATIONS.map(deg => (
        <Rect
          key={deg}
          x={70}
          y={70}
          width={280}
          height={280}
          stroke="#1F1F1F"
          strokeWidth={1}
          fill="none"
          transform={`rotate(${deg} 210 210)`}
        />
      ))}
    </Svg>
  );
}

export function BiometricScreen({ navigation }: ScreenProps<'Biometric'>) {
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
      setMessage('Biometric setup didn’t complete. Try again or choose Maybe later.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title="SETUP BIOMETRIC" onBack={navigation.goBack} bordered />

      <View style={styles.body}>
        <Text style={styles.greeting}>Hi {USER_NAME},</Text>
        <Text style={styles.subtitle}>
          Choose how you secure your app{'\n'}for a faster, safer experience.
        </Text>

        <View style={styles.stage}>
          <Backdrop />
          <View style={styles.tile}>
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: glow }]}>
              <Svg width="100%" height="100%">
                <Defs>
                  <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor={colors.glow} stopOpacity={0.35} />
                    <Stop offset="0.45" stopColor={colors.glow} stopOpacity={0.08} />
                    <Stop offset="1" stopColor={colors.glow} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Rect width="100%" height="100%" fill="url(#glow)" />
              </Svg>
            </Animated.View>
            <FingerprintIcon size={64} color="#FFF6E6" strokeWidth={1.6} />
          </View>
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>

      <View style={styles.actions}>
        <PrimaryButton label="ENABLE BIOMETRICS" onPress={enable} loading={busy} style={styles.enable} />
        <TextButton label="MAYBE LATER" color={colors.text} onPress={finish} />
        <Text style={styles.footer}>SECURED BY SPENDD VAULT TECHNOLOGY</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', paddingTop: 56, paddingHorizontal: 24 },
  greeting: { fontFamily: fonts.sans, fontSize: 17, color: colors.text },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 17,
    lineHeight: 28,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 16,
  },
  stage: { flex: 1, minHeight: 280, alignItems: 'center', justifyContent: 'center' },
  backdrop: { position: 'absolute' },
  tile: {
    width: 180,
    height: 180,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  message: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 12,
  },
  actions: { paddingHorizontal: 20, paddingBottom: 16 },
  enable: { minHeight: 56 },
  footer: {
    fontFamily: fonts.sans,
    fontSize: 9,
    letterSpacing: 0.4,
    color: '#555555',
    textAlign: 'center',
    marginTop: 28,
  },
});
