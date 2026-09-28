import React, { useState } from 'react';
import {
  Alert,
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

  const handleSubmit = async () => {
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount greater than 0.');
      return;
    }
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
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleBar}>
          <View>
            <Text style={styles.windowCaption}>VECTORR / COMPOSE</Text>
            <Text style={styles.title}>NEW LOG ENTRY</Text>
          </View>
          <Text style={styles.windowMark}>[ + ]</Text>
        </View>

        <Text style={styles.label}>AMOUNT / INR</Text>
        <View style={styles.amountRow}>
          <Text style={styles.currencySymbol}>₹</Text>
          <TextInput
            style={styles.amountInput}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#9CA3AF"
            value={amount}
            onChangeText={setAmount}
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

        <Text style={styles.label}>NOTE (OPTIONAL)</Text>
        <TextInput
          style={styles.noteInput}
          placeholder="e.g. coffee.exe"
          placeholderTextColor="#9CA3AF"
          value={note}
          onChangeText={setNote}
        />

        <Pressable style={styles.submitBtn} onPress={handleSubmit}>
          <Text style={styles.submitText}>[ SAVE ENTRY ]</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F6FF' },
  content: { padding: 24, gap: 8 },
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
  submitText: { color: '#201A33', fontFamily: 'monospace', fontSize: 14, fontWeight: '700' },
});
