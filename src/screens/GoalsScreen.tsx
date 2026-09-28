import React, { useMemo, useState } from 'react';
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
import { useExpenses } from '../ExpensesContext';
import { FinancialGoal, GoalPriority } from '../types';

const PRIORITIES: GoalPriority[] = ['Essential', 'Important', 'Optional'];

function formatCurrency(amount: number) {
  return `₹${amount.toFixed(2)}`;
}

function monthsUntil(targetDate: string) {
  const deadline = new Date(`${targetDate}T00:00:00`).getTime();
  return Math.max(1, Math.ceil((deadline - Date.now()) / (1000 * 60 * 60 * 24 * 30)));
}

function goalStatus(goal: FinancialGoal, monthlyBudget: number) {
  if (goal.currentAmount >= goal.targetAmount) return 'COMPLETE';
  const remaining = goal.targetAmount - goal.currentAmount;
  const required = remaining / monthsUntil(goal.targetDate);
  if (monthlyBudget > 0 && required > monthlyBudget) return 'AT RISK';
  if (monthlyBudget === 0) return 'SET BUDGET';
  return 'ON TRACK';
}

export default function GoalsScreen() {
  const { goals, profile, expenses, addGoal, deleteGoal } = useExpenses();
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [priority, setPriority] = useState<GoalPriority>('Important');
  const availableGoalBudget = useMemo(() => {
    const now = new Date();
    const monthlyExpenses = expenses
      .filter((expense) => {
        const date = new Date(expense.date);
        return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
      })
      .reduce((sum, expense) => sum + expense.amount, 0);
    const emergencyContribution = Math.max(
      profile.emergencyFundTarget - profile.currentSavings,
      0
    ) / 12;
    return Math.max(
      profile.monthlyIncome - monthlyExpenses - profile.monthlyDebtPayments - emergencyContribution,
      0
    );
  }, [expenses, profile]);

  const handleAdd = async () => {
    const target = targetAmount.trim() === '' ? 0 : Number.parseFloat(targetAmount);
    const current = currentAmount.trim() === '' ? 0 : Number.parseFloat(currentAmount);
    const deadline = new Date(`${targetDate}T00:00:00`);

    if (!name.trim() || !Number.isFinite(target) || target <= 0) {
      Alert.alert('INVALID GOAL', 'ADD A NAME AND A TARGET ABOVE ZERO.');
      return;
    }
    if (!Number.isFinite(current) || current < 0 || current > target) {
      Alert.alert('INVALID SAVINGS', 'CURRENT SAVINGS MUST BE BETWEEN ZERO AND THE TARGET.');
      return;
    }
    if (!targetDate || Number.isNaN(deadline.getTime())) {
      Alert.alert('INVALID DATE', 'USE YYYY-MM-DD FOR THE TARGET DATE.');
      return;
    }

    await addGoal({
      name: name.trim(),
      targetAmount: target,
      currentAmount: current,
      targetDate,
      priority,
    });
    setName('');
    setTargetAmount('');
    setCurrentAmount('');
    setTargetDate('');
    setPriority('Important');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.titleBar}>
          <View>
            <Text style={styles.windowCaption}>VECTORR / PLANNER</Text>
            <Text style={styles.title}>FINANCIAL GOALS</Text>
          </View>
          <Text style={styles.windowMark}>[ GOALS ]</Text>
        </View>

        <View style={styles.budgetPanel}>
          <Text style={styles.panelLabel}>AVAILABLE MONTHLY GOAL BUDGET</Text>
          <Text style={styles.panelValue}>
            {formatCurrency(availableGoalBudget)}
          </Text>
          <Text style={styles.panelMeta}>
            {goals.length} ACTIVE GOAL{goals.length === 1 ? '' : 'S'} // LOCAL PLAN
          </Text>
        </View>

        <View style={styles.formPanel}>
          <Text style={styles.sectionLabel}>NEW GOAL RECORD</Text>
          <GoalField
            label="GOAL NAME"
            placeholder="e.g. emergency fund"
            value={name}
            onChangeText={setName}
            textInput
          />
          <GoalField
            label="TARGET AMOUNT / INR"
            placeholder="e.g. 300000"
            value={targetAmount}
            onChangeText={setTargetAmount}
          />
          <GoalField
            label="CURRENT SAVINGS / INR"
            placeholder="e.g. 50000"
            value={currentAmount}
            onChangeText={setCurrentAmount}
          />
          <GoalField
            label="TARGET DATE / YYYY-MM-DD"
            placeholder="e.g. 2027-12-31"
            value={targetDate}
            onChangeText={setTargetDate}
            textInput
          />
          <Text style={styles.fieldLabel}>PRIORITY</Text>
          <View style={styles.priorityRow}>
            {PRIORITIES.map((option) => (
              <Pressable
                key={option}
                onPress={() => setPriority(option)}
                style={[
                  styles.priorityChip,
                  option === priority && styles.priorityChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.priorityText,
                    option === priority && styles.priorityTextSelected,
                  ]}
                >
                  {option.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.addButton} onPress={handleAdd}>
            <Text style={styles.addText}>[ ADD GOAL ]</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>GOAL REGISTER</Text>
        {goals.length === 0 ? (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyMark}>[ ? ]</Text>
            <Text style={styles.emptyText}>NO GOALS REGISTERED</Text>
            <Text style={styles.emptySubtext}>
              ADD A GOAL TO START TESTING YOUR PLAN.
            </Text>
          </View>
        ) : (
          goals.map((goal) => {
            const progress = Math.min(
              100,
              Math.max(0, (goal.currentAmount / goal.targetAmount) * 100)
            );
            const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0);
            const required = remaining / monthsUntil(goal.targetDate);
            const status = goalStatus(goal, availableGoalBudget);
            return (
              <View key={goal.id} style={styles.goalCard}>
                <View style={styles.goalHeader}>
                  <View style={styles.goalNameWrap}>
                    <Text style={styles.goalName} numberOfLines={1}>
                      {goal.name}
                    </Text>
                    <Text style={styles.goalMeta}>
                      {goal.priority.toUpperCase()} // DUE {goal.targetDate}
                    </Text>
                  </View>
                  <Text style={[styles.goalStatus, status === 'AT RISK' && styles.riskStatus]}>
                    {status}
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progress}%` }]} />
                </View>
                <View style={styles.goalStats}>
                  <Text style={styles.goalStat}>{formatCurrency(goal.currentAmount)} SAVED</Text>
                  <Text style={styles.goalStat}>{Math.round(progress)}%</Text>
                  <Text style={styles.goalStat}>{formatCurrency(required)}/MO</Text>
                </View>
                <Pressable onPress={() => deleteGoal(goal.id)} style={styles.deleteButton}>
                  <Text style={styles.deleteText}>[ DELETE RECORD ]</Text>
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function GoalField({
  label,
  placeholder,
  value,
  onChangeText,
  textInput = false,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  textInput?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputRow}>
        {!textInput && <Text style={styles.currencySymbol}>₹</Text>}
        <TextInput
          style={styles.input}
          keyboardType={textInput ? 'default' : 'decimal-pad'}
          placeholder={placeholder}
          placeholderTextColor="#9B91B8"
          value={value}
          onChangeText={onChangeText}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F6FF' },
  content: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    padding: 20,
    gap: 8,
    paddingBottom: 36,
  },
  titleBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  windowCaption: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    color: '#D6009A',
    marginBottom: 5,
  },
  title: { fontFamily: 'monospace', fontSize: 21, fontWeight: '700', color: '#201A33' },
  windowMark: { color: '#008F7D', fontFamily: 'monospace', fontSize: 11, fontWeight: '700' },
  budgetPanel: {
    backgroundColor: '#E9E2FF',
    borderWidth: 1,
    borderColor: '#B8AEDB',
    borderLeftWidth: 4,
    borderLeftColor: '#00F5D4',
    padding: 14,
    marginBottom: 12,
  },
  panelLabel: { fontFamily: 'monospace', fontSize: 10, fontWeight: '700', color: '#5D557A' },
  panelValue: { fontFamily: 'monospace', fontSize: 25, fontWeight: '700', color: '#5B2DB8', marginTop: 5 },
  panelMeta: { fontFamily: 'monospace', fontSize: 10, color: '#D6009A', marginTop: 4 },
  formPanel: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B8AEDB', padding: 14, gap: 8 },
  sectionLabel: { fontFamily: 'monospace', fontSize: 11, fontWeight: '700', color: '#D6009A', marginTop: 10, marginBottom: 2 },
  field: { gap: 5 },
  fieldLabel: { fontFamily: 'monospace', fontSize: 10, fontWeight: '700', color: '#6B6680' },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B8AEDB', borderLeftWidth: 3, borderLeftColor: '#00F5D4', paddingHorizontal: 12, minHeight: 46 },
  currencySymbol: { color: '#008F7D', fontFamily: 'monospace', fontSize: 18, fontWeight: '700', marginRight: 6 },
  input: { flex: 1, color: '#201A33', fontFamily: 'monospace', fontSize: 15, outlineStyle: 'none' as any },
  priorityRow: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  priorityChip: { borderWidth: 1, borderColor: '#B8AEDB', paddingHorizontal: 10, paddingVertical: 8 },
  priorityChipSelected: { backgroundColor: '#FF4FD8', borderColor: '#00F5D4' },
  priorityText: { color: '#3D3854', fontFamily: 'monospace', fontSize: 10, fontWeight: '700' },
  priorityTextSelected: { color: '#201A33' },
  addButton: { backgroundColor: '#FF4FD8', borderWidth: 2, borderColor: '#00F5D4', paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  addText: { color: '#201A33', fontFamily: 'monospace', fontSize: 13, fontWeight: '700' },
  emptyPanel: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B8AEDB', padding: 22, alignItems: 'center', gap: 6 },
  emptyMark: { color: '#D6009A', fontFamily: 'monospace', fontSize: 20 },
  emptyText: { color: '#201A33', fontFamily: 'monospace', fontSize: 13, fontWeight: '700' },
  emptySubtext: { color: '#6B6680', fontFamily: 'monospace', fontSize: 10, textAlign: 'center' },
  goalCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B8AEDB', padding: 14, marginBottom: 8, gap: 9 },
  goalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  goalNameWrap: { flex: 1 },
  goalName: { color: '#201A33', fontFamily: 'monospace', fontSize: 14, fontWeight: '700' },
  goalMeta: { color: '#6B6680', fontFamily: 'monospace', fontSize: 9, marginTop: 4 },
  goalStatus: { color: '#008F7D', fontFamily: 'monospace', fontSize: 10, fontWeight: '700' },
  riskStatus: { color: '#C52757' },
  progressTrack: { height: 11, backgroundColor: '#F0ECFA', borderWidth: 1, borderColor: '#B8AEDB', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#00C7AD' },
  goalStats: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  goalStat: { color: '#A45A00', fontFamily: 'monospace', fontSize: 10, fontWeight: '700' },
  deleteButton: { alignSelf: 'flex-start', paddingVertical: 2 },
  deleteText: { color: '#C52757', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
});
