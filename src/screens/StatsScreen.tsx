import React, { useMemo } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { useExpenses } from '../ExpensesContext';
import { CATEGORIES, Category } from '../types';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../categoryStyle';
import { colors, radius } from '../theme';
import Text from '../components/Text';

function formatCurrency(amount: number) {
  return `₹${amount.toFixed(2)}`;
}

export default function StatsScreen() {
  const { expenses, total } = useExpenses();

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
    for (const e of expenses) sums[e.category] += e.amount;
    return CATEGORIES.map((c) => ({ category: c, amount: sums[c] }))
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleBar}>
          <Text style={styles.title}>Breakdown</Text>
        </View>
        {byCategory.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No data yet</Text>
          </View>
        ) : (
          byCategory.map(({ category, amount }) => {
            const pct = total > 0 ? amount / total : 0;
            return (
              <View key={category} style={styles.item}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemLabel}>
                    {CATEGORY_ICONS[category]} {category}
                  </Text>
                  <Text style={styles.itemAmount}>{formatCurrency(amount)}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${Math.max(pct * 100, 2)}%`,
                        backgroundColor: CATEGORY_COLORS[category],
                      },
                    ]}
                  />
                </View>
                <Text style={styles.itemPct}>{Math.round(pct * 100)}%</Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, gap: 4, paddingBottom: 32 },
  titleBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '600', color: colors.text },
  item: { marginBottom: 20 },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  itemLabel: { fontSize: 14, fontWeight: '500', color: colors.text },
  itemAmount: { fontSize: 14, fontWeight: '600', color: colors.text },
  barTrack: {
    height: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: radius.sm },
  itemPct: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15, color: colors.textMuted },
});
