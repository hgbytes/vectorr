import React, { useMemo } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useExpenses } from '../ExpensesContext';
import { CATEGORIES, Category } from '../types';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../categoryStyle';

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
          <View>
            <Text style={styles.windowCaption}>VECTORR / ARCHIVE</Text>
            <Text style={styles.title}>SYSTEM BREAKDOWN</Text>
          </View>
          <Text style={styles.titleCode}>STATS.EXE</Text>
        </View>
        {byCategory.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>NO DATA YET</Text>
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
  container: { flex: 1, backgroundColor: '#F8F6FF' },
  content: { padding: 24, gap: 4 },
  titleBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  windowCaption: { fontFamily: 'monospace', fontSize: 9, fontWeight: '700', color: '#D6009A', marginBottom: 5 },
  title: { fontFamily: 'monospace', fontSize: 21, fontWeight: '700', color: '#201A33' },
  titleCode: { fontFamily: 'monospace', fontSize: 10, color: '#008F7D' },
  item: { marginBottom: 20 },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  itemLabel: { fontFamily: 'monospace', fontSize: 14, fontWeight: '600', color: '#201A33' },
  itemAmount: { fontFamily: 'monospace', fontSize: 14, fontWeight: '700', color: '#A45A00' },
  barTrack: {
    height: 10,
    borderRadius: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B8AEDB',
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 0 },
  itemPct: { fontFamily: 'monospace', fontSize: 11, color: '#6B6680', marginTop: 4 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { fontFamily: 'monospace', fontSize: 15, color: '#6B6680' },
});
