import React, { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useExpenses } from '../ExpensesContext';
import {
  FinancialGoal,
  FinancialProfile,
  GOAL_CATEGORIES,
  GoalCategory,
  GoalDeadlineType,
  GoalPriority,
  GoalScenario,
  ProgressSnapshot,
} from '../types';

const PRIORITIES: GoalPriority[] = ['Essential', 'Important', 'Optional'];

function formatCurrency(amount: number) {
  return `₹${amount.toFixed(2)}`;
}

function formatGoalDate(date: Date) {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function toDateValue(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function monthsUntil(targetDate: string) {
  const deadline = new Date(`${targetDate}T00:00:00`).getTime();
  return Math.max(1, Math.ceil((deadline - Date.now()) / (1000 * 60 * 60 * 24 * 30)));
}

function addMonths(months: number) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date;
}

function formatProjectionDate(date: Date | null) {
  if (!date) return 'NO RATE';
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }).toUpperCase();
}

function projectedValue(
  startingAmount: number,
  monthlyContribution: number,
  months: number,
  annualReturn: number
) {
  const monthlyRate = annualReturn / 100 / 12;
  if (monthlyRate === 0) return startingAmount + monthlyContribution * months;
  const growth = Math.pow(1 + monthlyRate, months);
  return startingAmount * growth + monthlyContribution * ((growth - 1) / monthlyRate);
}

function projectGoal(
  goal: FinancialGoal,
  monthlyContribution: number,
  annualReturn: number,
  startingAmount = goal.currentAmount
) {
  const monthsToTarget = monthsUntil(goal.targetDate);
  const remaining = Math.max(goal.targetAmount - startingAmount, 0);
  const deadlineContribution = remaining / monthsToTarget;
  const requiredMonthly = goal.deadlineType === 'Fixed'
    ? Math.max(deadlineContribution, goal.minimumMonthlyContribution)
    : goal.minimumMonthlyContribution;
  const completionMonths =
    remaining === 0
      ? 0
      : monthlyContribution > 0
        ? Math.ceil(remaining / monthlyContribution)
        : null;
  const projected = projectedValue(
    startingAmount,
    monthlyContribution,
    monthsToTarget,
    annualReturn
  );
  return {
    monthsToTarget,
    requiredMonthly,
    completionDate: completionMonths === null ? null : addMonths(completionMonths),
    projected,
    surplus: projected - goal.targetAmount,
  };
}

function goalStatus(goal: FinancialGoal, monthlyContribution: number) {
  if (goal.currentAmount >= goal.targetAmount) return 'COMPLETE';
  const required = projectGoal(goal, monthlyContribution, 0).requiredMonthly;
  if (monthlyContribution > 0 && required > monthlyContribution) return 'AT RISK';
  if (monthlyContribution === 0) return 'SET BUDGET';
  return 'ON TRACK';
}

interface GoalConflict {
  title: string;
  detail: string;
  goals: string[];
}

interface GoalRecommendation {
  title: string;
  detail: string;
  actionLabel?: string;
  onAction?: () => Promise<void>;
}

function shiftGoalDate(targetDate: string, months: number) {
  const date = new Date(`${targetDate}T00:00:00`);
  date.setMonth(date.getMonth() + months);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

type ScenarioKey =
  | 'essentials'
  | 'deadline'
  | 'growth'
  | 'balanced'
  | 'user';

const SCENARIO_OPTIONS: {
  key: ScenarioKey;
  label: string;
  note: string;
}[] = [
  { key: 'essentials', label: 'ESSENTIALS FIRST', note: 'Essentials, then important, then optional.' },
  { key: 'deadline', label: 'EARLIEST DEADLINE', note: 'Nearest deadline funded first.' },
  { key: 'growth', label: 'LONG-TERM GROWTH', note: 'Furthest deadline, more runway.' },
  { key: 'balanced', label: 'BALANCED', note: 'Splits funds proportionally.' },
  { key: 'user', label: 'USER PRIORITY', note: 'Your current goal order.' },
];

interface ScenarioGoalResult {
  goal: FinancialGoal;
  contribution: number;
  completionDate: Date | null;
  projected: number;
  shortfall: number;
}

interface ScenarioResult {
  key: ScenarioKey;
  label: string;
  note: string;
  goals: ScenarioGoalResult[];
}

function buildScenario(
  option: (typeof SCENARIO_OPTIONS)[number],
  goals: FinancialGoal[],
  availableBudget: number,
  annualReturn: number
): ScenarioResult {
  const sortedGoals = [...goals].sort((left, right) => {
    if (option.key === 'essentials') {
      const priorityOrder = { Essential: 0, Important: 1, Optional: 2 };
      return priorityOrder[left.priority] - priorityOrder[right.priority];
    }
    if (option.key === 'deadline') {
      return left.targetDate.localeCompare(right.targetDate);
    }
    if (option.key === 'growth') {
      return right.targetDate.localeCompare(left.targetDate);
    }
    return 0;
  });
  const required = goals.map((goal) => projectGoal(goal, 0, annualReturn).requiredMonthly);
  const totalRequired = required.reduce((sum, amount) => sum + amount, 0);
  const allocations = new Map<string, number>();

  if (option.key === 'balanced' && totalRequired > 0) {
    for (const goal of goals) {
      const amount = projectGoal(goal, 0, annualReturn).requiredMonthly;
      allocations.set(goal.id, Math.min(availableBudget * amount / totalRequired, amount));
    }
  } else {
    let remainingBudget = availableBudget;
    for (const goal of sortedGoals) {
      const amount = projectGoal(goal, 0, annualReturn).requiredMonthly;
      const allocation = Math.min(Math.max(remainingBudget, 0), amount);
      allocations.set(goal.id, allocation);
      remainingBudget -= allocation;
    }
  }

  return {
    key: option.key,
    label: option.label,
    note: option.note,
    goals: goals.map((goal) => {
      const contribution = allocations.get(goal.id) ?? 0;
      const projection = projectGoal(goal, contribution, annualReturn);
      return {
        goal,
        contribution,
        completionDate: projection.completionDate,
        projected: projection.projected,
        shortfall: Math.max(goal.targetAmount - projection.projected, 0),
      };
    }),
  };
}

function ScenarioPanel({
  results,
  selectedKey,
  onSelect,
  conflicts,
  savedScenarios,
  onSave,
  onDelete,
}: {
  results: ScenarioResult[];
  selectedKey: ScenarioKey;
  onSelect: (key: ScenarioKey) => void;
  conflicts: GoalConflict[];
  savedScenarios: GoalScenario[];
  onSave: (result: ScenarioResult, conflicts: GoalConflict[]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const selected = results.find((result) => result.key === selectedKey) ?? results[0];
  if (!selected) return null;
  return (
    <View style={styles.scenarioPanel}>
      <Text style={styles.scenarioTitle}>PRIORITY SCENARIOS</Text>
      <View style={styles.scenarioTabs}>
        {results.map((result) => (
          <Pressable
            key={result.key}
            onPress={() => onSelect(result.key)}
            style={[styles.scenarioTab, result.key === selectedKey && styles.scenarioTabSelected]}
          >
            <Text style={[styles.scenarioTabText, result.key === selectedKey && styles.scenarioTabTextSelected]}>
              {result.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.scenarioNote}>{selected.note}</Text>
      {selected.goals.map((item) => (
        <View key={item.goal.id} style={styles.scenarioRow}>
          <View style={styles.scenarioGoalName}>
            <Text style={styles.scenarioGoalTitle}>{item.goal.name}</Text>
            <Text style={styles.scenarioGoalMeta}>{item.goal.priority.toUpperCase()}</Text>
          </View>
          <View style={styles.scenarioNumbers}>
            <Text style={styles.scenarioNumber}>{formatCurrency(item.contribution)}/MO</Text>
            <Text style={styles.scenarioNumber}>DONE {formatProjectionDate(item.completionDate)}</Text>
            <Text style={[styles.scenarioNumber, item.shortfall > 0 && styles.scenarioRisk]}>
              {item.shortfall > 0 ? `SHORT ${formatCurrency(item.shortfall)}` : `+${formatCurrency(item.projected - item.goal.targetAmount)}`}
            </Text>
          </View>
        </View>
      ))}
      <Pressable
        style={styles.scenarioSaveButton}
        onPress={() => onSave(selected, conflicts)}
      >
        <Text style={styles.scenarioSaveText}>[ SAVE SCENARIO ]</Text>
      </Pressable>
      {savedScenarios.length > 0 && (
        <View style={styles.savedScenarioPanel}>
          <Text style={styles.sensitivityTitle}>SAVED</Text>
          {savedScenarios.map((scenario) => (
            <View key={scenario.id} style={styles.savedScenarioRow}>
              <View style={styles.savedScenarioName}>
                <Text style={styles.scenarioGoalTitle}>{scenario.name}</Text>
                <Text style={styles.scenarioGoalMeta}>
                  {new Date(scenario.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <Pressable onPress={() => onDelete(scenario.id)}>
                <Text style={styles.deleteText}>[ DELETE ]</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function RecommendationPanel({ recommendations }: { recommendations: GoalRecommendation[] }) {
  return (
    <View style={styles.recommendationPanel}>
      <Text style={styles.scenarioTitle}>TRADE-OFFS</Text>
      {recommendations.length === 0 ? (
        <Text style={styles.recommendationClear}>NOTHING TO CHANGE</Text>
      ) : (
        recommendations.map((recommendation, index) => (
          <View key={`${recommendation.title}-${index}`} style={styles.recommendationRow}>
            <Text style={styles.recommendationTitle}>{recommendation.title}</Text>
            <Text style={styles.recommendationDetail}>{recommendation.detail}</Text>
            {recommendation.onAction && recommendation.actionLabel && (
              <Pressable
                onPress={recommendation.onAction}
                style={styles.recommendationButton}
              >
                <Text style={styles.recommendationButtonText}>
                  [ {recommendation.actionLabel} ]
                </Text>
              </Pressable>
            )}
          </View>
        ))
      )}
      <Text style={styles.recommendationNote}>Not financial advice.</Text>
    </View>
  );
}

function GoalDisclosure({
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
    <View style={styles.goalDisclosure}>
      <Pressable onPress={onToggle} style={styles.goalDisclosureToggle} accessibilityRole="button">
        <Text style={styles.goalDisclosureTitle}>{title}</Text>
        <Text style={styles.goalDisclosureIcon}>{expanded ? '−' : '+'}</Text>
      </Pressable>
      {expanded && children}
    </View>
  );
}

function signedCurrency(value: number) {
  return `${value >= 0 ? '+' : '-'}${formatCurrency(Math.abs(value))}`;
}

function ProgressDashboard({
  goals,
  availableBudget,
  monthlyExpenses,
  conflicts,
  lastReview,
  onSaveReview,
}: {
  goals: FinancialGoal[];
  availableBudget: number;
  monthlyExpenses: number;
  conflicts: GoalConflict[];
  lastReview: ProgressSnapshot | null;
  onSaveReview: (snapshot: ProgressSnapshot) => Promise<void>;
}) {
  const totalSaved = goals.reduce((sum, goal) => sum + goal.currentAmount, 0);
  const totalTarget = goals.reduce((sum, goal) => sum + goal.targetAmount, 0);
  const progress = totalTarget > 0 ? Math.min((totalSaved / totalTarget) * 100, 100) : 0;
  const equalShare = goals.length > 0 ? availableBudget / goals.length : 0;
  const statuses = goals.reduce(
    (counts, goal) => {
      const required = projectGoal(goal, equalShare, 0).requiredMonthly;
      const status = goal.currentAmount >= goal.targetAmount
        ? 'COMPLETE'
        : required > availableBudget
          ? 'UNREALISTIC'
          : goalStatus(goal, equalShare);
      counts[status] = (counts[status] ?? 0) + 1;
      return counts;
    },
    {} as Record<string, number>
  );
  const upcoming = [...goals]
    .filter((goal) => new Date(`${goal.targetDate}T00:00:00`).getTime() >= Date.now())
    .sort((left, right) => left.targetDate.localeCompare(right.targetDate))
    .slice(0, 3);
  const currentSnapshot: ProgressSnapshot = {
    reviewedAt: new Date().toISOString(),
    availableGoalBudget: availableBudget,
    monthlyExpenses,
    totalSaved,
    totalTarget,
  };

  return (
    <View style={styles.dashboardPanel}>
      <Text style={styles.dashboardTitle}>PROGRESS</Text>
      <View style={styles.dashboardMetrics}>
        <DashboardMetric label="AVAILABLE / MO" value={formatCurrency(availableBudget)} />
        <DashboardMetric label="FUNDED" value={`${Math.round(progress)}%`} />
        <DashboardMetric label="CONFLICTS" value={String(conflicts.length)} risk={conflicts.length > 0} />
        <DashboardMetric label="ACTIVE GOALS" value={String(goals.length)} />
      </View>
      <View style={styles.dashboardProgressTrack}>
        <View style={[styles.dashboardProgressFill, { width: `${progress}%` }]} />
      </View>
      <View style={styles.statusRow}>
        {['ON TRACK', 'AT RISK', 'UNREALISTIC', 'COMPLETE'].map((status) => (
          <Text
            key={status}
            style={[
              styles.statusCount,
              status === 'AT RISK' && styles.statusAtRisk,
              status === 'UNREALISTIC' && styles.statusUnrealistic,
              status === 'COMPLETE' && styles.statusComplete,
            ]}
          >
            {status}: {statuses[status] ?? 0}
          </Text>
        ))}
      </View>
      <View style={styles.dashboardSection}>
        <Text style={styles.dashboardSectionTitle}>UPCOMING DEADLINES</Text>
        {upcoming.length === 0 ? (
          <Text style={styles.dashboardMuted}>NONE UPCOMING</Text>
        ) : (
          upcoming.map((goal) => (
            <View key={goal.id} style={styles.dashboardDeadline}>
              <Text style={styles.dashboardDeadlineName}>{goal.name}</Text>
              <Text style={styles.dashboardDeadlineDate}>{goal.targetDate}</Text>
            </View>
          ))
        )}
      </View>
      <View style={styles.dashboardSection}>
        <Text style={styles.dashboardSectionTitle}>SINCE LAST REVIEW</Text>
        {lastReview ? (
          <>
            <Text style={styles.dashboardChange}>BUDGET {signedCurrency(availableBudget - lastReview.availableGoalBudget)}</Text>
            <Text style={styles.dashboardChange}>EXPENSES {signedCurrency(monthlyExpenses - lastReview.monthlyExpenses)}</Text>
            <Text style={styles.dashboardChange}>SAVED {signedCurrency(totalSaved - lastReview.totalSaved)}</Text>
            <Text style={styles.dashboardChange}>REVIEWED {new Date(lastReview.reviewedAt).toLocaleDateString()}</Text>
          </>
        ) : (
          <Text style={styles.dashboardMuted}>SAVE A REVIEW TO TRACK CHANGES</Text>
        )}
      </View>
      <Pressable
        style={styles.reviewButton}
        onPress={async () => {
          await onSaveReview(currentSnapshot);
        }}
      >
        <Text style={styles.reviewButtonText}>[ SAVE REVIEW ]</Text>
      </Pressable>
    </View>
  );
}

function DashboardMetric({ label, value, risk = false }: { label: string; value: string; risk?: boolean }) {
  return (
    <View style={styles.dashboardMetric}>
      <Text style={styles.dashboardMetricLabel}>{label}</Text>
      <Text style={[styles.dashboardMetricValue, risk && styles.dashboardRisk]}>{value}</Text>
    </View>
  );
}

function detectConflicts(
  goals: FinancialGoal[],
  profile: FinancialProfile,
  availableBudget: number,
  monthlyExpenses: number
): GoalConflict[] {
  if (goals.length === 0) return [];
  const equalShare = availableBudget / goals.length;
  const projections = goals.map((goal) => ({
    goal,
    projection: projectGoal(goal, equalShare, profile.expectedAnnualReturn),
  }));
  const conflicts: GoalConflict[] = [];
  const totalRequired = projections.reduce(
    (sum, item) => sum + item.projection.requiredMonthly,
    0
  );

  if (totalRequired > availableBudget) {
    conflicts.push({
      title: 'CONTRIBUTION OVERLOAD',
      detail: `${formatCurrency(totalRequired)} needed vs ${formatCurrency(availableBudget)} available.`,
      goals: goals.map((goal) => goal.name),
    });
  }

  const deadlines = new Map<string, typeof projections>();
  for (const item of projections) {
    const group = deadlines.get(item.goal.targetDate) ?? [];
    group.push(item);
    deadlines.set(item.goal.targetDate, group);
  }
  for (const [deadline, group] of deadlines) {
    const required = group.reduce(
      (sum, item) => sum + item.projection.requiredMonthly,
      0
    );
    if (group.length > 1 && group.every((item) => item.goal.deadlineType === 'Fixed') && required > availableBudget) {
      conflicts.push({
        title: 'DEADLINE COLLISION',
        detail: `${group.length} goals need ${formatCurrency(required)}/mo before ${deadline}.`,
        goals: group.map((item) => item.goal.name),
      });
    }
  }

  const emergencyGap = Math.max(
    profile.emergencyFundTarget - profile.currentSavings,
    0
  );
  if (emergencyGap > 0) {
    conflicts.push({
      title: 'EMERGENCY FUND',
      detail: `Short by ${formatCurrency(emergencyGap)}.`,
      goals: goals.map((goal) => goal.name),
    });
  }

  const pressuredGoals = projections.filter(
    (item) => item.goal.deadlineType === 'Fixed' && item.projection.requiredMonthly > equalShare
  );
  for (const item of pressuredGoals) {
    conflicts.push({
      title: 'DEADLINE PRESSURE',
      detail: `Needs ${formatCurrency(item.projection.requiredMonthly)}/mo, plan gives ${formatCurrency(equalShare)}.`,
      goals: [item.goal.name],
    });
  }

  const debtRatio = profile.monthlyIncome > 0
    ? profile.monthlyDebtPayments / profile.monthlyIncome
    : 0;
  const competingGoals = debtRatio > 0.36
    ? goals.filter((goal) => goal.priority !== 'Essential')
    : [];
  if (competingGoals.length > 0) {
    conflicts.push({
      title: 'DEBT / GOAL COMPETITION',
      detail: `Debt uses ${Math.round(debtRatio * 100)}% of income.`,
      goals: competingGoals.map((goal) => goal.name),
    });
  }

  if (monthlyExpenses === 0 && profile.monthlyIncome > 0) {
    conflicts.push({
      title: 'NO EXPENSES LOGGED',
      detail: 'This month has no recorded expenses yet.',
      goals: goals.map((goal) => goal.name),
    });
  }

  return conflicts;
}

function ConflictPanel({ conflicts }: { conflicts: GoalConflict[] }) {
  return (
    <View style={styles.conflictPanel}>
      <View style={styles.conflictHeader}>
        <Text style={styles.conflictTitle}>CONFLICTS</Text>
        <Text style={styles.conflictCode}>{conflicts.length}</Text>
      </View>
      {conflicts.length === 0 ? (
        <Text style={styles.conflictClear}>NONE DETECTED</Text>
      ) : (
        conflicts.map((conflict, index) => (
          <View key={`${conflict.title}-${index}`} style={styles.conflictItem}>
            <Text style={styles.conflictItemTitle}>! {conflict.title}</Text>
            <Text style={styles.conflictDetail}>{conflict.detail}</Text>
            <Text style={styles.conflictGoals}>
              {conflict.goals.join(' / ')}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

export default function GoalsScreen() {
  const {
    goals,
    profile,
    expenses,
    lastReview,
    scenarios: savedScenarios,
    addGoal,
    updateGoal,
    updateProfile,
    recordReview,
    saveScenario,
    deleteScenario,
    deleteGoal,
  } = useExpenses();
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [priority, setPriority] = useState<GoalPriority>('Important');
  const [category, setCategory] = useState<GoalCategory>('Custom');
  const [minimumContribution, setMinimumContribution] = useState('');
  const [deadlineType, setDeadlineType] = useState<GoalDeadlineType>('Fixed');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [formError, setFormError] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);
  const [showConflicts, setShowConflicts] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [showScenarios, setShowScenarios] = useState(false);
  const monthlyExpenses = useMemo(() => {
    const now = new Date();
    return expenses
      .filter((expense) => {
        const date = new Date(expense.date);
        return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
      })
      .reduce((sum, expense) => sum + expense.amount, 0);
  }, [expenses]);
  const emergencyContribution = Math.max(
    profile.emergencyFundTarget - profile.currentSavings,
    0
  ) / 12;
  const availableGoalBudget = useMemo(() => {
    return Math.max(
      profile.monthlyIncome - monthlyExpenses - profile.monthlyDebtPayments - emergencyContribution,
      0
    );
  }, [emergencyContribution, monthlyExpenses, profile]);
  const currentContribution = goals.length > 0 ? availableGoalBudget / goals.length : 0;
  const totalRequired = goals.reduce(
    (sum, goal) => sum + projectGoal(goal, 0, profile.expectedAnnualReturn).requiredMonthly,
    0
  );
  const recommendations: GoalRecommendation[] = [];
  if (goals.length > 0 && totalRequired > availableGoalBudget) {
    const increase = totalRequired - availableGoalBudget;
    recommendations.push({
      title: 'INCREASE MONTHLY CONTRIBUTION',
      detail: `${formatCurrency(increase)} more/month covers all goals.`,
      actionLabel: 'SET PLAN',
      onAction: async () => {
        await updateProfile({
          ...profile,
          goalContributionBudget: Math.ceil(totalRequired),
        });
        Alert.alert('PLAN UPDATED', `SET TO ${formatCurrency(Math.ceil(totalRequired))}.`);
      },
    });
  }
  const pressuredGoal = goals.find(
    (goal) => projectGoal(goal, currentContribution, profile.expectedAnnualReturn).requiredMonthly > currentContribution
  );
  if (pressuredGoal) {
    recommendations.push({
      title: `EXTEND ${pressuredGoal.name.toUpperCase()} DEADLINE`,
      detail: 'Adds 6 months, lowers the monthly amount needed.',
      actionLabel: 'EXTEND +6M',
      onAction: async () => {
        await updateGoal(pressuredGoal.id, {
          targetDate: shiftGoalDate(pressuredGoal.targetDate, 6),
        });
        Alert.alert('DEADLINE UPDATED', `${pressuredGoal.name} now targets ${shiftGoalDate(pressuredGoal.targetDate, 6)}.`);
      },
    });
    recommendations.push({
      title: `REDUCE ${pressuredGoal.name.toUpperCase()} TARGET`,
      detail: 'Cuts the target 10%, lowers the monthly amount needed.',
      actionLabel: 'REDUCE 10%',
      onAction: async () => {
        const targetAmount = Math.round(pressuredGoal.targetAmount * 0.9);
        await updateGoal(pressuredGoal.id, { targetAmount });
        Alert.alert('TARGET UPDATED', `${pressuredGoal.name} target is now ${formatCurrency(targetAmount)}.`);
      },
    });
    if (pressuredGoal.priority === 'Optional') {
      recommendations.push({
        title: `REORDER ${pressuredGoal.name.toUpperCase()}`,
        detail: 'Marks this goal Important for scenario comparisons.',
        actionLabel: 'MARK IMPORTANT',
        onAction: async () => {
          await updateGoal(pressuredGoal.id, { priority: 'Important' });
          Alert.alert('PRIORITY UPDATED', `${pressuredGoal.name} is now marked Important.`);
        },
      });
    }
  }
  const debtRatio = profile.monthlyIncome > 0
    ? profile.monthlyDebtPayments / profile.monthlyIncome
    : 0;
  if (debtRatio > 0.36 && monthlyExpenses > 0) {
    recommendations.push({
      title: 'REDUCE DISCRETIONARY SPENDING',
      detail: `Cutting spending 10% frees ~${formatCurrency(monthlyExpenses * 0.1)}/month.`,
    });
  }
  if (profile.emergencyFundTarget > profile.currentSavings && goals.some((goal) => goal.priority !== 'Essential')) {
    recommendations.push({
      title: 'BUILD THE EMERGENCY FUND FIRST',
      detail: `Short by ${formatCurrency(profile.emergencyFundTarget - profile.currentSavings)}.`,
    });
  }
  const [scenarioKey, setScenarioKey] = useState<ScenarioKey>('essentials');
  const scenarios = useMemo(
    () =>
      SCENARIO_OPTIONS.map((option) =>
        buildScenario(option, goals, availableGoalBudget, profile.expectedAnnualReturn)
      ),
    [availableGoalBudget, goals, profile.expectedAnnualReturn]
  );
  const conflicts = useMemo(
    () => detectConflicts(goals, profile, availableGoalBudget, monthlyExpenses),
    [availableGoalBudget, goals, monthlyExpenses, profile]
  );

  const handleSaveScenario = async (
    result: ScenarioResult,
    currentConflicts: GoalConflict[]
  ) => {
    await saveScenario({
      name: `${result.label} // ${new Date().toLocaleDateString()}`,
      priorityStrategy: result.label,
      goalContributions: Object.fromEntries(
        result.goals.map((item) => [item.goal.id, item.contribution])
      ),
      projectedResults: Object.fromEntries(
        result.goals.map((item) => [
          item.goal.id,
          {
            contribution: item.contribution,
            completionDate: item.completionDate?.toISOString() ?? null,
            projectedValue: item.projected,
            shortfall: item.shortfall,
          },
        ])
      ),
      conflicts: currentConflicts.map(
        (conflict) => `${conflict.title}: ${conflict.goals.join(' / ')}`
      ),
    });
    Alert.alert('SCENARIO SAVED', `${result.label} saved.`);
  };

  const handleAdd = async () => {
    setFormError('');
    const target = targetAmount.trim() === '' ? 0 : Number.parseFloat(targetAmount.replace(/,/g, ''));
    const current = currentAmount.trim() === '' ? 0 : Number.parseFloat(currentAmount.replace(/,/g, ''));
    const minimum = minimumContribution.trim() === '' ? 0 : Number.parseFloat(minimumContribution.replace(/,/g, ''));
    const deadline = new Date(`${targetDate}T00:00:00`);

    if (!name.trim() || !Number.isFinite(target) || target <= 0) {
      setFormError('Add a goal name and a target amount above zero.');
      return;
    }
    if (!Number.isFinite(current) || current < 0 || current > target) {
      setFormError('Current savings must be between zero and the target.');
      return;
    }
    if (!Number.isFinite(minimum) || minimum < 0) {
      setFormError('Minimum contribution must be zero or positive.');
      return;
    }
    if (!targetDate || Number.isNaN(deadline.getTime())) {
      setFormError('Choose a valid target date.');
      return;
    }

    setSavingGoal(true);
    try {
      await addGoal({
        name: name.trim(),
        targetAmount: target,
        currentAmount: current,
        targetDate,
        priority,
        category,
        minimumMonthlyContribution: minimum,
        deadlineType,
      });
      setName('');
      setTargetAmount('');
      setCurrentAmount('');
      setTargetDate('');
      setPriority('Important');
      setCategory('Custom');
      setMinimumContribution('');
      setDeadlineType('Fixed');
    } finally {
      setSavingGoal(false);
    }
  };

  const handleDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) setTargetDate(toDateValue(selectedDate));
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.titleBar}>
          <Text style={styles.title}>GOALS</Text>
        </View>

        <View style={styles.budgetPanel}>
          <Text style={styles.panelLabel}>AVAILABLE MONTHLY BUDGET</Text>
          <Text style={styles.panelValue}>
            {formatCurrency(availableGoalBudget)}
          </Text>
          <Text style={styles.panelMeta}>
            {goals.length} ACTIVE GOAL{goals.length === 1 ? '' : 'S'}
          </Text>
          <Text style={styles.assumptionText}>
            ASSUMES {profile.expectedAnnualReturn}% ANNUAL RETURN.
          </Text>
        </View>

        <ProgressDashboard
          goals={goals}
          availableBudget={availableGoalBudget}
          monthlyExpenses={monthlyExpenses}
          conflicts={conflicts}
          lastReview={lastReview}
          onSaveReview={recordReview}
        />

        <GoalDisclosure title={`CONFLICTS (${conflicts.length})`} expanded={showConflicts} onToggle={() => setShowConflicts((current) => !current)}>
          <ConflictPanel conflicts={conflicts} />
        </GoalDisclosure>

        <GoalDisclosure title={`TRADE-OFFS (${recommendations.length})`} expanded={showRecommendations} onToggle={() => setShowRecommendations((current) => !current)}>
          <RecommendationPanel recommendations={recommendations} />
        </GoalDisclosure>

        <GoalDisclosure title="PRIORITY SCENARIOS" expanded={showScenarios} onToggle={() => setShowScenarios((current) => !current)}>
          <ScenarioPanel
            results={scenarios}
            selectedKey={scenarioKey}
            onSelect={setScenarioKey}
            conflicts={conflicts}
            savedScenarios={savedScenarios}
            onSave={handleSaveScenario}
            onDelete={deleteScenario}
          />
        </GoalDisclosure>

        <View style={styles.formPanel}>
          <Text style={styles.sectionLabel}>NEW GOAL</Text>
          <GoalField
            label="GOAL NAME"
            placeholder="e.g. emergency fund"
            value={name}
            onChangeText={setName}
            textInput
          />
          <GoalField
            label="TARGET AMOUNT"
            placeholder="e.g. 300000"
            value={targetAmount}
            onChangeText={setTargetAmount}
          />
          <GoalField
            label="CURRENT SAVINGS"
            placeholder="e.g. 50000"
            value={currentAmount}
            onChangeText={setCurrentAmount}
          />
          <Text style={styles.fieldLabel}>CATEGORY</Text>
          <View style={styles.priorityRow}>
            {GOAL_CATEGORIES.map((option) => (
              <Pressable
                key={option}
                onPress={() => setCategory(option)}
                style={[styles.priorityChip, option === category && styles.priorityChipSelected]}
              >
                <Text style={[styles.priorityText, option === category && styles.priorityTextSelected]}>
                  {option.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
          <GoalField
            label="MIN. MONTHLY CONTRIBUTION"
            placeholder="e.g. 5000"
            value={minimumContribution}
            onChangeText={setMinimumContribution}
          />
          <Text style={styles.fieldLabel}>TARGET DATE</Text>
          {Platform.OS === 'web' ? (
            <TextInput
              style={styles.dateInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9B91B8"
              value={targetDate}
              onChangeText={setTargetDate}
            />
          ) : (
            <>
              <Pressable style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.dateButtonText}>
                  {targetDate ? formatGoalDate(new Date(`${targetDate}T00:00:00`)) : 'SET DATE'}
                </Text>
              </Pressable>
              {showDatePicker && (
                <DateTimePicker
                  value={targetDate ? new Date(`${targetDate}T00:00:00`) : new Date()}
                  mode="date"
                  onChange={handleDateChange}
                />
              )}
            </>
          )}
          <Text style={styles.fieldLabel}>DEADLINE MODE</Text>
          <View style={styles.priorityRow}>
            {(['Fixed', 'Flexible'] as GoalDeadlineType[]).map((option) => (
              <Pressable
                key={option}
                onPress={() => setDeadlineType(option)}
                style={[styles.priorityChip, option === deadlineType && styles.priorityChipSelected]}
              >
                <Text style={[styles.priorityText, option === deadlineType && styles.priorityTextSelected]}>
                  {option.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
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
          {!!formError && <Text style={styles.formError}>{formError}</Text>}
          <Pressable style={[styles.addButton, savingGoal && styles.disabledButton]} onPress={handleAdd} disabled={savingGoal}>
            <Text style={styles.addText}>{savingGoal ? '[ SAVING... ]' : '[ ADD GOAL ]'}</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>GOALS</Text>
        {goals.length === 0 ? (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyMark}>[ ? ]</Text>
            <Text style={styles.emptyText}>NO GOALS YET</Text>
            <Text style={styles.emptySubtext}>
              ADD ONE ABOVE TO GET STARTED
            </Text>
          </View>
        ) : (
          goals.map((goal) => {
            const progress = Math.min(
              100,
              Math.max(0, (goal.currentAmount / goal.targetAmount) * 100)
            );
            const projection = projectGoal(
              goal,
              currentContribution,
              profile.expectedAnnualReturn
            );
            const status = goalStatus(goal, currentContribution);
            const sensitivity = [
              {
                label: 'INCOME +10%',
                value: projectGoal(
                  goal,
                  currentContribution + (profile.monthlyIncome * 0.1) / Math.max(goals.length, 1),
                  profile.expectedAnnualReturn
                ).surplus,
              },
              {
                label: 'EXPENSES -10%',
                value: projectGoal(
                  goal,
                  currentContribution + (monthlyExpenses * 0.1) / Math.max(goals.length, 1),
                  profile.expectedAnnualReturn
                ).surplus,
              },
              {
                label: 'SAVINGS +10%',
                value: projectGoal(
                  goal,
                  currentContribution,
                  profile.expectedAnnualReturn,
                  goal.currentAmount * 1.1
                ).surplus,
              },
              {
                label: 'RETURN +2 PTS',
                value: projectGoal(
                  goal,
                  currentContribution,
                  profile.expectedAnnualReturn + 2
                ).surplus,
              },
            ];
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
                  <Text style={[
                    styles.goalStatus,
                    status === 'AT RISK' && styles.statusAtRisk,
                    status === 'COMPLETE' && styles.statusComplete,
                    status === 'SET BUDGET' && styles.statusBudget,
                  ]}>
                    {status}
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progress}%` }]} />
                </View>
                <View style={styles.goalStats}>
                  <Text style={styles.goalStat}>{formatCurrency(goal.currentAmount)} SAVED</Text>
                  <Text style={styles.goalStat}>{Math.round(progress)}%</Text>
                  <Text style={styles.goalStat}>{formatCurrency(projection.requiredMonthly)}/MO</Text>
                </View>
                <View style={styles.analysisPanel}>
                  <Text style={styles.analysisTitle}>FEASIBILITY</Text>
                  <AnalysisRow label="EQUAL SHARE" value={`${formatCurrency(currentContribution)} / MO`} />
                  <AnalysisRow label="COMPLETION" value={formatProjectionDate(projection.completionDate)} />
                  <AnalysisRow label="AT TARGET" value={formatCurrency(projection.projected)} />
                  <AnalysisRow
                    label={projection.surplus >= 0 ? 'SURPLUS' : 'SHORTFALL'}
                    value={formatCurrency(Math.abs(projection.surplus))}
                    emphasis={projection.surplus < 0}
                  />
                  <Text style={styles.sensitivityTitle}>SENSITIVITY</Text>
                  {sensitivity.map((scenario) => (
                    <AnalysisRow
                      key={scenario.label}
                      label={scenario.label}
                      value={`${scenario.value >= 0 ? '+' : '-'}${formatCurrency(Math.abs(scenario.value))}`}
                      emphasis={scenario.value < 0}
                    />
                  ))}
                </View>
                <Pressable onPress={() => deleteGoal(goal.id)} style={styles.deleteButton}>
                  <Text style={styles.deleteText}>[ DELETE ]</Text>
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
  const handleChange = (value: string) => {
    if (textInput) {
      onChangeText(value);
      return;
    }
    const normalized = value.replace(/[^0-9.]/g, '');
    const [whole, decimal] = normalized.split('.');
    const formattedWhole = whole ? Number(whole).toLocaleString('en-IN') : '';
    onChangeText(decimal === undefined ? formattedWhole : `${formattedWhole}.${decimal.slice(0, 2)}`);
  };
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
          onChangeText={handleChange}
        />
      </View>
    </View>
  );
}

function AnalysisRow({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <View style={styles.analysisRow}>
      <Text style={styles.analysisLabel}>{label}</Text>
      <Text style={[styles.analysisValue, emphasis && styles.analysisRisk]}>{value}</Text>
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
  assumptionText: { fontFamily: 'monospace', fontSize: 8, color: '#6B6680', marginTop: 8, lineHeight: 12 },
  dashboardPanel: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B8AEDB', padding: 12, marginTop: 2, gap: 8 },
  dashboardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dashboardTitle: { color: '#201A33', fontFamily: 'monospace', fontSize: 17, fontWeight: '700' },
  dashboardMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  dashboardMetric: { flexGrow: 1, flexBasis: '45%', minWidth: 125, backgroundColor: '#F8F6FF', borderWidth: 1, borderColor: '#E1DAF1', padding: 9 },
  dashboardMetricLabel: { color: '#6B6680', fontFamily: 'monospace', fontSize: 8, fontWeight: '700' },
  dashboardMetricValue: { color: '#5B2DB8', fontFamily: 'monospace', fontSize: 15, fontWeight: '700', marginTop: 4 },
  dashboardRisk: { color: '#C52757' },
  dashboardProgressTrack: { height: 10, backgroundColor: '#F0ECFA', borderWidth: 1, borderColor: '#B8AEDB', overflow: 'hidden' },
  dashboardProgressFill: { height: '100%', backgroundColor: '#00C7AD' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusCount: { color: '#008F7D', fontFamily: 'monospace', fontSize: 8, fontWeight: '700' },
  statusAtRisk: { color: '#A45A00' },
  statusUnrealistic: { color: '#C52757' },
  statusComplete: { color: '#008F7D' },
  statusBudget: { color: '#A45A00' },
  dashboardSection: { borderTopWidth: 1, borderTopColor: '#E1DAF1', paddingTop: 8, gap: 5 },
  dashboardSectionTitle: { color: '#D6009A', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
  dashboardMuted: { color: '#9B91B8', fontFamily: 'monospace', fontSize: 8, lineHeight: 12 },
  dashboardDeadline: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  dashboardDeadlineName: { color: '#201A33', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
  dashboardDeadlineDate: { color: '#A45A00', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
  dashboardChange: { color: '#5D557A', fontFamily: 'monospace', fontSize: 9 },
  reviewButton: { backgroundColor: '#FF4FD8', borderWidth: 2, borderColor: '#00F5D4', paddingVertical: 12, alignItems: 'center' },
  reviewButtonText: { color: '#201A33', fontFamily: 'monospace', fontSize: 11, fontWeight: '700' },
  conflictPanel: { backgroundColor: '#FFF8E8', borderWidth: 1, borderColor: '#E7B84B', borderLeftWidth: 4, borderLeftColor: '#C52757', padding: 12, marginTop: 2, gap: 8 },
  conflictHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  conflictTitle: { color: '#C52757', fontFamily: 'monospace', fontSize: 10, fontWeight: '700' },
  conflictCode: { color: '#A45A00', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
  conflictClear: { color: '#008F7D', fontFamily: 'monospace', fontSize: 9 },
  conflictItem: { borderTopWidth: 1, borderTopColor: '#F0D9A0', paddingTop: 7, gap: 3 },
  conflictItemTitle: { color: '#C52757', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
  conflictDetail: { color: '#5D557A', fontFamily: 'monospace', fontSize: 9, lineHeight: 13 },
  conflictGoals: { color: '#A45A00', fontFamily: 'monospace', fontSize: 8, lineHeight: 12 },
  scenarioPanel: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B8AEDB', padding: 12, marginTop: 2, gap: 8 },
  scenarioHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scenarioCaption: { color: '#D6009A', fontFamily: 'monospace', fontSize: 9, fontWeight: '700', marginBottom: 5 },
  scenarioTitle: { color: '#201A33', fontFamily: 'monospace', fontSize: 16, fontWeight: '700' },
  scenarioCode: { color: '#008F7D', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
  scenarioTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  scenarioTab: { borderWidth: 1, borderColor: '#B8AEDB', backgroundColor: '#F8F6FF', paddingHorizontal: 8, paddingVertical: 7 },
  scenarioTabSelected: { backgroundColor: '#FF4FD8', borderColor: '#00F5D4' },
  scenarioTabText: { color: '#3D3854', fontFamily: 'monospace', fontSize: 8, fontWeight: '700' },
  scenarioTabTextSelected: { color: '#201A33' },
  scenarioNote: { color: '#6B6680', fontFamily: 'monospace', fontSize: 9, lineHeight: 13 },
  scenarioRow: { borderTopWidth: 1, borderTopColor: '#E1DAF1', paddingTop: 8, gap: 5 },
  scenarioGoalName: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  scenarioGoalTitle: { color: '#201A33', fontFamily: 'monospace', fontSize: 11, fontWeight: '700' },
  scenarioGoalMeta: { color: '#D6009A', fontFamily: 'monospace', fontSize: 8 },
  scenarioNumbers: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  scenarioNumber: { color: '#008F7D', fontFamily: 'monospace', fontSize: 8, fontWeight: '700' },
  scenarioRisk: { color: '#C52757' },
  scenarioFootnote: { color: '#9B91B8', fontFamily: 'monospace', fontSize: 8, lineHeight: 12, marginTop: 3 },
  scenarioSaveButton: { backgroundColor: '#FF4FD8', borderWidth: 1, borderColor: '#00F5D4', paddingVertical: 10, alignItems: 'center', marginTop: 3 },
  scenarioSaveText: { color: '#201A33', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
  savedScenarioPanel: { borderTopWidth: 1, borderTopColor: '#E1DAF1', paddingTop: 8, gap: 6 },
  savedScenarioRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  savedScenarioName: { flex: 1, gap: 3 },
  recommendationPanel: { backgroundColor: '#F4F0FF', borderWidth: 1, borderColor: '#B8AEDB', borderLeftWidth: 4, borderLeftColor: '#5B2DB8', padding: 12, marginTop: 2, gap: 8 },
  recommendationRow: { borderTopWidth: 1, borderTopColor: '#D9D0EE', paddingTop: 8, gap: 4 },
  recommendationTitle: { color: '#5B2DB8', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
  recommendationDetail: { color: '#5D557A', fontFamily: 'monospace', fontSize: 9, lineHeight: 13 },
  recommendationButton: { alignSelf: 'flex-start', backgroundColor: '#FF4FD8', borderWidth: 1, borderColor: '#00F5D4', paddingHorizontal: 9, paddingVertical: 7, marginTop: 2 },
  recommendationButtonText: { color: '#201A33', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
  recommendationClear: { color: '#008F7D', fontFamily: 'monospace', fontSize: 9 },
  recommendationNote: { color: '#9B91B8', fontFamily: 'monospace', fontSize: 8, lineHeight: 12 },
  goalDisclosure: { marginTop: 2, gap: 6 },
  goalDisclosureToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#E9E2FF', borderWidth: 1, borderColor: '#B8AEDB', paddingHorizontal: 12, paddingVertical: 10 },
  goalDisclosureTitle: { color: '#5B2DB8', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
  goalDisclosureIcon: { color: '#D6009A', fontFamily: 'monospace', fontSize: 18, fontWeight: '700' },
  formPanel: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B8AEDB', padding: 14, gap: 8 },
  sectionLabel: { fontFamily: 'monospace', fontSize: 11, fontWeight: '700', color: '#D6009A', marginTop: 10, marginBottom: 2 },
  field: { gap: 5 },
  fieldLabel: { fontFamily: 'monospace', fontSize: 10, fontWeight: '700', color: '#6B6680' },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B8AEDB', borderLeftWidth: 3, borderLeftColor: '#00F5D4', paddingHorizontal: 12, minHeight: 46 },
  currencySymbol: { color: '#008F7D', fontFamily: 'monospace', fontSize: 18, fontWeight: '700', marginRight: 6 },
  input: { flex: 1, color: '#201A33', fontFamily: 'monospace', fontSize: 15, outlineStyle: 'none' as any },
  dateButton: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B8AEDB', borderLeftWidth: 3, borderLeftColor: '#00F5D4', minHeight: 46, justifyContent: 'center', paddingHorizontal: 12 },
  dateButtonText: { color: '#5B2DB8', fontFamily: 'monospace', fontSize: 12, fontWeight: '700' },
  dateInput: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B8AEDB', borderLeftWidth: 3, borderLeftColor: '#00F5D4', color: '#201A33', fontFamily: 'monospace', fontSize: 15, minHeight: 46, paddingHorizontal: 12 },
  formError: { color: '#C52757', fontFamily: 'monospace', fontSize: 9, lineHeight: 13, marginTop: 3 },
  disabledButton: { opacity: 0.55 },
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
  analysisPanel: { backgroundColor: '#F8F6FF', borderWidth: 1, borderColor: '#E1DAF1', padding: 10, gap: 6 },
  analysisTitle: { color: '#5B2DB8', fontFamily: 'monospace', fontSize: 10, fontWeight: '700', marginBottom: 2 },
  analysisRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  analysisLabel: { color: '#6B6680', fontFamily: 'monospace', fontSize: 8, flexShrink: 1 },
  analysisValue: { color: '#008F7D', fontFamily: 'monospace', fontSize: 9, fontWeight: '700', textAlign: 'right' },
  analysisRisk: { color: '#C52757' },
  sensitivityTitle: { color: '#D6009A', fontFamily: 'monospace', fontSize: 8, fontWeight: '700', marginTop: 4 },
  analysisNote: { color: '#9B91B8', fontFamily: 'monospace', fontSize: 8, lineHeight: 12, marginTop: 3 },
  deleteButton: { alignSelf: 'flex-start', paddingVertical: 2 },
  deleteText: { color: '#C52757', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
});
