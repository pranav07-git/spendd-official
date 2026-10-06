import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import { PinEntry } from '../components/PinEntry';
import type { ScreenProps } from '../navigation/types';
import { isTooSimple } from '../pinRules';
import { checkPin, pinCheckMessage, savePin } from '../storage/secure';

type Step = 'current' | 'new' | 'confirm';

/** Current PIN → new PIN → retype, on one screen. Each step remounts PinEntry so it starts empty. */
export function ChangePinScreen({ navigation }: ScreenProps<'ChangePin'>) {
  const [step, setStep] = useState<Step>('current');
  const newPin = useRef('');

  const onComplete = async (pin: string): Promise<string | null> => {
    if (step === 'current') {
      // Shares the unlock screen's lockout, so this can't be used to guess the PIN either.
      const result = await checkPin(pin);
      if (result.ok) {
        setStep('new');
        return null;
      }
      return pinCheckMessage(result, 'That’s not your PIN.');
    }
    if (step === 'new') {
      if (isTooSimple(pin)) {
        return 'That PIN is easy to guess. Pick one that isn’t a sequence or a repeat.';
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
    current: { title: 'Current PIN', subtitle: 'Enter your current 4-digit PIN' },
    new: { title: 'New PIN', subtitle: 'Choose a new 4-digit PIN' },
    confirm: { title: 'Retype PIN', subtitle: 'Confirm your new 4-digit PIN' },
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
