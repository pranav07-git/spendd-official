import { Alert } from 'react-native';
import { PinEntry } from '../components/PinEntry';
import type { ScreenProps } from '../navigation/types';
import { isTooSimple } from '../pinRules';

export function CreatePinScreen({ navigation }: ScreenProps<'CreatePin'>) {
  return (
    <PinEntry
      title="ADD PIN"
      subtitle="Add your 4-digit access PIN"
      onBack={navigation.goBack}
      onComplete={pin => {
        if (isTooSimple(pin)) {
          return 'That PIN is too easy to guess. Try another.';
        }
        navigation.navigate('ConfirmPin', { pin });
        return null;
      }}
      onForgot={() =>
        Alert.alert(
          'No PIN yet',
          'You’re creating your PIN now. Pick any 4 digits you’ll remember, then confirm them on the next step.',
        )
      }
    />
  );
}
