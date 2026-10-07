import { StyleSheet, View } from 'react-native';
import { Screen } from '../components/Screen';
import { useToast } from '../components/Toast';
import type { ScreenProps } from '../navigation/types';
import { TransactionsTab } from './home/TransactionsTab';
import { useMoneyData } from './home/useMoneyData';

/**
 * The transaction list as a page of its own, for links from other screens (a story's Details, My
 * Money's search), so following them leaves the bottom tabs where they were.
 */
export function TransactionsScreen({ navigation, route }: ScreenProps<'Transactions'>) {
  const { transactions, reload } = useMoneyData();
  const toast = useToast();
  return (
    <Screen>
      <View style={styles.body}>
        <TransactionsTab
          initialQuery={route.params?.query ?? ''}
          transactions={transactions}
          onReload={reload}
          onBack={navigation.goBack}
          onOpen={transaction => navigation.navigate('TransactionDetails', { transaction })}
          onAdd={() => navigation.navigate('AddTransaction')}
          onToast={toast.show}
        />
        {toast.node}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ body: { flex: 1 } });
