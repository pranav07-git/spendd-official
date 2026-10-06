import { ScrollView, Text, View } from 'react-native';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { LEGAL_DOCUMENTS, LEGAL_UPDATED } from '../legal/documents';
import type { ScreenProps } from '../navigation/types';
import { makeStyles, SCREEN_PADDING, space, type } from '../theme';

/** The Privacy Policy or Terms of Use, read inside the app. */
export function LegalScreen({ navigation, route }: ScreenProps<'Legal'>) {
  const s = useStyles();
  const doc = LEGAL_DOCUMENTS[route.params.doc];
  return (
    <Screen>
      <Header title={doc.title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.updated}>Last updated {LEGAL_UPDATED}</Text>
        <Text style={s.intro}>{doc.intro}</Text>
        {doc.sections.map(section => (
          <View key={section.heading} style={s.section}>
            <Text style={s.heading} accessibilityRole="header">
              {section.heading}
            </Text>
            {section.paragraphs?.map(p => (
              <Text key={p} style={s.paragraph}>
                {p}
              </Text>
            ))}
            {section.bullets?.map(b => (
              <View key={b} style={s.bullet}>
                <Text style={s.dot}>•</Text>
                <Text style={s.bulletText}>{b}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles(c => ({
  content: { paddingHorizontal: SCREEN_PADDING, paddingTop: space[2], paddingBottom: space[10] },
  updated: { ...type.caption, color: c.inkSubtle },
  intro: { ...type.body, color: c.ink, marginTop: space[3] },
  section: { marginTop: space[6] },
  heading: { ...type.heading, color: c.ink, marginBottom: space[2] },
  paragraph: { ...type.body, color: c.inkMuted, marginBottom: space[2] },
  bullet: { flexDirection: 'row', gap: space[2], marginBottom: space[2] },
  dot: { ...type.body, color: c.inkMuted },
  bulletText: { ...type.body, color: c.inkMuted, flex: 1 },
}));
