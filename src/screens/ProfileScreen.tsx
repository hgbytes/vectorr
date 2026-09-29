import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useExpenses } from '../ExpensesContext';
import { FinancialProfile } from '../types';
import { colors, glow, radius } from '../theme';
import Text from '../components/Text';

function formatCurrency(amount: number) {
  return `₹${amount.toFixed(2)}`;
}

function profileToStrings(profile: FinancialProfile) {
  return Object.fromEntries(
    Object.entries(profile).map(([key, value]) => [key, value ? String(value) : ''])
  ) as Record<keyof FinancialProfile, string>;
}

function getMonthExpenses(expenses: { amount: number; date: string }[]) {
  const now = new Date();
  return expenses.filter((expense) => {
    const date = new Date(expense.date);
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  });
}

export default function ProfileScreen() {
  const {
    profile,
    expenses,
    updateProfile,
    authUser,
    authLoading,
    authEnabled,
    signIn,
    signUp,
    signOut,
    syncing,
    syncError,
  } = useExpenses();
  const [values, setValues] = useState(() => profileToStrings(profile));
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    setValues(profileToStrings(profile));
  }, [profile]);

  const monthExpenses = useMemo(() => getMonthExpenses(expenses), [expenses]);
  const monthlyExpenses = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const monthlySurplus = profile.monthlyIncome - monthlyExpenses - profile.monthlyDebtPayments;
  const emergencyGap = Math.max(profile.emergencyFundTarget - profile.currentSavings, 0);
  const emergencyContribution = emergencyGap / 12;
  const availableGoalBudget = Math.max(monthlySurplus - emergencyContribution, 0);
  const savingsRate = profile.monthlyIncome > 0
    ? Math.max(monthlySurplus, 0) / profile.monthlyIncome * 100
    : 0;
  const debtRatio = profile.monthlyIncome > 0
    ? profile.monthlyDebtPayments / profile.monthlyIncome * 100
    : 0;
  const emergencyCoverage = monthlyExpenses > 0
    ? profile.currentSavings / monthlyExpenses
    : 0;
  const budgetDelta = availableGoalBudget - profile.goalContributionBudget;
  const contributionDelta = profile.actualMonthlyGoalContributions - profile.goalContributionBudget;
  const warnings = useMemo(() => {
    const next: string[] = [];
    if (profile.goalContributionBudget > availableGoalBudget && profile.goalContributionBudget > 0) {
      next.push('GOAL BUDGET EXCEEDS AVAILABLE.');
    }
    if (debtRatio > 36) next.push('DEBT ABOVE 36% OF INCOME.');
    if (profile.emergencyFundTarget > profile.currentSavings) {
      next.push('EMERGENCY FUND BELOW TARGET.');
    }
    if (monthlySurplus < 0) next.push('MONTHLY CASH FLOW IS NEGATIVE.');
    return next;
  }, [availableGoalBudget, debtRatio, monthlySurplus, profile]);

  const updateValue = (key: keyof FinancialProfile, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const parseValue = (value: string) =>
    value.trim() === '' ? 0 : Number.parseFloat(value);

  const handleSave = async () => {
    setFormError('');
    const parsed: FinancialProfile = {
      monthlyIncome: parseValue(values.monthlyIncome),
      currentSavings: parseValue(values.currentSavings),
      monthlyDebtPayments: parseValue(values.monthlyDebtPayments),
      emergencyFundTarget: parseValue(values.emergencyFundTarget),
      goalContributionBudget: parseValue(values.goalContributionBudget),
      actualMonthlyGoalContributions: parseValue(values.actualMonthlyGoalContributions),
      inflationRate: parseValue(values.inflationRate),
      expectedAnnualReturn: parseValue(values.expectedAnnualReturn),
      incomeGrowthRate: parseValue(values.incomeGrowthRate),
      expenseGrowthRate: parseValue(values.expenseGrowthRate),
    };
    if (Object.values(parsed).some((value) => !Number.isFinite(value) || value < 0)) {
      setFormError('Enter zero or a positive number in every field.');
      return;
    }
    setSavingProfile(true);
    try {
      await updateProfile(parsed);
      Alert.alert('PROFILE SAVED', 'PROFILE UPDATED.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAuth = async (mode: 'signIn' | 'signUp') => {
    try {
      if (!authEmail.trim() || authPassword.length < 6) {
        Alert.alert('INVALID DETAILS', 'EMAIL + 6-CHAR PASSWORD REQUIRED.');
        return;
      }
      if (mode === 'signIn') {
        await signIn(authEmail.trim(), authPassword);
        Alert.alert('SIGNED IN', 'SESSION ACTIVE.');
      } else {
        await signUp(authEmail.trim(), authPassword);
        Alert.alert('SIGN-UP COMPLETE', 'CHECK EMAIL TO CONFIRM.');
      }
      setAuthPassword('');
    } catch (error) {
      Alert.alert('AUTH ERROR', error instanceof Error ? error.message : 'AUTHENTICATION FAILED.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.titleBar}>
          <Text style={styles.title}>Profile</Text>
        </View>

        <View style={styles.authPanel}>
          <View style={styles.authHeader}>
            <Text style={styles.localTitle}>Account</Text>
            <Text style={styles.authCode}>{authEnabled ? 'Cloud sync' : 'Local mode'}</Text>
          </View>
          {!authEnabled ? (
            <Text style={styles.localText}>
              Cloud sync is not configured.
            </Text>
          ) : authLoading ? (
            <Text style={styles.localText}>Checking session…</Text>
          ) : authUser ? (
            <View style={styles.authSignedIn}>
              <View style={styles.authUserBlock}>
                <Text style={styles.authUser}>{authUser.email ?? 'Signed-in user'}</Text>
                <Text style={syncError ? styles.authError : styles.authSyncStatus}>
                  {syncing ? 'Syncing…' : syncError ? `Sync error: ${syncError}` : 'Sync ready'}
                </Text>
              </View>
              <Pressable style={styles.authButton} onPress={signOut}>
                <Text style={styles.authButtonText}>Sign out</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.authInput}
                placeholder="email@example.com"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="none"
                keyboardType="email-address"
                value={authEmail}
                onChangeText={setAuthEmail}
              />
              <TextInput
                style={styles.authInput}
                placeholder="password"
                placeholderTextColor={colors.textFaint}
                secureTextEntry
                value={authPassword}
                onChangeText={setAuthPassword}
              />
              <View style={styles.authButtons}>
                <Pressable style={styles.authButton} onPress={() => handleAuth('signIn')}>
                  <Text style={styles.authButtonText}>Sign in</Text>
                </Pressable>
                <Pressable style={styles.authSecondaryButton} onPress={() => handleAuth('signUp')}>
                  <Text style={styles.authSecondaryText}>Sign up</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

        <View style={styles.statusPanel}>
          <Text style={styles.statusLabel}>Available goal budget</Text>
          <Text style={styles.statusValue}>{formatCurrency(availableGoalBudget)}</Text>
          <Text style={styles.statusMeta}>
            After expenses, debt & emergency fund
          </Text>
        </View>

        <MetricGrid
          savingsRate={savingsRate}
          debtRatio={debtRatio}
          emergencyCoverage={emergencyCoverage}
          availableGoalBudget={availableGoalBudget}
        />

        {warnings.length > 0 && (
          <View style={styles.warningPanel}>
            <Text style={styles.warningTitle}>Attention</Text>
            {warnings.map((warning) => (
              <Text key={warning} style={styles.warningText}>{warning}</Text>
            ))}
          </View>
        )}

        <Text style={styles.sectionLabel}>Income & savings</Text>
        <ProfileField label="Monthly income" placeholder="e.g. 75000" value={values.monthlyIncome} onChangeText={(value) => updateValue('monthlyIncome', value)} />
        <ProfileField label="Current savings" placeholder="e.g. 150000" value={values.currentSavings} onChangeText={(value) => updateValue('currentSavings', value)} />

        <Text style={styles.sectionLabel}>Commitments</Text>
        <ProfileField label="Monthly debt" placeholder="e.g. 12000" value={values.monthlyDebtPayments} onChangeText={(value) => updateValue('monthlyDebtPayments', value)} />
        <ProfileField label="Emergency fund target" placeholder="e.g. 300000" value={values.emergencyFundTarget} onChangeText={(value) => updateValue('emergencyFundTarget', value)} />
        <ProfileField label="Planned goal budget" placeholder="e.g. 20000" value={values.goalContributionBudget} onChangeText={(value) => updateValue('goalContributionBudget', value)} />
        <ProfileField label="Actual contributions" placeholder="e.g. 15000" value={values.actualMonthlyGoalContributions} onChangeText={(value) => updateValue('actualMonthlyGoalContributions', value)} />

        <Text style={styles.sectionLabel}>Assumptions</Text>
        <ProfileField label="Inflation rate" placeholder="e.g. 6" value={values.inflationRate} onChangeText={(value) => updateValue('inflationRate', value)} unit="%" />
        <ProfileField label="Expected return" placeholder="e.g. 10" value={values.expectedAnnualReturn} onChangeText={(value) => updateValue('expectedAnnualReturn', value)} unit="%" />
        <ProfileField label="Income growth" placeholder="e.g. 5" value={values.incomeGrowthRate} onChangeText={(value) => updateValue('incomeGrowthRate', value)} unit="%" />
        <ProfileField label="Expense growth" placeholder="e.g. 6" value={values.expenseGrowthRate} onChangeText={(value) => updateValue('expenseGrowthRate', value)} unit="%" />

        {!!formError && <Text style={styles.formError}>{formError}</Text>}
        <Pressable style={[styles.saveButton, savingProfile && styles.disabledButton]} onPress={handleSave} disabled={savingProfile}>
          <Text style={styles.saveText}>{savingProfile ? 'Saving…' : 'Save'}</Text>
        </Pressable>

        <View style={styles.reviewPanel}>
          <Text style={styles.reviewTitle}>This month</Text>
          <ReviewRow label="Income" value={formatCurrency(profile.monthlyIncome)} />
          <ReviewRow label="Expenses" value={formatCurrency(monthlyExpenses)} />
          <ReviewRow label="Surplus" value={formatCurrency(monthlySurplus)} />
          <ReviewRow label="Goal budget" value={formatCurrency(profile.goalContributionBudget)} />
          <ReviewRow label="Goal contributions" value={formatCurrency(profile.actualMonthlyGoalContributions)} />
          <ReviewRow label="Plan vs actual" value={`${contributionDelta >= 0 ? '+' : ''}${formatCurrency(contributionDelta)}`} />
          <ReviewRow label="Available vs plan" value={`${budgetDelta >= 0 ? '+' : ''}${formatCurrency(budgetDelta)}`} />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function MetricGrid({
  savingsRate,
  debtRatio,
  emergencyCoverage,
  availableGoalBudget,
}: {
  savingsRate: number;
  debtRatio: number;
  emergencyCoverage: number;
  availableGoalBudget: number;
}) {
  return (
    <View style={styles.metricGrid}>
      <Metric label="Savings rate" value={`${Math.round(savingsRate)}%`} />
      <Metric label="Debt / income" value={`${Math.round(debtRatio)}%`} />
      <Metric label="Emergency cover" value={`${emergencyCoverage.toFixed(1)} mo`} />
      <Metric label="Available budget" value={formatCurrency(availableGoalBudget)} />
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
  );
}

function ProfileField({
  label,
  placeholder,
  value,
  onChangeText,
  unit = '₹',
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  unit?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputRow}>
        <Text style={styles.currencySymbol}>{unit}</Text>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          placeholder={placeholder}
          placeholderTextColor={colors.textFaint}
          value={value}
          onChangeText={onChangeText}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: 20, gap: 8, paddingBottom: 36 },
  titleBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '600', color: colors.text },
  localTitle: { color: colors.text, fontSize: 13, fontWeight: '600' },
  localText: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  authPanel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 14, gap: 8 },
  authHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  authCode: { color: colors.textMuted, fontSize: 11, fontWeight: '500' },
  authInput: { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.text, fontSize: 14, paddingHorizontal: 12 },
  authButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  authButton: { backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  authButtonText: { color: colors.onAccent, fontSize: 12, fontWeight: '600' },
  authSecondaryButton: { backgroundColor: colors.accentSoft, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  authSecondaryText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  authSignedIn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  authUser: { flex: 1, color: colors.text, fontSize: 13 },
  authUserBlock: { flex: 1, gap: 3 },
  authSyncStatus: { color: colors.positive, fontSize: 11 },
  authError: { color: colors.danger, fontSize: 11 },
  statusPanel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 16, marginTop: 6 },
  statusLabel: { fontSize: 12, fontWeight: '500', color: colors.textMuted },
  statusValue: { fontSize: 28, fontWeight: '700', color: colors.accent, marginTop: 6 },
  statusMeta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  metric: { flexGrow: 1, flexBasis: '45%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, minWidth: 135 },
  metricLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '500' },
  metricValue: { color: colors.text, fontSize: 17, fontWeight: '600', marginTop: 6 },
  warningPanel: { backgroundColor: colors.warningSoft, borderRadius: radius.md, padding: 12, marginTop: 4, gap: 4 },
  warningTitle: { color: colors.warning, fontSize: 12, fontWeight: '600' },
  warningText: { color: colors.text, fontSize: 12 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 12, marginBottom: 2 },
  field: { gap: 5 },
  fieldLabel: { fontSize: 12, fontWeight: '500', color: colors.textMuted },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, minHeight: 48 },
  currencySymbol: { color: colors.accent, fontSize: 16, fontWeight: '600', marginRight: 6 },
  input: { flex: 1, color: colors.text, fontSize: 15, outlineStyle: 'none' as any },
  saveButton: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center', marginTop: 18, ...glow },
  formError: { color: colors.danger, fontSize: 12, lineHeight: 16, marginTop: 5 },
  disabledButton: { opacity: 0.55 },
  saveText: { color: colors.onAccent, fontSize: 14, fontWeight: '600' },
  reviewPanel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 16, marginTop: 10, gap: 10 },
  reviewTitle: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 2 },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  reviewLabel: { color: colors.textMuted, fontSize: 12 },
  reviewValue: { color: colors.text, fontSize: 13, fontWeight: '600' },
});
