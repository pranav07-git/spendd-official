import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import { PinEntry } from '../components/PinEntry';
import type { ScreenProps } from '../navigation/types';
import { isTooSimple } from '../pinRules';
import { savePin, verifyPin } from '../storage/secure';

type Step = 'current' | 'new' | 'confirm';

const MAX_ATTEMPTS = 5;

/** Current PIN → new PIN → retype, on one screen. Each step remounts PinEntry so it starts empty. */
export function ChangePinScreen({ navigation }: ScreenProps<'ChangePin'>) {
  const [step, setStep] = useState<Step>('current');
  const newPin = useRef('');
  const attempts = useRef(0);

  const onComplete = async (pin: string): Promise<string | null> => {
    if (step === 'current') {
      if (await verifyPin(pin)) {
        setStep('new');
        return null;
      }
      attempts.current += 1;
      if (attempts.current >= MAX_ATTEMPTS) {
        navigation.goBack();
        return null;
      }
      const left = MAX_ATTEMPTS - attempts.current;
      return `Incorrect PIN. ${left} ${left === 1 ? 'attempt' : 'attempts'} left.`;
    }
    if (step === 'new') {
      if (isTooSimple(pin)) {
        return 'That PIN is too easy to guess. Try another.';
      }
      newPin.current = pin;
      setStep('confirm');
      return null;
    }
    if (pin !== newPin.current) {
      setStep('new');
      Alert.alert('PINs didn’t match', 'Enter your new PIN again.');
      return null;
    }
    try {
      await savePin(pin);
    } catch {
      return 'Couldn’t save your PIN. Try again.';
    }
    Alert.alert('PIN changed', 'Use your new PIN next time you unlock Spendd.');
    navigation.goBack();
    return null;
  };

  const copy = {
    current: { title: 'CURRENT PIN', subtitle: 'Enter your current 4-digit PIN' },
    new: { title: 'NEW PIN', subtitle: 'Choose a new 4-digit PIN' },
    confirm: { title: 'RETYPE PIN', subtitle: 'Confirm your new 4-digit PIN' },
  }[step];

  return (
    <PinEntry
      key={step}
      title={copy.title}
      subtitle={copy.subtitle}
      greeting="Change PIN"
      onBack={navigation.goBack}
      onComplete={onComplete}
      onForgot={() =>
        Alert.alert(
          'Forgot your PIN?',
          step === 'current'
            ? 'Lock the app and choose “Forgot PIN” on the unlock screen to reset Spendd.'
            : 'Start again from your new PIN.',
          step === 'current' ? undefined : [{ text: 'OK', onPress: () => setStep('new') }],
        )
      }
    />
  );
}
