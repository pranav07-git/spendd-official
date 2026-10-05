import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { PrimaryButton } from '../components/Buttons';
import { ChevronLeftIcon } from '../components/Icons';
import { Screen } from '../components/Screen';
import type { ScreenProps } from '../navigation/types';
import { DEFAULT_PROFILE, getProfile, saveProfile } from '../storage/appState';
import { colors, fonts } from '../theme';

/** null = the name's initial. */
const AVATARS: (string | null)[] = [null, '😎', '🦊', '🐼', '🌸', '🚀', '🎧', '⚡', '🍀', '🐯', '☕', '🎨'];

export function EditProfileScreen({ navigation }: ScreenProps<'EditProfile'>) {
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
      setError('Enter your name.');
      return;
    }
    setSaving(true);
    try {
      await saveProfile({ name: trimmed, avatar });
      navigation.goBack();
    } catch {
      setError('Couldn’t save. Try again.');
      setSaving(false);
    }
  };

  const preview = { name: name || ' ', avatar };

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={navigation.goBack}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <ChevronLeftIcon size={20} color={colors.ink} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.headerTitle} accessibilityRole="header">
          Edit Profile
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Avatar profile={preview} size={96} style={styles.preview} />

        <View style={styles.card}>
          <Text style={styles.label}>YOUR NAME</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="What should we call you?"
            placeholderTextColor={colors.inkFaint}
            style={styles.input}
            autoCapitalize="words"
            maxLength={24}
            accessibilityLabel="Your name"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>AVATAR</Text>
          <View style={styles.grid}>
            {AVATARS.map(option => {
              const selected = option === avatar;
              return (
                <Pressable
                  key={option ?? 'initial'}
                  accessibilityRole="button"
                  accessibilityLabel={option ?? 'Initial of your name'}
                  accessibilityState={{ selected }}
                  onPress={() => setAvatar(option)}
                  style={[styles.option, selected && styles.optionSelected]}>
                  <Avatar profile={{ name: name || ' ', avatar: option }} size={44} />
                </Pressable>
              );
            })}
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton label="SAVE" onPress={save} loading={saving} style={styles.save} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.6 },
  header: { height: 72, justifyContent: 'center', alignItems: 'center' },
  back: {
    position: 'absolute',
    left: 24,
    width: 40,
    height: 40,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.ink },
  content: { paddingHorizontal: 24, paddingBottom: 32 },
  preview: { alignSelf: 'center', marginTop: 24, marginBottom: 32 },
  card: {
    backgroundColor: '#1C1C1C',
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingVertical: 22,
    gap: 16,
    marginBottom: 16,
  },
  label: { fontFamily: fonts.sansMedium, fontSize: 11, letterSpacing: 2.2, color: colors.inkMuted },
  input: {
    fontFamily: fonts.sansMedium,
    fontSize: 18,
    color: colors.ink,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderStrong,
    paddingVertical: 8,
    marginTop: -8,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  option: { padding: 3, borderWidth: 1, borderColor: 'transparent' },
  optionSelected: { borderColor: colors.ink },
  error: { fontFamily: fonts.sans, fontSize: 13, color: colors.danger, textAlign: 'center', marginTop: 4 },
  save: { marginTop: 16 },
});
