import { ScrollView } from 'react-native';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import type { ScreenProps } from '../navigation/types';
import { makeStyles, SCREEN_PADDING, space } from '../theme';
import { AiNote, InsightsCard } from './home/HomeSections';

/** Every insight, opened from "See all" on Home (which previews the first few). */
export function InsightsScreen({ navigation, route }: ScreenProps<'Insights'>) {
  const s = useStyles();
  const { items, written } = route.params;
  return (
    <Screen>
      <Header title="Insights" onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <InsightsCard items={items} />
        <AiNote thinking={false} written={written} />
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  content: { paddingHorizontal: SCREEN_PADDING, paddingTop: space[2], paddingBottom: space[8] },
}));
