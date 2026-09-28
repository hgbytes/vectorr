import React, { useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useExpenses } from '../ExpensesContext';
import { CATEGORIES, Category } from '../types';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../categoryStyle';

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
          <Text style={styles.title}>ADD EXPENSE</Text>
          <Text style={styles.windowMark}>[ + ]</Text>
        </View>

        <Text style={styles.label}>AMOUNT</Text>
        <View style={styles.amountRow}>
          <Text style={styles.currencySymbol}>₹</Text>
          <TextInput
            style={styles.amountInput}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#9CA3AF"
            value={amount}
            onChangeText={(value) => setAmount(formatAmount(value))}
          />
        </View>

        <Text style={styles.label}>CATEGORY</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((c) => {
            const selected = c === category;
            return (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: selected
                      ? CATEGORY_COLORS[c]
                      : CATEGORY_COLORS[c] + '18',
                  },
                ]}
              >
                <Text style={styles.categoryIcon}>{CATEGORY_ICONS[c]}</Text>
                <Text
                  style={[
                    styles.categoryLabel,
                    { color: selected ? '#201A33' : '#3D3854' },
                  ]}
                >
                  {c}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>NOTE</Text>
        <TextInput
          style={styles.noteInput}
          placeholder="e.g. coffee"
          placeholderTextColor="#9CA3AF"
          value={note}
          onChangeText={setNote}
        />

        {!!formError && <Text style={styles.formError}>{formError}</Text>}
        <Pressable style={[styles.submitBtn, saving && styles.disabledButton]} onPress={handleSubmit} disabled={saving}>
          <Text style={styles.submitText}>{saving ? '[ SAVING... ]' : '[ SAVE ]'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F6FF' },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: 20, gap: 8, paddingBottom: 32 },
  titleBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  windowCaption: { fontFamily: 'monospace', fontSize: 9, fontWeight: '700', color: '#D6009A', marginBottom: 5 },
  title: { fontFamily: 'monospace', fontSize: 22, fontWeight: '700', color: '#201A33' },
  windowMark: { color: '#008F7D', fontFamily: 'monospace', fontSize: 15 },
  label: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '600',
    color: '#D6009A',
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#B8AEDB',
    borderLeftColor: '#00F5D4',
    borderLeftWidth: 3,
  },
  currencySymbol: { fontFamily: 'monospace', fontSize: 28, color: '#008F7D', marginRight: 4 },
  amountInput: { flex: 1, fontFamily: 'monospace', fontSize: 28, color: '#201A33', outlineStyle: 'none' as any },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#B8AEDB',
  },
  categoryIcon: { fontSize: 14 },
  categoryLabel: { fontFamily: 'monospace', fontSize: 12, fontWeight: '600' },
  noteInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#B8AEDB',
    color: '#201A33',
    fontFamily: 'monospace',
  },
  submitBtn: {
    backgroundColor: '#FF4FD8',
    borderRadius: 0,
    borderWidth: 2,
    borderColor: '#00F5D4',
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  formError: { color: '#C52757', fontFamily: 'monospace', fontSize: 10, lineHeight: 14, marginTop: 8 },
  disabledButton: { opacity: 0.55 },
  submitText: { color: '#201A33', fontFamily: 'monospace', fontSize: 14, fontWeight: '700' },
});
