import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useExpenses } from '../ExpensesContext';
import { CATEGORIES, Category, Expense, FinancialGoal } from '../types';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../categoryStyle';

function formatCurrency(amount: number) {
  return `₹${amount.toFixed(2)}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const WEEK_DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function dateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function CategoryFilter({
  selected,
  onSelect,
}: {
  selected: Category | 'All';
  onSelect: (category: Category | 'All') => void;
}) {
  return (
    <View style={styles.filterPanel}>
      <Text style={styles.filterLabel}>FILTER LOG // CATEGORY</Text>
      <View style={styles.filterRow}>
        {(['All', ...CATEGORIES] as const).map((category) => (
          <Pressable
            key={category}
            onPress={() => onSelect(category)}
            style={[
              styles.filterChip,
              selected === category && styles.filterChipSelected,
            ]}
          >
            <Text
              style={[
                styles.filterText,
                selected === category && styles.filterTextSelected,
              ]}
            >
              {category.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ExpenseCalendar({
  expenses,
  goals,
}: {
  expenses: Expense[];
  goals: FinancialGoal[];
}) {
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const expensesByDate = useMemo(() => {
    const grouped = new Map<string, Expense[]>();
    for (const expense of expenses) {
      const key = dateKey(new Date(expense.date));
      grouped.set(key, [...(grouped.get(key) ?? []), expense]);
    }
    return grouped;
  }, [expenses]);
  const goalsByDate = useMemo(() => {
    const grouped = new Map<string, FinancialGoal[]>();
    for (const goal of goals) {
      const deadline = new Date(`${goal.targetDate}T00:00:00`);
      if (Number.isNaN(deadline.getTime())) continue;
      const key = dateKey(deadline);
      grouped.set(key, [...(grouped.get(key) ?? []), goal]);
    }
    return grouped;
  }, [goals]);
  const firstDay = month.getDay();
  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0
  ).getDate();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, index) =>
    index < firstDay ? null : index - firstDay + 1
  );
  const monthLabel = month.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
  const monthExpenses = expenses.filter((expense) => {
    const date = new Date(expense.date);
    return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
  });
  const monthlyTotal = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const monthKeyPrefix = `${month.getFullYear()}-${month.getMonth()}-`;
  const activeDayAmounts = Array.from(expensesByDate.entries())
    .filter(([key]) => key.startsWith(monthKeyPrefix))
    .map(([, items]) => items.reduce((sum, expense) => sum + expense.amount, 0));
  const averageDayTotal = activeDayAmounts.length
    ? activeDayAmounts.reduce((sum, amount) => sum + amount, 0) / activeDayAmounts.length
    : 0;
  const unusualDays = new Set(
    Array.from(expensesByDate.entries())
      .filter(([key, items]) => {
        if (!key.startsWith(monthKeyPrefix)) return false;
        const amount = items.reduce((sum, expense) => sum + expense.amount, 0);
        return activeDayAmounts.length > 1 && amount > averageDayTotal * 1.5;
      })
      .map(([key]) => key)
  );
  const selectedExpenses = selectedDate ? expensesByDate.get(selectedDate) ?? [] : [];
  const selectedGoals = selectedDate ? goalsByDate.get(selectedDate) ?? [] : [];
  const selectedTotal = selectedExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  const shiftMonth = (amount: number) => {
    setMonth((current) =>
      new Date(current.getFullYear(), current.getMonth() + amount, 1)
    );
    setSelectedDate(null);
  };

  return (
    <View style={styles.calendar}>
      <View style={styles.calendarHeader}>
        <View>
          <Text style={styles.calendarCaption}>VECTORR / CALENDAR</Text>
          <Text style={styles.calendarTitle}>{monthLabel.toUpperCase()}</Text>
        </View>
        <View style={styles.calendarControls}>
          <Pressable
            onPress={() => shiftMonth(-1)}
            style={styles.calendarButton}
            accessibilityLabel="Previous month"
          >
            <Text style={styles.calendarButtonText}>{'<'}</Text>
          </Pressable>
          <Pressable
            onPress={() => shiftMonth(1)}
            style={styles.calendarButton}
            accessibilityLabel="Next month"
          >
            <Text style={styles.calendarButtonText}>{'>'}</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.monthSummary}>
        <Text style={styles.monthSummaryLabel}>MONTHLY SPENDING</Text>
        <Text style={styles.monthSummaryValue}>{formatCurrency(monthlyTotal)}</Text>
      </View>
      <View style={styles.weekRow}>
        {WEEK_DAYS.map((day) => (
          <Text key={day} style={styles.weekLabel}>
            {day}
          </Text>
        ))}
      </View>
      <View style={styles.calendarGrid}>
        {cells.map((day, index) => {
          if (!day) return <View key={`empty-${index}`} style={styles.calendarCell} />;
          const currentDate = new Date(month.getFullYear(), month.getMonth(), day);
          const key = dateKey(currentDate);
          const dayExpenses = expensesByDate.get(key) ?? [];
          const count = dayExpenses.length;
          const dayGoals = goalsByDate.get(key) ?? [];
          const today = key === dateKey(new Date());
          const unusual = unusualDays.has(key);
          const selected = selectedDate === key;
          return (
            <Pressable
              key={day}
              onPress={() => setSelectedDate(key)}
              style={[
                styles.calendarCell,
                today && styles.calendarToday,
                unusual && styles.calendarUnusual,
                selected && styles.calendarSelected,
              ]}
              accessibilityLabel={`${monthLabel} ${day}`}
            >
              <Text style={[styles.calendarDate, count > 0 && styles.calendarDateActive]}>
                {day}
              </Text>
              {count > 0 && (
                <Text style={styles.calendarMarker}>{count > 1 ? count : '•'}</Text>
              )}
              {dayGoals.length > 0 && <Text style={styles.calendarGoalMarker}>◆</Text>}
            </Pressable>
          );
        })}
      </View>
      {selectedDate ? (
        <View style={styles.daySummary}>
          <Text style={styles.daySummaryLabel}>
            {new Date(
              Number(selectedDate.split('-')[0]),
              Number(selectedDate.split('-')[1]),
              Number(selectedDate.split('-')[2])
            ).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}
          </Text>
          <Text style={styles.daySummaryValue}>{formatCurrency(selectedTotal)}</Text>
          <Text style={styles.daySummaryMeta}>
            {selectedExpenses.length} EXPENSE{selectedExpenses.length === 1 ? '' : 'S'}
            {selectedGoals.length > 0
              ? ` // GOAL DUE: ${selectedGoals.map((goal) => goal.name).join(', ')}`
              : ''}
          </Text>
        </View>
      ) : (
        <Text style={styles.calendarHint}>TAP A DATE FOR DAILY TOTALS</Text>
      )}
      <Text style={styles.calendarLegend}>● EXPENSE // ◆ GOAL DEADLINE // MAGENTA = HIGH SPEND</Text>
    </View>
  );
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

function CategoryBreakdown({
  expenses,
  total,
}: {
  expenses: Expense[];
  total: number;
}) {
  const byCategory = useMemo(() => {
    const sums: Record<Category, number> = {
      Food: 0,
      Transport: 0,
      Shopping: 0,
      Bills: 0,
      Entertainment: 0,
      Health: 0,
      Other: 0,
    };
    for (const expense of expenses) sums[expense.category] += expense.amount;
    return CATEGORIES.map((category) => ({
      category,
      amount: sums[category],
    }))
      .filter((item) => item.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  return (
    <View style={styles.breakdown}>
      <View style={styles.breakdownHeader}>
        <View>
          <Text style={styles.breakdownCaption}>VECTORR / ARCHIVE</Text>
          <Text style={styles.breakdownTitle}>SYSTEM BREAKDOWN</Text>
        </View>
        <Text style={styles.breakdownCode}>STATS.EXE</Text>
      </View>
      {byCategory.length === 0 ? (
        <Text style={styles.breakdownEmpty}>NO CATEGORY DATA YET</Text>
      ) : (
        byCategory.map(({ category, amount }) => {
          const pct = total > 0 ? amount / total : 0;
          return (
            <View key={category} style={styles.breakdownItem}>
              <View style={styles.breakdownItemHeader}>
                <Text style={styles.breakdownLabel}>
                  {CATEGORY_ICONS[category]} {category}
                </Text>
                <Text style={styles.breakdownAmount}>{formatCurrency(amount)}</Text>
              </View>
              <View style={styles.breakdownTrack}>
                <View
                  style={[
                    styles.breakdownFill,
                    {
                      width: `${Math.max(pct * 100, 2)}%`,
                      backgroundColor: CATEGORY_COLORS[category],
                    },
                  ]}
                />
              </View>
              <Text style={styles.breakdownPct}>{Math.round(pct * 100)}%</Text>
            </View>
          );
        })
      )}
    </View>
  );
}

export default function HomeScreen() {
  const { expenses, goals = [], loading, deleteExpense } = useExpenses();
  const [categoryFilter, setCategoryFilter] = useState<Category | 'All'>('All');
  const visibleExpenses = useMemo(
    () =>
      categoryFilter === 'All'
        ? expenses
        : expenses.filter((expense) => expense.category === categoryFilter),
    [categoryFilter, expenses]
  );
  const visibleTotal = useMemo(
    () => visibleExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    [visibleExpenses]
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.windowChrome}>
          <Text style={styles.windowTitle}>PERSONAL FINANCE // 2001</Text>
          <Text style={styles.windowControls}>[ _ ] [ x ]</Text>
        </View>
        <View style={styles.headerTopline}>
          <Text style={styles.headerLabel}>VECTORR.EXE / HOME + STATS</Text>
          <Text style={styles.headerStatus}>● ONLINE</Text>
        </View>
        <Text style={styles.headerLabel}>TOTAL SPENT</Text>
        <Text style={styles.headerTotal}>{formatCurrency(visibleTotal)}</Text>
        <Text style={styles.headerCount}>
          {visibleExpenses.length} expense{visibleExpenses.length === 1 ? '' : 's'} logged
          {categoryFilter === 'All' ? ' // INR' : ` // ${categoryFilter.toUpperCase()}`}
        </Text>
      </View>

      {loading ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>LOADING_...</Text>
        </View>
      ) : (
        <FlatList
          data={visibleExpenses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View>
              <CategoryFilter selected={categoryFilter} onSelect={setCategoryFilter} />
              <ExpenseCalendar expenses={visibleExpenses} goals={goals} />
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>[ $$$ ]</Text>
              <Text style={styles.emptyText}>NO EXPENSES YET</Text>
              <Text style={styles.emptySubtext}>
                USE THE ADD TAB TO CREATE YOUR FIRST LOG
              </Text>
            </View>
          }
          ListFooterComponent={
            <CategoryBreakdown expenses={visibleExpenses} total={visibleTotal} />
          }
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
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
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
  list: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 16, gap: 12 },
  filterPanel: { backgroundColor: '#E9E2FF', borderWidth: 1, borderColor: '#B8AEDB', padding: 12, marginBottom: 10 },
  filterLabel: { color: '#5D557A', fontFamily: 'monospace', fontSize: 9, fontWeight: '700', marginBottom: 8 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filterChip: { borderWidth: 1, borderColor: '#B8AEDB', backgroundColor: '#FFFFFF', paddingHorizontal: 8, paddingVertical: 6 },
  filterChipSelected: { backgroundColor: '#FF4FD8', borderColor: '#00F5D4' },
  filterText: { color: '#3D3854', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
  filterTextSelected: { color: '#201A33' },
  calendar: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B8AEDB', padding: 14, marginBottom: 4 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  calendarCaption: { fontFamily: 'monospace', fontSize: 9, fontWeight: '700', color: '#D6009A', marginBottom: 5 },
  calendarTitle: { fontFamily: 'monospace', fontSize: 17, fontWeight: '700', color: '#201A33' },
  calendarControls: { flexDirection: 'row', gap: 6 },
  calendarButton: { width: 32, height: 30, borderWidth: 1, borderColor: '#B8AEDB', alignItems: 'center', justifyContent: 'center' },
  calendarButtonText: { color: '#008F7D', fontFamily: 'monospace', fontSize: 16, fontWeight: '700' },
  monthSummary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#E1DAF1', paddingVertical: 8, marginBottom: 10 },
  monthSummaryLabel: { color: '#6B6680', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
  monthSummaryValue: { color: '#5B2DB8', fontFamily: 'monospace', fontSize: 16, fontWeight: '700' },
  weekRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E1DAF1', paddingBottom: 6, marginBottom: 4 },
  weekLabel: { width: '14.2857%', textAlign: 'center', color: '#6B6680', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCell: { width: '14.2857%', minHeight: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F0ECFA' },
  calendarToday: { borderColor: '#D6009A', backgroundColor: '#FFF3FC' },
  calendarUnusual: { backgroundColor: '#FFE7EF', borderColor: '#C52757' },
  calendarSelected: { borderWidth: 2, borderColor: '#5B2DB8' },
  calendarDate: { color: '#6B6680', fontFamily: 'monospace', fontSize: 11 },
  calendarDateActive: { color: '#5B2DB8', fontWeight: '700' },
  calendarMarker: { color: '#00A990', fontFamily: 'monospace', fontSize: 13, lineHeight: 13 },
  calendarGoalMarker: { color: '#D6009A', fontFamily: 'monospace', fontSize: 9, lineHeight: 9 },
  calendarHint: { color: '#9B91B8', fontFamily: 'monospace', fontSize: 9, marginTop: 10 },
  daySummary: { backgroundColor: '#F8F6FF', borderLeftWidth: 3, borderLeftColor: '#D6009A', padding: 10, marginTop: 10 },
  daySummaryLabel: { color: '#6B6680', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
  daySummaryValue: { color: '#5B2DB8', fontFamily: 'monospace', fontSize: 20, fontWeight: '700', marginTop: 3 },
  daySummaryMeta: { color: '#008F7D', fontFamily: 'monospace', fontSize: 9, marginTop: 3 },
  calendarLegend: { color: '#9B91B8', fontFamily: 'monospace', fontSize: 8, marginTop: 9 },
  breakdown: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B8AEDB',
    padding: 14,
    marginTop: 4,
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  breakdownCaption: { fontFamily: 'monospace', fontSize: 9, fontWeight: '700', color: '#D6009A', marginBottom: 5 },
  breakdownTitle: { fontFamily: 'monospace', fontSize: 17, fontWeight: '700', color: '#201A33' },
  breakdownCode: { fontFamily: 'monospace', fontSize: 10, color: '#008F7D' },
  breakdownItem: { marginBottom: 14 },
  breakdownItemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  breakdownLabel: { fontFamily: 'monospace', fontSize: 12, fontWeight: '600', color: '#201A33' },
  breakdownAmount: { fontFamily: 'monospace', fontSize: 12, fontWeight: '700', color: '#A45A00' },
  breakdownTrack: { height: 9, backgroundColor: '#F0ECFA', borderWidth: 1, borderColor: '#B8AEDB', overflow: 'hidden' },
  breakdownFill: { height: '100%' },
  breakdownPct: { fontFamily: 'monospace', fontSize: 10, color: '#6B6680', marginTop: 3 },
  breakdownEmpty: { fontFamily: 'monospace', fontSize: 11, color: '#6B6680' },
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
