import React, { useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useExpenses } from '../ExpensesContext';
import { CATEGORIES, Category } from '../types';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../categoryStyle';
import { colors, glow, radius } from '../theme';
import Text from '../components/Text';

export default function AddExpenseScreen() {
  const { addExpense } = useExpenses();
  const navigation = useNavigation();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('Food');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const formatAmount = (value: string) => {
    const normalized = value.replace(/[^0-9.]/g, '');
    const [whole, decimal] = normalized.split('.');
    const formattedWhole = whole ? Number(whole).toLocaleString('en-IN') : '';
    return decimal === undefined ? formattedWhole : `${formattedWhole}.${decimal.slice(0, 2)}`;
  };

  const handleSubmit = async () => {
    setFormError('');
    const parsed = parseFloat(amount.replace(/,/g, ''));
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setFormError('Enter an amount greater than zero.');
      return;
    }
    setSaving(true);
    try {
      await addExpense({
        amount: parsed,
        category,
        note: note.trim(),
        date: new Date().toISOString(),
      });
      setAmount('');
      setNote('');
      setCategory('Food');
      navigation.navigate('Home' as never);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.titleBar}>
          <Text style={styles.title}>Add expense</Text>
        </View>

        <Text style={styles.label}>Amount</Text>
        <View style={styles.amountRow}>
          <Text style={styles.currencySymbol}>₹</Text>
          <TextInput
            style={styles.amountInput}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.textFaint}
            value={amount}
            onChangeText={(value) => setAmount(formatAmount(value))}
          />
        </View>

        <Text style={styles.label}>Category</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((c) => {
            const selected = c === category;
            return (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                style={[
                  styles.categoryChip,
                  selected && { backgroundColor: CATEGORY_COLORS[c], borderColor: CATEGORY_COLORS[c] },
                ]}
              >
                <Text style={styles.categoryIcon}>{CATEGORY_ICONS[c]}</Text>
                <Text
                  style={[
                    styles.categoryLabel,
                    selected && { color: colors.onAccent },
                  ]}
                >
                  {c}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Note</Text>
        <TextInput
          style={styles.noteInput}
          placeholder="e.g. coffee"
          placeholderTextColor={colors.textFaint}
          value={note}
          onChangeText={setNote}
        />

        {!!formError && <Text style={styles.formError}>{formError}</Text>}
        <Pressable style={[styles.submitBtn, saving && styles.disabledButton]} onPress={handleSubmit} disabled={saving}>
          <Text style={styles.submitText}>{saving ? 'Saving…' : 'Save'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: 20, gap: 8, paddingBottom: 32 },
  titleBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '600', color: colors.text },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 16,
    marginBottom: 8,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currencySymbol: { fontSize: 26, color: colors.accent, marginRight: 4, fontWeight: '600' },
  amountInput: { flex: 1, fontSize: 26, color: colors.text, outlineStyle: 'none' as any },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  categoryIcon: { fontSize: 14 },
  categoryLabel: { fontSize: 13, fontWeight: '500', color: colors.text },
  noteInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
  },
  submitBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
    ...glow,
  },
  formError: { color: colors.danger, fontSize: 12, lineHeight: 16, marginTop: 8 },
  disabledButton: { opacity: 0.55 },
  submitText: { color: colors.onAccent, fontSize: 15, fontWeight: '600' },
});
