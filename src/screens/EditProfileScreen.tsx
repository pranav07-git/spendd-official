import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { PrimaryButton } from '../components/Buttons';
import { Header } from '../components/Header';
import { Card } from '../components/Layout';
import { Screen } from '../components/Screen';
import type { ScreenProps } from '../navigation/types';
import { DEFAULT_PROFILE, getProfile, saveProfile } from '../storage/appState';
import { makeStyles, radius, SCREEN_PADDING, SECTION_GAP, space, TOUCH_TARGET, type, useTheme } from '../theme';

/** null = the name's initial. */
const AVATARS: (string | null)[] = [null, '😎', '🦊', '🐼', '🌸', '🚀', '🎧', '⚡', '🍀', '🐯', '☕', '🎨'];

export function EditProfileScreen({ navigation }: ScreenProps<'EditProfile'>) {
  const s = useStyles();
  const { c } = useTheme();
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProfile()
      .catch(() => DEFAULT_PROFILE)
      .then(profile => {
        setName(profile.name);
        setAvatar(profile.avatar);
      });
  }, []);

  const save = async () => {
    const trimmed = name.trim().replace(/\s+/g, ' ');
    if (!trimmed) {
      setError('Add your name to save your profile.');
      return;
    }
    setSaving(true);
    try {
      await saveProfile({ name: trimmed, avatar });
      navigation.goBack();
    } catch {
      setError('Couldn’t save your profile. Try again.');
      setSaving(false);
    }
  };

  const preview = { name: name || ' ', avatar };

  return (
    <Screen>
      <Header title="Edit profile" onBack={navigation.goBack} />

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Avatar profile={preview} size={96} style={s.preview} />

        <Card style={s.card}>
          <Text style={s.label}>Your name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="What should we call you?"
            placeholderTextColor={c.inkSubtle}
            style={s.input}
            autoCapitalize="words"
            maxLength={24}
            accessibilityLabel="Your name"
          />
        </Card>

        <Card style={s.card}>
          <Text style={s.label}>Avatar</Text>
          <View style={s.grid}>
            {AVATARS.map(option => {
              const selected = option === avatar;
              return (
                <Pressable
                  key={option ?? 'initial'}
                  accessibilityRole="button"
                  accessibilityLabel={option ?? 'Initial of your name'}
                  accessibilityState={{ selected }}
                  onPress={() => setAvatar(option)}
                  style={({ pressed }) => [s.option, selected && s.optionSelected, pressed && s.pressed]}>
                  <Avatar profile={{ name: name || ' ', avatar: option }} size={44} />
                </Pressable>
              );
            })}
          </View>
        </Card>

        {error ? <Text style={s.error}>{error}</Text> : null}
        <PrimaryButton label="Save profile" onPress={save} loading={saving} style={s.save} />
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles(c => ({
  pressed: { transform: [{ scale: 0.97 }] },
  content: { paddingHorizontal: SCREEN_PADDING, paddingBottom: SECTION_GAP },
  preview: { alignSelf: 'center', marginTop: space[4], marginBottom: SECTION_GAP },
  card: { gap: space[3], marginBottom: space[3] },
  label: { ...type.eyebrow, color: c.inkMuted },
  input: {
    ...type.body,
    color: c.ink,
    minHeight: 48,
    backgroundColor: c.surfaceSunken,
    borderRadius: radius.s,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  option: {
    minWidth: TOUCH_TARGET,
    padding: 3,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionSelected: { borderColor: c.ink, backgroundColor: c.surfaceSunken },
  error: { ...type.caption, color: c.low, textAlign: 'center', marginTop: space[1] },
  save: { marginTop: space[6] },
}));
