import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useExpenses } from '../ExpensesContext';
import { CATEGORIES, Category, Expense, FinancialGoal } from '../types';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../categoryStyle';
import { colors, glow, radius } from '../theme';
import Text from '../components/Text';
import { buildAdvisorSummary } from '../aiAdvisor';

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
      <Text style={styles.filterLabel}>Category</Text>
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
              {category}
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
        <Text style={styles.calendarTitle}>{monthLabel}</Text>
        <View style={styles.calendarControls}>
          <Pressable
            onPress={() => shiftMonth(-1)}
            style={styles.calendarButton}
            accessibilityLabel="Previous month"
          >
            <Text style={styles.calendarButtonText}>{'‹'}</Text>
          </Pressable>
          <Pressable
            onPress={() => shiftMonth(1)}
            style={styles.calendarButton}
            accessibilityLabel="Next month"
          >
            <Text style={styles.calendarButtonText}>{'›'}</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.monthSummary}>
        <Text style={styles.monthSummaryLabel}>Spent</Text>
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
            ).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
          <Text style={styles.daySummaryValue}>{formatCurrency(selectedTotal)}</Text>
          <Text style={styles.daySummaryMeta}>
            {selectedExpenses.length} expense{selectedExpenses.length === 1 ? '' : 's'}
            {selectedGoals.length > 0
              ? ` · Goal due: ${selectedGoals.map((goal) => goal.name).join(', ')}`
              : ''}
          </Text>
        </View>
      ) : (
        <Text style={styles.calendarHint}>Tap a date for totals</Text>
      )}
      <Text style={styles.calendarLegend}>● Expense   ◆ Goal due   Highlight = high spend</Text>
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

function CollapsibleSection({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.collapsibleSection}>
      <Pressable onPress={onToggle} style={styles.collapsibleToggle} accessibilityRole="button">
        <Text style={styles.collapsibleTitle}>{title}</Text>
        <Text style={styles.collapsibleIcon}>{expanded ? '−' : '+'}</Text>
      </Pressable>
      {expanded && children}
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
        <Text style={styles.breakdownTitle}>Breakdown</Text>
      </View>
      {byCategory.length === 0 ? (
        <Text style={styles.breakdownEmpty}>No data yet</Text>
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

function useSpin(active: boolean) {
  const [spin] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!active) {
      spin.stopAnimation();
      spin.setValue(0);
      return;
    }
    spin.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [active, spin]);
  return spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
}

function AiInsightsWidget() {
  const navigation = useNavigation();
  const {
    authUser,
    profile,
    goals,
    expenses,
    aiInsights,
    aiInsightsGeneratedAt,
    aiInsightsLoading,
    aiInsightsError,
    refreshAiInsights,
  } = useExpenses();
  const [containerWidth, setContainerWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const spinDeg = useSpin(aiInsightsLoading);
  const insights = aiInsights ?? [];

  const handleRefresh = () => {
    const now = new Date();
    const monthlyExpensesTotal = expenses
      .filter((expense) => {
        const date = new Date(expense.date);
        return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
      })
      .reduce((sum, expense) => sum + expense.amount, 0);
    const emergencyContribution = Math.max(profile.emergencyFundTarget - profile.currentSavings, 0) / 12;
    const availableGoalBudget = Math.max(
      profile.monthlyIncome - monthlyExpensesTotal - profile.monthlyDebtPayments - emergencyContribution,
      0
    );
    const summary = buildAdvisorSummary(goals, profile, expenses, availableGoalBudget, monthlyExpensesTotal, []);
    void refreshAiInsights(summary);
  };

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (containerWidth > 0) {
      setActiveIndex(Math.round(event.nativeEvent.contentOffset.x / containerWidth));
    }
  };

  const jumpTo = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * containerWidth, animated: true });
    setActiveIndex(index);
  };

  return (
    <View
      style={styles.aiWidget}
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
    >
      <View style={styles.aiWidgetHeader}>
        <Text style={styles.aiWidgetTitle}>AI Insights</Text>
        {authUser && (
          <Pressable
            onPress={handleRefresh}
            style={styles.aiRefreshIconButton}
            hitSlop={8}
            accessibilityLabel="Refresh AI insights"
          >
            <Animated.Text style={[styles.aiRefreshIcon, { transform: [{ rotate: spinDeg }] }]}>
              {'⟳'}
            </Animated.Text>
          </Pressable>
        )}
      </View>

      {!authUser ? (
        <Pressable
          style={styles.aiSignInPrompt}
          onPress={() => navigation.navigate('Profile' as never)}
        >
          <Text style={styles.aiSignInText}>Sign in to unlock AI insights</Text>
          <Text style={styles.aiSignInSubtext}>Tap to go to Profile →</Text>
        </Pressable>
      ) : aiInsightsLoading && insights.length === 0 ? (
        <Text style={styles.aiStatusText}>Analyzing your finances…</Text>
      ) : aiInsightsError ? (
        <Pressable onPress={handleRefresh}>
          <Text style={styles.aiErrorText}>{aiInsightsError} — tap to retry</Text>
        </Pressable>
      ) : insights.length === 0 ? (
        <Pressable style={styles.aiGenerateButton} onPress={handleRefresh}>
          <Text style={styles.aiGenerateButtonText}>✨ Generate insights</Text>
        </Pressable>
      ) : (
        <>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScrollEnd}
          >
            {insights.map((insight, index) => (
              <Pressable
                key={`${insight.title}-${index}`}
                style={[styles.aiCard, { width: containerWidth || undefined }]}
                onPress={() => jumpTo((index + 1) % insights.length)}
              >
                <View
                  style={[
                    styles.aiCardAccent,
                    insight.severity === 'warning' && styles.aiCardAccentWarning,
                    insight.severity === 'positive' && styles.aiCardAccentPositive,
                  ]}
                />
                <Text style={styles.aiCardTitle}>{insight.title}</Text>
                <Text style={styles.aiCardDetail}>{insight.detail}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {insights.length > 1 && (
            <View style={styles.aiDots}>
              {insights.map((_, index) => (
                <Pressable
                  key={index}
                  onPress={() => jumpTo(index)}
                  hitSlop={6}
                  style={[styles.aiDot, index === activeIndex && styles.aiDotActive]}
                />
              ))}
            </View>
          )}
          {aiInsightsGeneratedAt && (
            <Text style={styles.aiUpdatedAt}>
              Updated {new Date(aiInsightsGeneratedAt).toLocaleString()}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const { expenses, goals = [], loading, deleteExpense } = useExpenses();
  const [categoryFilter, setCategoryFilter] = useState<Category | 'All'>('All');
  const [showCalendar, setShowCalendar] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const visibleExpenses = useMemo(
    () => [...(categoryFilter === 'All' ? expenses : expenses.filter((expense) => expense.category === categoryFilter))]
      .sort((left, right) => Date.parse(right.date) - Date.parse(left.date)),
    [categoryFilter, expenses]
  );
  const visibleTotal = useMemo(
    () => visibleExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    [visibleExpenses]
  );
  const monthlyTotal = useMemo(() => {
    const now = new Date();
    return visibleExpenses
      .filter((expense) => {
        const date = new Date(expense.date);
        return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
      })
      .reduce((sum, expense) => sum + expense.amount, 0);
  }, [visibleExpenses]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Total spent</Text>
        <Text style={styles.headerTotal}>{formatCurrency(visibleTotal)}</Text>
        <Text style={styles.headerCount}>
          {visibleExpenses.length} logged
          {categoryFilter === 'All' ? '' : ` · ${categoryFilter}`}
        </Text>
        <View style={styles.headerMonthly}>
          <Text style={styles.headerMonthlyLabel}>This month</Text>
          <Text style={styles.headerMonthlyValue}>{formatCurrency(monthlyTotal)}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Loading…</Text>
        </View>
      ) : (
        <FlatList
          data={visibleExpenses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View>
              <AiInsightsWidget />
              <CategoryFilter selected={categoryFilter} onSelect={setCategoryFilter} />
              <CollapsibleSection title="Calendar" expanded={showCalendar} onToggle={() => setShowCalendar((current) => !current)}>
                <ExpenseCalendar expenses={visibleExpenses} goals={goals} />
              </CollapsibleSection>
              <CollapsibleSection title="Breakdown" expanded={showBreakdown} onToggle={() => setShowBreakdown((current) => !current)}>
                <CategoryBreakdown expenses={visibleExpenses} total={visibleTotal} />
              </CollapsibleSection>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No expenses yet</Text>
              <Text style={styles.emptySubtext}>
                Tap + to add one
              </Text>
            </View>
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
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    padding: 20,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },
  headerTotal: { color: colors.accent, fontSize: 40, fontWeight: '700', marginTop: 6 },
  headerCount: { color: colors.textMuted, fontSize: 13, marginTop: 6 },
  headerMonthly: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', borderTopWidth: 1, borderTopColor: colors.border, marginTop: 14, paddingTop: 12 },
  headerMonthlyLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
  headerMonthlyValue: { color: colors.text, fontSize: 17, fontWeight: '600' },
  list: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 16, gap: 12 },
  collapsibleSection: { marginBottom: 8 },
  collapsibleToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12 },
  collapsibleTitle: { color: colors.text, fontSize: 13, fontWeight: '600' },
  collapsibleIcon: { color: colors.textMuted, fontSize: 18, fontWeight: '400' },
  aiWidget: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, marginBottom: 10, overflow: 'hidden' },
  aiWidgetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  aiWidgetTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
  aiRefreshIconButton: { width: 28, height: 28, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  aiRefreshIcon: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  aiSignInPrompt: { paddingVertical: 4, gap: 4 },
  aiSignInText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  aiSignInSubtext: { color: colors.textMuted, fontSize: 12 },
  aiStatusText: { color: colors.textMuted, fontSize: 12, lineHeight: 16 },
  aiErrorText: { color: colors.danger, fontSize: 12, lineHeight: 16 },
  aiGenerateButton: { alignSelf: 'flex-start', backgroundColor: colors.accent, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 10, ...glow },
  aiGenerateButtonText: { color: colors.onAccent, fontSize: 13, fontWeight: '600' },
  aiCard: { paddingRight: 4, gap: 6 },
  aiCardAccent: { height: 3, width: 32, borderRadius: 2, backgroundColor: colors.info, marginBottom: 2 },
  aiCardAccentWarning: { backgroundColor: colors.warning },
  aiCardAccentPositive: { backgroundColor: colors.positive },
  aiCardTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  aiCardDetail: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  aiDots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  aiDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  aiDotActive: { backgroundColor: colors.accent, width: 16 },
  aiUpdatedAt: { color: colors.textFaint, fontSize: 10, marginTop: 8, textAlign: 'right' },
  filterPanel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, marginBottom: 10 },
  filterLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '500', marginBottom: 8 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filterChip: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  filterChipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { color: colors.text, fontSize: 12, fontWeight: '500' },
  filterTextSelected: { color: colors.onAccent },
  calendar: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 16, marginBottom: 4 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  calendarTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  calendarControls: { flexDirection: 'row', gap: 6 },
  calendarButton: { width: 32, height: 30, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  calendarButtonText: { color: colors.text, fontSize: 16, fontWeight: '500' },
  monthSummary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 8, marginBottom: 10 },
  monthSummaryLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
  monthSummaryValue: { color: colors.text, fontSize: 16, fontWeight: '600' },
  weekRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 6, marginBottom: 4 },
  weekLabel: { width: '14.2857%', textAlign: 'center', color: colors.textMuted, fontSize: 11, fontWeight: '500' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCell: { width: '14.2857%', minHeight: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent', borderRadius: radius.sm },
  calendarToday: { borderColor: colors.text, backgroundColor: colors.surfaceMuted },
  calendarUnusual: { backgroundColor: colors.dangerSoft },
  calendarSelected: { borderWidth: 1, borderColor: colors.text, backgroundColor: colors.accentSoft },
  calendarDate: { color: colors.textMuted, fontSize: 12 },
  calendarDateActive: { color: colors.text, fontWeight: '600' },
  calendarMarker: { color: colors.positive, fontSize: 12, lineHeight: 12 },
  calendarGoalMarker: { color: colors.textMuted, fontSize: 9, lineHeight: 9 },
  calendarHint: { color: colors.textFaint, fontSize: 12, marginTop: 10 },
  daySummary: { backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, padding: 12, marginTop: 10 },
  daySummaryLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
  daySummaryValue: { color: colors.text, fontSize: 20, fontWeight: '700', marginTop: 3 },
  daySummaryMeta: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  calendarLegend: { color: colors.textFaint, fontSize: 11, marginTop: 10 },
  breakdown: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 16,
    marginTop: 4,
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  breakdownTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  breakdownItem: { marginBottom: 14 },
  breakdownItemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  breakdownLabel: { fontSize: 13, fontWeight: '500', color: colors.text },
  breakdownAmount: { fontSize: 13, fontWeight: '600', color: colors.text },
  breakdownTrack: { height: 6, backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, overflow: 'hidden' },
  breakdownFill: { height: '100%' },
  breakdownPct: { fontSize: 11, color: colors.textMuted, marginTop: 3 },
  breakdownEmpty: { fontSize: 13, color: colors.textMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 20 },
  rowMain: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  rowSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  rowAmount: { fontSize: 14, fontWeight: '600', color: colors.text },
  deleteBtn: { paddingHorizontal: 6, paddingVertical: 6 },
  deleteText: { color: colors.textFaint, fontSize: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  emptyText: { fontSize: 16, fontWeight: '600', color: colors.text },
  emptySubtext: { fontSize: 12, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 24 },
});
