import { PinEntry } from '../components/PinEntry';
import type { ScreenProps } from '../navigation/types';
import { savePin } from '../storage/secure';

export function ConfirmPinScreen({ navigation, route }: ScreenProps<'ConfirmPin'>) {
  return (
    <PinEntry
      title="Retype PIN"
      subtitle="Confirm your 4-digit access PIN"
      onBack={navigation.goBack}
      onComplete={async pin => {
        if (pin !== route.params.pin) {
          return 'PINs don’t match. Try again.';
        }
        try {
          await savePin(pin);
        } catch {
          return 'Couldn’t save your PIN. Try again.';
        }
        navigation.navigate('Biometric');
        return null;
      }}
      // Forgot the PIN typed a moment ago: start over from the first step.
      onForgot={navigation.goBack}
    />
  );
}
