import React from 'react';
import {
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useExpenses } from '../ExpensesContext';
import { Expense } from '../types';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../categoryStyle';

function formatCurrency(amount: number) {
  return `₹${amount.toFixed(2)}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function ExpenseRow({
  expense,
  onDelete,
}: {
  expense: Expense;
  onDelete: (id: string) => void;
}) {
  return (
    <View style={styles.row}>
      <View
        style={[
          styles.iconBadge,
          { backgroundColor: CATEGORY_COLORS[expense.category] + '22' },
        ]}
      >
        <Text style={styles.iconText}>{CATEGORY_ICONS[expense.category]}</Text>
      </View>
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {expense.note || expense.category}
        </Text>
        <Text style={styles.rowSubtitle}>
          {expense.category} · {formatDate(expense.date)}
        </Text>
      </View>
      <Text style={styles.rowAmount}>{formatCurrency(expense.amount)}</Text>
      <Pressable
        onPress={() => onDelete(expense.id)}
        style={styles.deleteBtn}
        hitSlop={8}
      >
        <Text style={styles.deleteText}>✕</Text>
      </Pressable>
    </View>
  );
}

export default function HomeScreen() {
  const { expenses, loading, deleteExpense, total } = useExpenses();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.windowChrome}>
          <Text style={styles.windowTitle}>PERSONAL FINANCE // 2001</Text>
          <Text style={styles.windowControls}>[ _ ] [ x ]</Text>
        </View>
        <View style={styles.headerTopline}>
          <Text style={styles.headerLabel}>VECTORR.EXE / HOME</Text>
          <Text style={styles.headerStatus}>● ONLINE</Text>
        </View>
        <Text style={styles.headerLabel}>TOTAL SPENT</Text>
        <Text style={styles.headerTotal}>{formatCurrency(total)}</Text>
        <Text style={styles.headerCount}>
          {expenses.length} expense{expenses.length === 1 ? '' : 's'} logged // INR
        </Text>
      </View>

      {loading ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>LOADING_...</Text>
        </View>
      ) : expenses.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>[ $$$ ]</Text>
          <Text style={styles.emptyText}>NO EXPENSES YET</Text>
          <Text style={styles.emptySubtext}>
            USE THE ADD TAB TO CREATE A NEW LOG ENTRY
          </Text>
        </View>
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ExpenseRow expense={item} onDelete={deleteExpense} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F6FF' },
  header: {
    padding: 18,
    backgroundColor: '#E9E2FF',
    borderBottomWidth: 3,
    borderBottomColor: '#D6009A',
    shadowColor: '#00F5D4',
    shadowOpacity: 0.35,
    shadowRadius: 0,
    shadowOffset: { width: 5, height: 5 },
    elevation: 5,
  },
  windowChrome: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#B8AEDB',
    paddingBottom: 8,
    marginBottom: 14,
  },
  windowTitle: { color: '#5B2DB8', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
  windowControls: { color: '#D6009A', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
  headerTopline: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 26 },
  headerLabel: { color: '#5D557A', fontFamily: 'monospace', fontSize: 12, fontWeight: '700' },
  headerStatus: { color: '#008F7D', fontFamily: 'monospace', fontSize: 11, fontWeight: '700' },
  headerTotal: { color: '#5B2DB8', fontFamily: 'monospace', fontSize: 38, fontWeight: '700', marginTop: 6 },
  headerCount: { color: '#D6009A', fontFamily: 'monospace', fontSize: 12, marginTop: 8 },
  list: { padding: 16, gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 0,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#B8AEDB',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 0,
    shadowOffset: { width: 4, height: 4 },
    elevation: 3,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#A8B2D1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 20 },
  rowMain: { flex: 1 },
  rowTitle: { fontFamily: 'monospace', fontSize: 14, fontWeight: '700', color: '#201A33' },
  rowSubtitle: { fontFamily: 'monospace', fontSize: 11, color: '#6B6680', marginTop: 4 },
  rowAmount: { fontFamily: 'monospace', fontSize: 14, fontWeight: '700', color: '#A45A00' },
  deleteBtn: { paddingHorizontal: 6, paddingVertical: 6 },
  deleteText: { color: '#C52757', fontFamily: 'monospace', fontSize: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  emptyEmoji: { color: '#D6009A', fontFamily: 'monospace', fontSize: 25, marginBottom: 8 },
  emptyText: { fontFamily: 'monospace', fontSize: 16, fontWeight: '700', color: '#201A33' },
  emptySubtext: { fontFamily: 'monospace', fontSize: 11, color: '#6B6680', textAlign: 'center', paddingHorizontal: 24 },
});
