import React, { useEffect, useMemo, useState } from 'react';
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
import { DEFAULT_FINANCIAL_PROFILE, FinancialProfile } from '../types';

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
  const [dataText, setDataText] = useState('');
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

  const handleExport = () => {
    setDataText(JSON.stringify(profile, null, 2));
    Alert.alert('EXPORT READY', 'JSON READY TO COPY.');
  };

  const handleImport = async () => {
    try {
      const imported = JSON.parse(dataText) as Partial<FinancialProfile>;
      const next = { ...DEFAULT_FINANCIAL_PROFILE, ...imported };
      if (Object.values(next).some((value) => typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
        throw new Error('Invalid numeric value');
      }
      await updateProfile(next);
      setDataText('');
      Alert.alert('IMPORT COMPLETE', 'PROFILE RESTORED.');
    } catch {
      Alert.alert('IMPORT FAILED', 'INVALID JSON.');
    }
  };

  const handleClear = () => {
    Alert.alert('CLEAR PROFILE DATA', 'RESET PROFILE VALUES? EXPENSES & GOALS STAY.', [
      { text: 'CANCEL', style: 'cancel' },
      {
        text: 'CLEAR',
        style: 'destructive',
        onPress: async () => {
          await updateProfile(DEFAULT_FINANCIAL_PROFILE);
          setDataText('');
          Alert.alert('PROFILE CLEARED', 'RESET TO DEFAULTS.');
        },
      },
    ]);
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
          <Text style={styles.title}>PROFILE</Text>
        </View>

        <View style={styles.localPanel}>
          <Text style={styles.localTitle}>LOCAL DATA</Text>
          <Text style={styles.localText}>STORED ON THIS DEVICE</Text>
        </View>

        <View style={styles.authPanel}>
          <View style={styles.authHeader}>
            <Text style={styles.localTitle}>ACCOUNT</Text>
            <Text style={styles.authCode}>{authEnabled ? 'CLOUD READY' : 'LOCAL MODE'}</Text>
          </View>
          {!authEnabled ? (
            <Text style={styles.localText}>
              CLOUD SYNC NOT CONFIGURED.
            </Text>
          ) : authLoading ? (
            <Text style={styles.localText}>CHECKING SESSION...</Text>
          ) : authUser ? (
            <View style={styles.authSignedIn}>
              <View style={styles.authUserBlock}>
                <Text style={styles.authUser}>{authUser.email ?? 'SIGNED-IN USER'}</Text>
                <Text style={syncError ? styles.authError : styles.authSyncStatus}>
                  {syncing ? 'SYNCING...' : syncError ? `SYNC ERROR: ${syncError}` : 'SYNC READY'}
                </Text>
              </View>
              <Pressable style={styles.authButton} onPress={signOut}>
                <Text style={styles.authButtonText}>[ SIGN OUT ]</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.authInput}
                placeholder="email@example.com"
                placeholderTextColor="#9B91B8"
                autoCapitalize="none"
                keyboardType="email-address"
                value={authEmail}
                onChangeText={setAuthEmail}
              />
              <TextInput
                style={styles.authInput}
                placeholder="password"
                placeholderTextColor="#9B91B8"
                secureTextEntry
                value={authPassword}
                onChangeText={setAuthPassword}
              />
              <View style={styles.authButtons}>
                <Pressable style={styles.authButton} onPress={() => handleAuth('signIn')}>
                  <Text style={styles.authButtonText}>[ SIGN IN ]</Text>
                </Pressable>
                <Pressable style={styles.authSecondaryButton} onPress={() => handleAuth('signUp')}>
                  <Text style={styles.authSecondaryText}>[ SIGN UP ]</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

        <View style={styles.statusPanel}>
          <Text style={styles.statusLabel}>AVAILABLE GOAL BUDGET</Text>
          <Text style={styles.statusValue}>{formatCurrency(availableGoalBudget)}</Text>
          <Text style={styles.statusMeta}>
            AFTER EXPENSES, DEBT & EMERGENCY FUND
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
            <Text style={styles.warningTitle}>ATTENTION</Text>
            {warnings.map((warning) => (
              <Text key={warning} style={styles.warningText}>! {warning}</Text>
            ))}
          </View>
        )}

        <Text style={styles.sectionLabel}>INCOME & SAVINGS</Text>
        <ProfileField label="MONTHLY INCOME" placeholder="e.g. 75000" value={values.monthlyIncome} onChangeText={(value) => updateValue('monthlyIncome', value)} />
        <ProfileField label="CURRENT SAVINGS" placeholder="e.g. 150000" value={values.currentSavings} onChangeText={(value) => updateValue('currentSavings', value)} />

        <Text style={styles.sectionLabel}>COMMITMENTS</Text>
        <ProfileField label="MONTHLY DEBT" placeholder="e.g. 12000" value={values.monthlyDebtPayments} onChangeText={(value) => updateValue('monthlyDebtPayments', value)} />
        <ProfileField label="EMERGENCY FUND TARGET" placeholder="e.g. 300000" value={values.emergencyFundTarget} onChangeText={(value) => updateValue('emergencyFundTarget', value)} />
        <ProfileField label="PLANNED GOAL BUDGET" placeholder="e.g. 20000" value={values.goalContributionBudget} onChangeText={(value) => updateValue('goalContributionBudget', value)} />
        <ProfileField label="ACTUAL CONTRIBUTIONS" placeholder="e.g. 15000" value={values.actualMonthlyGoalContributions} onChangeText={(value) => updateValue('actualMonthlyGoalContributions', value)} />

        <Text style={styles.sectionLabel}>ASSUMPTIONS</Text>
        <ProfileField label="INFLATION RATE" placeholder="e.g. 6" value={values.inflationRate} onChangeText={(value) => updateValue('inflationRate', value)} unit="%" />
        <ProfileField label="EXPECTED RETURN" placeholder="e.g. 10" value={values.expectedAnnualReturn} onChangeText={(value) => updateValue('expectedAnnualReturn', value)} unit="%" />
        <ProfileField label="INCOME GROWTH" placeholder="e.g. 5" value={values.incomeGrowthRate} onChangeText={(value) => updateValue('incomeGrowthRate', value)} unit="%" />
        <ProfileField label="EXPENSE GROWTH" placeholder="e.g. 6" value={values.expenseGrowthRate} onChangeText={(value) => updateValue('expenseGrowthRate', value)} unit="%" />

        {!!formError && <Text style={styles.formError}>{formError}</Text>}
        <Pressable style={[styles.saveButton, savingProfile && styles.disabledButton]} onPress={handleSave} disabled={savingProfile}>
          <Text style={styles.saveText}>{savingProfile ? '[ SAVING... ]' : '[ SAVE ]'}</Text>
        </Pressable>

        <View style={styles.reviewPanel}>
          <Text style={styles.reviewTitle}>THIS MONTH</Text>
          <ReviewRow label="INCOME" value={formatCurrency(profile.monthlyIncome)} />
          <ReviewRow label="EXPENSES" value={formatCurrency(monthlyExpenses)} />
          <ReviewRow label="SURPLUS" value={formatCurrency(monthlySurplus)} />
          <ReviewRow label="GOAL BUDGET" value={formatCurrency(profile.goalContributionBudget)} />
          <ReviewRow label="GOAL CONTRIBUTIONS" value={formatCurrency(profile.actualMonthlyGoalContributions)} />
          <ReviewRow label="PLAN VS ACTUAL" value={`${contributionDelta >= 0 ? '+' : ''}${formatCurrency(contributionDelta)}`} />
          <ReviewRow label="AVAILABLE VS PLAN" value={`${budgetDelta >= 0 ? '+' : ''}${formatCurrency(budgetDelta)}`} />
        </View>

        <View style={styles.dataPanel}>
          <Text style={styles.reviewTitle}>DATA</Text>
          <TextInput
            style={styles.dataInput}
            multiline
            value={dataText}
            onChangeText={setDataText}
            placeholder="Exported JSON appears here"
            placeholderTextColor="#9B91B8"
          />
          <View style={styles.dataButtons}>
            <Pressable style={styles.smallButton} onPress={handleExport}>
              <Text style={styles.smallButtonText}>[ EXPORT ]</Text>
            </Pressable>
            <Pressable style={styles.smallButton} onPress={handleImport}>
              <Text style={styles.smallButtonText}>[ IMPORT ]</Text>
            </Pressable>
            <Pressable style={styles.clearButton} onPress={handleClear}>
              <Text style={styles.clearButtonText}>[ CLEAR ]</Text>
            </Pressable>
          </View>
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
      <Metric label="SAVINGS RATE" value={`${Math.round(savingsRate)}%`} />
      <Metric label="DEBT / INCOME" value={`${Math.round(debtRatio)}%`} />
      <Metric label="EMERGENCY COVER" value={`${emergencyCoverage.toFixed(1)} MO`} />
      <Metric label="AVAILABLE BUDGET" value={formatCurrency(availableGoalBudget)} />
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
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: 20, gap: 8, paddingBottom: 36 },
  titleBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  windowCaption: { fontFamily: 'monospace', fontSize: 9, fontWeight: '700', color: '#D6009A', marginBottom: 5 },
  title: { fontFamily: 'monospace', fontSize: 21, fontWeight: '700', color: '#201A33' },
  windowMark: { color: '#008F7D', fontFamily: 'monospace', fontSize: 11, fontWeight: '700' },
  localPanel: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B8AEDB', padding: 12 },
  localTitle: { color: '#008F7D', fontFamily: 'monospace', fontSize: 10, fontWeight: '700' },
  localText: { color: '#6B6680', fontFamily: 'monospace', fontSize: 9, marginTop: 4 },
  authPanel: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B8AEDB', padding: 12, gap: 7 },
  authHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  authCode: { color: '#008F7D', fontFamily: 'monospace', fontSize: 8, fontWeight: '700' },
  authInput: { minHeight: 44, borderWidth: 1, borderColor: '#B8AEDB', borderLeftWidth: 3, borderLeftColor: '#00F5D4', color: '#201A33', fontFamily: 'monospace', fontSize: 13, paddingHorizontal: 10 },
  authButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 2 },
  authButton: { backgroundColor: '#FF4FD8', borderWidth: 1, borderColor: '#00F5D4', paddingHorizontal: 10, paddingVertical: 9 },
  authButtonText: { color: '#201A33', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
  authSecondaryButton: { backgroundColor: '#E9E2FF', borderWidth: 1, borderColor: '#5B2DB8', paddingHorizontal: 10, paddingVertical: 9 },
  authSecondaryText: { color: '#5B2DB8', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
  authSignedIn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  authUser: { flex: 1, color: '#201A33', fontFamily: 'monospace', fontSize: 11 },
  authUserBlock: { flex: 1, gap: 3 },
  authSyncStatus: { color: '#008F7D', fontFamily: 'monospace', fontSize: 8 },
  authError: { color: '#C52757', fontFamily: 'monospace', fontSize: 8 },
  statusPanel: { backgroundColor: '#E9E2FF', borderWidth: 1, borderColor: '#B8AEDB', borderLeftWidth: 4, borderLeftColor: '#00F5D4', padding: 14, marginTop: 4 },
  statusLabel: { fontFamily: 'monospace', fontSize: 10, fontWeight: '700', color: '#5D557A' },
  statusValue: { fontFamily: 'monospace', fontSize: 26, fontWeight: '700', color: '#5B2DB8', marginTop: 5 },
  statusMeta: { fontFamily: 'monospace', fontSize: 9, color: '#D6009A', marginTop: 4 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  metric: { flexGrow: 1, flexBasis: '45%', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B8AEDB', padding: 10, minWidth: 135 },
  metricLabel: { color: '#6B6680', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
  metricValue: { color: '#5B2DB8', fontFamily: 'monospace', fontSize: 16, fontWeight: '700', marginTop: 5 },
  warningPanel: { backgroundColor: '#FFE7EF', borderWidth: 1, borderColor: '#C52757', borderLeftWidth: 4, padding: 12, marginTop: 4, gap: 4 },
  warningTitle: { color: '#C52757', fontFamily: 'monospace', fontSize: 10, fontWeight: '700' },
  warningText: { color: '#7F2140', fontFamily: 'monospace', fontSize: 9 },
  sectionLabel: { fontFamily: 'monospace', fontSize: 11, fontWeight: '700', color: '#D6009A', marginTop: 10, marginBottom: 2 },
  field: { gap: 5 },
  fieldLabel: { fontFamily: 'monospace', fontSize: 10, fontWeight: '700', color: '#6B6680' },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B8AEDB', borderLeftWidth: 3, borderLeftColor: '#00F5D4', paddingHorizontal: 12, minHeight: 48 },
  currencySymbol: { color: '#008F7D', fontFamily: 'monospace', fontSize: 18, fontWeight: '700', marginRight: 6 },
  input: { flex: 1, color: '#201A33', fontFamily: 'monospace', fontSize: 15, outlineStyle: 'none' as any },
  saveButton: { backgroundColor: '#FF4FD8', borderWidth: 2, borderColor: '#00F5D4', paddingVertical: 15, alignItems: 'center', marginTop: 18 },
  formError: { color: '#C52757', fontFamily: 'monospace', fontSize: 9, lineHeight: 13, marginTop: 5 },
  disabledButton: { opacity: 0.55 },
  saveText: { color: '#201A33', fontFamily: 'monospace', fontSize: 13, fontWeight: '700' },
  reviewPanel: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B8AEDB', padding: 14, marginTop: 10, gap: 9 },
  reviewTitle: { fontFamily: 'monospace', fontSize: 10, fontWeight: '700', color: '#5B2DB8', marginBottom: 2 },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  reviewLabel: { color: '#6B6680', fontFamily: 'monospace', fontSize: 9 },
  reviewValue: { color: '#A45A00', fontFamily: 'monospace', fontSize: 10, fontWeight: '700' },
  dataPanel: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B8AEDB', padding: 14, marginTop: 2 },
  dataInput: { minHeight: 100, borderWidth: 1, borderColor: '#B8AEDB', color: '#201A33', fontFamily: 'monospace', fontSize: 11, padding: 10, textAlignVertical: 'top' },
  dataButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 9 },
  smallButton: { backgroundColor: '#E9E2FF', borderWidth: 1, borderColor: '#5B2DB8', paddingHorizontal: 10, paddingVertical: 9 },
  smallButtonText: { color: '#5B2DB8', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
  clearButton: { backgroundColor: '#FFE7EF', borderWidth: 1, borderColor: '#C52757', paddingHorizontal: 10, paddingVertical: 9 },
  clearButtonText: { color: '#C52757', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
});
