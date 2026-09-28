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
  const requiredMonthly = remaining / monthsToTarget;
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
  { key: 'essentials', label: 'ESSENTIALS FIRST', note: 'Essential, then important, then optional.' },
  { key: 'deadline', label: 'EARLIEST DEADLINE', note: 'Funds the nearest target date first.' },
  { key: 'growth', label: 'LONG-TERM GROWTH', note: 'Prioritizes the latest deadline for more runway.' },
  { key: 'balanced', label: 'BALANCED', note: 'Splits funds in proportion to required contributions.' },
  { key: 'user', label: 'USER PRIORITY', note: 'Follows the current goal register order.' },
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
      <View style={styles.scenarioHeader}>
        <View>
          <Text style={styles.scenarioCaption}>VECTORR / WHAT-IF LAB</Text>
          <Text style={styles.scenarioTitle}>PRIORITY SCENARIOS</Text>
        </View>
        <Text style={styles.scenarioCode}>NO SAVE</Text>
      </View>
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
      <Text style={styles.scenarioNote}>{selected.note} Compare this view without changing saved goals.</Text>
      {selected.goals.map((item) => (
        <View key={item.goal.id} style={styles.scenarioRow}>
          <View style={styles.scenarioGoalName}>
            <Text style={styles.scenarioGoalTitle}>{item.goal.name}</Text>
            <Text style={styles.scenarioGoalMeta}>{item.goal.priority.toUpperCase()}</Text>
          </View>
          <View style={styles.scenarioNumbers}>
            <Text style={styles.scenarioNumber}>CONTRIB {formatCurrency(item.contribution)}/MO</Text>
            <Text style={styles.scenarioNumber}>FINISH {formatProjectionDate(item.completionDate)}</Text>
            <Text style={[styles.scenarioNumber, item.shortfall > 0 && styles.scenarioRisk]}>
              {item.shortfall > 0 ? `SHORTFALL ${formatCurrency(item.shortfall)}` : `SURPLUS ${formatCurrency(item.projected - item.goal.targetAmount)}`}
            </Text>
          </View>
        </View>
      ))}
      <Text style={styles.scenarioFootnote}>
        Projections use the profile return assumption, monthly compounding, and current available budget.
      </Text>
      <Pressable
        style={styles.scenarioSaveButton}
        onPress={() => onSave(selected, conflicts)}
      >
        <Text style={styles.scenarioSaveText}>[ SAVE THIS SCENARIO ]</Text>
      </Pressable>
      {savedScenarios.length > 0 && (
        <View style={styles.savedScenarioPanel}>
          <Text style={styles.sensitivityTitle}>SAVED SCENARIOS</Text>
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
      <View style={styles.scenarioHeader}>
        <View>
          <Text style={styles.scenarioCaption}>VECTORR / ADVISORY</Text>
          <Text style={styles.scenarioTitle}>TRADE-OFFS TO REVIEW</Text>
        </View>
        <Text style={styles.scenarioCode}>NO GUARANTEE</Text>
      </View>
      {recommendations.length === 0 ? (
        <Text style={styles.recommendationClear}>NO IMMEDIATE CHANGES SUGGESTED.</Text>
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
      <Text style={styles.recommendationNote}>
        These are planning trade-offs based on your inputs, not personal financial advice or guarantees.
      </Text>
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
      <View style={styles.dashboardHeader}>
        <View>
          <Text style={styles.scenarioCaption}>VECTORR / COMMAND CENTER</Text>
          <Text style={styles.dashboardTitle}>PROGRESS DASHBOARD</Text>
        </View>
        <Text style={styles.scenarioCode}>LIVE PLAN</Text>
      </View>
      <View style={styles.dashboardMetrics}>
        <DashboardMetric label="AVAILABLE / MO" value={formatCurrency(availableBudget)} />
        <DashboardMetric label="FUNDING PROGRESS" value={`${Math.round(progress)}%`} />
        <DashboardMetric label="CONFLICTS" value={String(conflicts.length)} risk={conflicts.length > 0} />
        <DashboardMetric label="ACTIVE GOALS" value={String(goals.length)} />
      </View>
      <View style={styles.dashboardProgressTrack}>
        <View style={[styles.dashboardProgressFill, { width: `${progress}%` }]} />
      </View>
      <View style={styles.statusRow}>
        {['ON TRACK', 'AT RISK', 'UNREALISTIC', 'COMPLETE'].map((status) => (
          <Text key={status} style={styles.statusCount}>
            {status}: {statuses[status] ?? 0}
          </Text>
        ))}
      </View>
      <View style={styles.dashboardSection}>
        <Text style={styles.dashboardSectionTitle}>UPCOMING DEADLINES</Text>
        {upcoming.length === 0 ? (
          <Text style={styles.dashboardMuted}>NO UPCOMING DEADLINES</Text>
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
        <Text style={styles.dashboardSectionTitle}>CHANGES SINCE PREVIOUS REVIEW</Text>
        {lastReview ? (
          <>
            <Text style={styles.dashboardChange}>BUDGET {signedCurrency(availableBudget - lastReview.availableGoalBudget)}</Text>
            <Text style={styles.dashboardChange}>EXPENSES {signedCurrency(monthlyExpenses - lastReview.monthlyExpenses)}</Text>
            <Text style={styles.dashboardChange}>SAVED {signedCurrency(totalSaved - lastReview.totalSaved)}</Text>
            <Text style={styles.dashboardChange}>REVIEWED {new Date(lastReview.reviewedAt).toLocaleDateString()}</Text>
          </>
        ) : (
          <Text style={styles.dashboardMuted}>NO PREVIOUS REVIEW. SAVE THIS PLAN TO START TRACKING CHANGES.</Text>
        )}
      </View>
      <Pressable
        style={styles.reviewButton}
        onPress={async () => {
          await onSaveReview(currentSnapshot);
        }}
      >
        <Text style={styles.reviewButtonText}>[ SAVE CURRENT REVIEW ]</Text>
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
      detail: `${formatCurrency(totalRequired)} required monthly versus ${formatCurrency(availableBudget)} available.`,
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
    if (group.length > 1 && required > availableBudget) {
      conflicts.push({
        title: 'DEADLINE COLLISION',
        detail: `${group.length} goals need ${formatCurrency(required)} monthly before ${deadline}.`,
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
      title: 'EMERGENCY FUND COMPETITION',
      detail: `Emergency savings are short by ${formatCurrency(emergencyGap)}. Goal contributions may delay the minimum reserve.`,
      goals: goals.map((goal) => goal.name),
    });
  }

  const pressuredGoals = projections.filter(
    (item) => item.projection.requiredMonthly > equalShare
  );
  for (const item of pressuredGoals) {
    conflicts.push({
      title: 'FIXED DEADLINE PRESSURE',
      detail: `${formatCurrency(item.projection.requiredMonthly)} monthly is needed, but the equal-share plan provides ${formatCurrency(equalShare)}.`,
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
      detail: `Debt payments use ${Math.round(debtRatio * 100)}% of income, limiting funds for non-essential goals.`,
      goals: competingGoals.map((goal) => goal.name),
    });
  }

  if (monthlyExpenses === 0 && profile.monthlyIncome > 0) {
    conflicts.push({
      title: 'INCOMPLETE EXPENSE BASELINE',
      detail: 'No current-month expenses are recorded, so available budget may be overstated.',
      goals: goals.map((goal) => goal.name),
    });
  }

  return conflicts;
}

function ConflictPanel({ conflicts }: { conflicts: GoalConflict[] }) {
  return (
    <View style={styles.conflictPanel}>
      <View style={styles.conflictHeader}>
        <Text style={styles.conflictTitle}>CONFLICT DETECTION</Text>
        <Text style={styles.conflictCode}>{conflicts.length} FLAG{conflicts.length === 1 ? '' : 'S'}</Text>
      </View>
      {conflicts.length === 0 ? (
        <Text style={styles.conflictClear}>NO ACTIVE CONFLICTS DETECTED.</Text>
      ) : (
        conflicts.map((conflict, index) => (
          <View key={`${conflict.title}-${index}`} style={styles.conflictItem}>
            <Text style={styles.conflictItemTitle}>! {conflict.title}</Text>
            <Text style={styles.conflictDetail}>{conflict.detail}</Text>
            <Text style={styles.conflictGoals}>
              AFFECTED: {conflict.goals.join(' / ')}
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
      detail: `${formatCurrency(increase)} more per month would cover the combined required contributions. This may require reducing spending or extending a deadline.`,
      actionLabel: 'SET PLAN',
      onAction: async () => {
        await updateProfile({
          ...profile,
          goalContributionBudget: Math.ceil(totalRequired),
        });
        Alert.alert('PLAN UPDATED', `PLANNED GOAL BUDGET SET TO ${formatCurrency(Math.ceil(totalRequired))}.`);
      },
    });
  }
  const pressuredGoal = goals.find(
    (goal) => projectGoal(goal, currentContribution, profile.expectedAnnualReturn).requiredMonthly > currentContribution
  );
  if (pressuredGoal) {
    recommendations.push({
      title: `EXTEND ${pressuredGoal.name.toUpperCase()} DEADLINE`,
      detail: 'An extra six months would reduce the required monthly contribution, but delays completion.',
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
      detail: 'Reducing the target by 10% lowers the required contribution, but changes what the goal can fund.',
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
        detail: 'Marking this goal important makes the priority trade-off explicit when comparing scenarios.',
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
      detail: `A 10% reduction in this month's recorded expenses would free about ${formatCurrency(monthlyExpenses * 0.1)} monthly for goals. Review spending before changing the plan.`,
    });
  }
  if (profile.emergencyFundTarget > profile.currentSavings && goals.some((goal) => goal.priority !== 'Essential')) {
    recommendations.push({
      title: 'BUILD THE EMERGENCY FUND FIRST',
      detail: `The reserve is short by ${formatCurrency(profile.emergencyFundTarget - profile.currentSavings)}. Prioritizing it protects optional goals from unexpected withdrawals.`,
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
    Alert.alert('SCENARIO SAVED', `${result.label} was saved for later comparison.`);
  };

  const handleAdd = async () => {
    const target = targetAmount.trim() === '' ? 0 : Number.parseFloat(targetAmount);
    const current = currentAmount.trim() === '' ? 0 : Number.parseFloat(currentAmount);
    const minimum = minimumContribution.trim() === '' ? 0 : Number.parseFloat(minimumContribution);
    const deadline = new Date(`${targetDate}T00:00:00`);

    if (!name.trim() || !Number.isFinite(target) || target <= 0) {
      Alert.alert('INVALID GOAL', 'ADD A NAME AND A TARGET ABOVE ZERO.');
      return;
    }
    if (!Number.isFinite(current) || current < 0 || current > target) {
      Alert.alert('INVALID SAVINGS', 'CURRENT SAVINGS MUST BE BETWEEN ZERO AND THE TARGET.');
      return;
    }
    if (!Number.isFinite(minimum) || minimum < 0) {
      Alert.alert('INVALID MINIMUM', 'MINIMUM CONTRIBUTION MUST BE ZERO OR POSITIVE.');
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
            {goals.length} ACTIVE GOAL{goals.length === 1 ? '' : 'S'} // EQUAL-SHARE MODEL
          </Text>
          <Text style={styles.assumptionText}>
            PROJECTIONS USE {profile.expectedAnnualReturn}% ANNUAL RETURN, MONTHLY COMPOUNDING, AND NO FEES.
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

        <ConflictPanel conflicts={conflicts} />

        <RecommendationPanel recommendations={recommendations} />

        <ScenarioPanel
          results={scenarios}
          selectedKey={scenarioKey}
          onSelect={setScenarioKey}
          conflicts={conflicts}
          savedScenarios={savedScenarios}
          onSave={handleSaveScenario}
          onDelete={deleteScenario}
        />

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
          <Text style={styles.fieldLabel}>GOAL CATEGORY</Text>
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
            label="MINIMUM MONTHLY CONTRIBUTION / INR"
            placeholder="e.g. 5000"
            value={minimumContribution}
            onChangeText={setMinimumContribution}
          />
          <GoalField
            label="TARGET DATE / YYYY-MM-DD"
            placeholder="e.g. 2027-12-31"
            value={targetDate}
            onChangeText={setTargetDate}
            textInput
          />
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
                  <Text style={styles.goalStat}>{formatCurrency(projection.requiredMonthly)}/MO REQUIRED</Text>
                </View>
                <View style={styles.analysisPanel}>
                  <Text style={styles.analysisTitle}>FEASIBILITY ANALYSIS</Text>
                  <AnalysisRow label="CURRENT EQUAL SHARE" value={`${formatCurrency(currentContribution)} / MO`} />
                  <AnalysisRow label="ESTIMATED COMPLETION" value={formatProjectionDate(projection.completionDate)} />
                  <AnalysisRow label="PROJECTED AT TARGET" value={formatCurrency(projection.projected)} />
                  <AnalysisRow
                    label={projection.surplus >= 0 ? 'PROJECTED SURPLUS' : 'PROJECTED SHORTFALL'}
                    value={formatCurrency(Math.abs(projection.surplus))}
                    emphasis={projection.surplus < 0}
                  />
                  <Text style={styles.sensitivityTitle}>SENSITIVITY // TARGET-DATE SURPLUS</Text>
                  {sensitivity.map((scenario) => (
                    <AnalysisRow
                      key={scenario.label}
                      label={scenario.label}
                      value={`${scenario.value >= 0 ? '+' : '-'}${formatCurrency(Math.abs(scenario.value))}`}
                      emphasis={scenario.value < 0}
                    />
                  ))}
                  <Text style={styles.analysisNote}>
                    REQUIRED = (TARGET - SAVED) / {projection.monthsToTarget} MONTHS. CURRENT SHARE = AVAILABLE BUDGET / {Math.max(goals.length, 1)} GOAL{goals.length === 1 ? '' : 'S'}.
                  </Text>
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
