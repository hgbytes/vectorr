import React, { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useExpenses } from '../ExpensesContext';
import { ThemeColors, ThemeGlow, radius } from '../theme';
import { useTheme } from '../ThemeContext';
import Text from '../components/Text';
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
  if (!date) return 'No rate';
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
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
  const { colors, glow } = useTheme();
  const styles = useMemo(() => createStyles(colors, glow), [colors, glow]);
  const selected = results.find((result) => result.key === selectedKey) ?? results[0];
  if (!selected) return null;
  return (
    <View style={styles.scenarioPanel}>
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
        <Text style={styles.scenarioSaveText}>Save scenario</Text>
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
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function RecommendationCard({ recommendation }: { recommendation: GoalRecommendation }) {
  const { colors, glow } = useTheme();
  const styles = useMemo(() => createStyles(colors, glow), [colors, glow]);
  const actionable = Boolean(recommendation.onAction && recommendation.actionLabel);
  const [hovered, setHovered] = useState(false);
  return (
    <View
      style={[styles.recommendationCard, actionable && styles.recommendationCardActionable]}
    >
      <View
        style={[
          styles.recommendationIconBadge,
          actionable && styles.recommendationIconBadgeActionable,
        ]}
      >
        <Text style={styles.recommendationIconText}>{actionable ? '⚡' : 'ℹ'}</Text>
      </View>
      <View style={styles.recommendationBody}>
        <Text style={styles.recommendationTitle}>{recommendation.title}</Text>
        <Text style={styles.recommendationDetail}>{recommendation.detail}</Text>
        {actionable && (
          <Pressable
            onPress={recommendation.onAction}
            onHoverIn={() => setHovered(true)}
            onHoverOut={() => setHovered(false)}
            style={[styles.recommendationButton, hovered && styles.recommendationButtonHovered]}
          >
            <Text style={styles.recommendationButtonText}>
              {recommendation.actionLabel}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function RecommendationPanel({ recommendations }: { recommendations: GoalRecommendation[] }) {
  const { colors, glow } = useTheme();
  const styles = useMemo(() => createStyles(colors, glow), [colors, glow]);
  const actionableCount = recommendations.filter((item) => item.onAction).length;
  return (
    <View style={styles.recommendationPanel}>
      {recommendations.length > 0 && (
        <Text style={styles.recommendationHeaderMeta}>
          {actionableCount} ACTIONABLE // {recommendations.length - actionableCount} TO REVIEW
        </Text>
      )}
      {recommendations.length === 0 ? (
        <View style={styles.recommendationEmpty}>
          <Text style={styles.recommendationEmptyIcon}>✓</Text>
          <Text style={styles.recommendationClear}>NOTHING TO CHANGE RIGHT NOW</Text>
        </View>
      ) : (
        <View style={styles.recommendationList}>
          {recommendations.map((recommendation, index) => (
            <RecommendationCard key={`${recommendation.title}-${index}`} recommendation={recommendation} />
          ))}
        </View>
      )}
      <Text style={styles.recommendationNote}>Not financial advice.</Text>
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
  const { colors, glow } = useTheme();
  const styles = useMemo(() => createStyles(colors, glow), [colors, glow]);
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

  const [showActivity, setShowActivity] = useState(false);
  const statusChips: { key: string; label: string; style?: object }[] = [
    { key: 'ON TRACK', label: 'TRACK' },
    { key: 'AT RISK', label: 'RISK', style: styles.statusChipRisk },
    { key: 'UNREALISTIC', label: 'UNREAL', style: styles.statusChipUnrealistic },
    { key: 'COMPLETE', label: 'DONE', style: styles.statusChipComplete },
  ];

  return (
    <View style={styles.dashboardPanel}>
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
        {statusChips.map((chip) => (
          <View key={chip.key} style={[styles.statusChip, chip.style]}>
            <Text style={styles.statusChipCount}>{statuses[chip.key] ?? 0}</Text>
            <Text style={styles.statusChipLabel}>{chip.label}</Text>
          </View>
        ))}
      </View>

      <Pressable
        onPress={() => setShowActivity((current) => !current)}
        style={styles.dashboardActivityToggle}
        accessibilityRole="button"
      >
        <Text style={styles.dashboardActivityToggleText}>
          {showActivity ? 'HIDE ACTIVITY' : 'DEADLINES & REVIEW'}
        </Text>
        <Text style={styles.goalDisclosureIcon}>{showActivity ? '−' : '+'}</Text>
      </Pressable>

      {showActivity && (
        <>
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
            <Text style={styles.reviewButtonText}>SAVE REVIEW</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

function DashboardMetric({ label, value, risk = false }: { label: string; value: string; risk?: boolean }) {
  const { colors, glow } = useTheme();
  const styles = useMemo(() => createStyles(colors, glow), [colors, glow]);
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
  const { colors, glow } = useTheme();
  const styles = useMemo(() => createStyles(colors, glow), [colors, glow]);
  return (
    <View style={styles.conflictPanel}>
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

type InsightsTab = 'conflicts' | 'recommendations' | 'scenarios';

function InsightsPanel({
  conflicts,
  recommendations,
  scenarioResults,
  scenarioKey,
  onSelectScenario,
  savedScenarios,
  onSaveScenario,
  onDeleteScenario,
}: {
  conflicts: GoalConflict[];
  recommendations: GoalRecommendation[];
  scenarioResults: ScenarioResult[];
  scenarioKey: ScenarioKey;
  onSelectScenario: (key: ScenarioKey) => void;
  savedScenarios: GoalScenario[];
  onSaveScenario: (result: ScenarioResult, conflicts: GoalConflict[]) => Promise<void>;
  onDeleteScenario: (id: string) => Promise<void>;
}) {
  const { colors, glow } = useTheme();
  const styles = useMemo(() => createStyles(colors, glow), [colors, glow]);
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<InsightsTab>(
    conflicts.length > 0 ? 'conflicts' : 'recommendations'
  );
  const tabs: { key: InsightsTab; label: string; count: number; alert: boolean }[] = [
    { key: 'conflicts', label: 'CONFLICTS', count: conflicts.length, alert: conflicts.length > 0 },
    {
      key: 'recommendations',
      label: 'FIXES',
      count: recommendations.length,
      alert: recommendations.some((item) => item.onAction),
    },
    { key: 'scenarios', label: 'PLANS', count: 0, alert: false },
  ];
  const totalFlags = conflicts.length + recommendations.filter((item) => item.onAction).length;

  return (
    <View style={styles.insightsPanel}>
      <Pressable
        onPress={() => setExpanded((current) => !current)}
        style={styles.insightsToggle}
        accessibilityRole="button"
      >
        <View style={styles.insightsToggleLeft}>
          <Text style={styles.insightsToggleTitle}>INSIGHTS</Text>
          {totalFlags > 0 && (
            <View style={styles.insightsBadge}>
              <Text style={styles.insightsBadgeText}>{totalFlags}</Text>
            </View>
          )}
        </View>
        <Text style={styles.goalDisclosureIcon}>{expanded ? '−' : '+'}</Text>
      </Pressable>
      {expanded && (
        <View style={styles.insightsBody}>
          <View style={styles.insightsTabs}>
            {tabs.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => setTab(item.key)}
                style={[styles.insightsTab, tab === item.key && styles.insightsTabSelected]}
              >
                <Text
                  style={[
                    styles.insightsTabText,
                    tab === item.key && styles.insightsTabTextSelected,
                    item.alert && tab !== item.key && styles.insightsTabAlertText,
                  ]}
                >
                  {item.label}{item.key !== 'scenarios' ? ` ${item.count}` : ''}
                </Text>
              </Pressable>
            ))}
          </View>
          {tab === 'conflicts' && <ConflictPanel conflicts={conflicts} />}
          {tab === 'recommendations' && <RecommendationPanel recommendations={recommendations} />}
          {tab === 'scenarios' && (
            <ScenarioPanel
              results={scenarioResults}
              selectedKey={scenarioKey}
              onSelect={onSelectScenario}
              conflicts={conflicts}
              savedScenarios={savedScenarios}
              onSave={onSaveScenario}
              onDelete={onDeleteScenario}
            />
          )}
        </View>
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
  const { colors, glow } = useTheme();
  const styles = useMemo(() => createStyles(colors, glow), [colors, glow]);
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
  const [showAddForm, setShowAddForm] = useState(false);
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
      setShowAddForm(false);
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

        <InsightsPanel
          conflicts={conflicts}
          recommendations={recommendations}
          scenarioResults={scenarios}
          scenarioKey={scenarioKey}
          onSelectScenario={setScenarioKey}
          savedScenarios={savedScenarios}
          onSaveScenario={handleSaveScenario}
          onDeleteScenario={deleteScenario}
        />

        {!showAddForm ? (
          <Pressable style={styles.addGoalTrigger} onPress={() => setShowAddForm(true)}>
            <Text style={styles.addGoalTriggerText}>+ ADD GOAL</Text>
          </Pressable>
        ) : (
        <View style={styles.formPanel}>
          <View style={styles.formPanelHeader}>
            <Text style={[styles.sectionLabel, { marginTop: 0 }]}>NEW GOAL</Text>
            <Pressable onPress={() => setShowAddForm(false)}>
              <Text style={styles.formCancelText}>CANCEL</Text>
            </Pressable>
          </View>
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
              placeholderTextColor={colors.textFaint}
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
            <Text style={styles.addText}>{savingGoal ? 'SAVING…' : 'SAVE GOAL'}</Text>
          </Pressable>
        </View>
        )}

        <Text style={styles.sectionLabel}>GOALS</Text>
        {goals.length === 0 ? (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyText}>No goals yet</Text>
            <Text style={styles.emptySubtext}>
              Add one above to get started
            </Text>
          </View>
        ) : (
          goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              currentContribution={currentContribution}
              profile={profile}
              monthlyExpenses={monthlyExpenses}
              goalsCount={goals.length}
              onDelete={deleteGoal}
            />
          ))
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
  const { colors, glow } = useTheme();
  const styles = useMemo(() => createStyles(colors, glow), [colors, glow]);
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
          placeholderTextColor={colors.textFaint}
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
  const { colors, glow } = useTheme();
  const styles = useMemo(() => createStyles(colors, glow), [colors, glow]);
  return (
    <View style={styles.analysisRow}>
      <Text style={styles.analysisLabel}>{label}</Text>
      <Text style={[styles.analysisValue, emphasis && styles.analysisRisk]}>{value}</Text>
    </View>
  );
}

function GoalCard({
  goal,
  currentContribution,
  profile,
  monthlyExpenses,
  goalsCount,
  onDelete,
}: {
  goal: FinancialGoal;
  currentContribution: number;
  profile: FinancialProfile;
  monthlyExpenses: number;
  goalsCount: number;
  onDelete: (id: string) => Promise<void>;
}) {
  const { colors, glow } = useTheme();
  const styles = useMemo(() => createStyles(colors, glow), [colors, glow]);
  const [expanded, setExpanded] = useState(false);
  const progress = Math.min(100, Math.max(0, (goal.currentAmount / goal.targetAmount) * 100));
  const projection = projectGoal(goal, currentContribution, profile.expectedAnnualReturn);
  const status = goalStatus(goal, currentContribution);
  const sensitivity = [
    {
      label: 'INCOME +10%',
      value: projectGoal(
        goal,
        currentContribution + (profile.monthlyIncome * 0.1) / Math.max(goalsCount, 1),
        profile.expectedAnnualReturn
      ).surplus,
    },
    {
      label: 'EXPENSES -10%',
      value: projectGoal(
        goal,
        currentContribution + (monthlyExpenses * 0.1) / Math.max(goalsCount, 1),
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
      value: projectGoal(goal, currentContribution, profile.expectedAnnualReturn + 2).surplus,
    },
  ];

  const handleDelete = () => {
    if (Platform.OS === 'web') {
      if (window.confirm(`Remove "${goal.name}"? This can't be undone.`)) {
        onDelete(goal.id);
      }
      return;
    }
    Alert.alert('DELETE GOAL', `Remove "${goal.name}"? This can't be undone.`, [
      { text: 'CANCEL', style: 'cancel' },
      { text: 'DELETE', style: 'destructive', onPress: () => onDelete(goal.id) },
    ]);
  };

  return (
    <View style={styles.goalCard}>
      <Pressable
        onPress={() => setExpanded((current) => !current)}
        style={styles.goalHeader}
        accessibilityRole="button"
      >
        <View style={styles.goalNameWrap}>
          <Text style={styles.goalName} numberOfLines={1}>
            {goal.name}
          </Text>
          <Text style={styles.goalMeta}>
            {goal.priority} · Due {goal.targetDate}
          </Text>
        </View>
        <Text
          style={[
            styles.goalStatus,
            status === 'AT RISK' && styles.statusAtRisk,
            status === 'COMPLETE' && styles.statusComplete,
            status === 'SET BUDGET' && styles.statusBudget,
          ]}
        >
          {status}
        </Text>
      </Pressable>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
      <View style={styles.goalStats}>
        <Text style={styles.goalStat}>{formatCurrency(goal.currentAmount)} SAVED</Text>
        <Text style={styles.goalStat}>{Math.round(progress)}%</Text>
        <Text style={styles.goalStat}>{formatCurrency(projection.requiredMonthly)}/MO</Text>
      </View>
      {expanded && (
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
      )}
      <View style={styles.goalCardFooter}>
        <Pressable onPress={() => setExpanded((current) => !current)}>
          <Text style={styles.detailsToggleText}>{expanded ? 'HIDE DETAILS' : 'VIEW DETAILS'}</Text>
        </Pressable>
        <Pressable onPress={handleDelete} hitSlop={8}>
          <Text style={styles.deleteText}>DELETE</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors, glow: ThemeGlow) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
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
    marginBottom: 20,
  },
  title: { fontSize: 24, fontWeight: '600', color: colors.text },
  budgetPanel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
  },
  panelLabel: { fontSize: 12, fontWeight: '500', color: colors.textMuted },
  panelValue: { fontSize: 26, fontWeight: '700', color: colors.accent, marginTop: 6 },
  panelMeta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  assumptionText: { fontSize: 11, color: colors.textFaint, marginTop: 8, lineHeight: 15 },
  dashboardPanel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 14, marginTop: 2, gap: 10 },
  dashboardMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dashboardMetric: { flexGrow: 1, flexBasis: '45%', minWidth: 125, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 10 },
  dashboardMetricLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '500' },
  dashboardMetricValue: { color: colors.text, fontSize: 16, fontWeight: '600', marginTop: 4 },
  dashboardRisk: { color: colors.danger },
  dashboardProgressTrack: { height: 6, backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, overflow: 'hidden' },
  dashboardProgressFill: { height: '100%', backgroundColor: colors.positive },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusChipRisk: { backgroundColor: colors.warningSoft },
  statusChipUnrealistic: { backgroundColor: colors.dangerSoft },
  statusChipComplete: { backgroundColor: colors.positiveSoft },
  statusChipCount: { color: colors.text, fontSize: 11, fontWeight: '600' },
  statusChipLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '500' },
  statusAtRisk: { color: colors.warning },
  statusUnrealistic: { color: colors.danger },
  statusComplete: { color: colors.positive },
  statusBudget: { color: colors.warning },
  dashboardActivityToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  dashboardActivityToggleText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  dashboardSection: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, gap: 6 },
  dashboardSectionTitle: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  dashboardMuted: { color: colors.textFaint, fontSize: 11, lineHeight: 15 },
  dashboardDeadline: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  dashboardDeadlineName: { color: colors.text, fontSize: 12, fontWeight: '500' },
  dashboardDeadlineDate: { color: colors.textMuted, fontSize: 12 },
  dashboardChange: { color: colors.textMuted, fontSize: 12 },
  reviewButton: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', ...glow },
  reviewButtonText: { color: colors.onAccent, fontSize: 13, fontWeight: '600' },
  conflictPanel: { gap: 8 },
  conflictClear: { color: colors.positive, fontSize: 12 },
  conflictItem: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, gap: 3 },
  conflictItemTitle: { color: colors.danger, fontSize: 12, fontWeight: '600' },
  conflictDetail: { color: colors.textMuted, fontSize: 12, lineHeight: 16 },
  conflictGoals: { color: colors.textFaint, fontSize: 11, lineHeight: 15 },
  scenarioPanel: { gap: 8 },
  scenarioHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scenarioTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  scenarioTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  scenarioTab: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.sm, paddingHorizontal: 9, paddingVertical: 7 },
  scenarioTabSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  scenarioTabText: { color: colors.text, fontSize: 11, fontWeight: '500' },
  scenarioTabTextSelected: { color: colors.onAccent },
  scenarioNote: { color: colors.textMuted, fontSize: 12, lineHeight: 16 },
  scenarioRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, gap: 5 },
  scenarioGoalName: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  scenarioGoalTitle: { color: colors.text, fontSize: 13, fontWeight: '600' },
  scenarioGoalMeta: { color: colors.textMuted, fontSize: 11 },
  scenarioNumbers: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  scenarioNumber: { color: colors.textMuted, fontSize: 11, fontWeight: '500' },
  scenarioRisk: { color: colors.danger },
  scenarioSaveButton: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center', marginTop: 3 },
  scenarioSaveText: { color: colors.onAccent, fontSize: 12, fontWeight: '600' },
  savedScenarioPanel: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, gap: 6 },
  savedScenarioRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  savedScenarioName: { flex: 1, gap: 3 },
  recommendationPanel: { gap: 10 },
  recommendationHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 4 },
  recommendationHeaderMeta: { color: colors.textMuted, fontSize: 11, fontWeight: '500' },
  recommendationList: { gap: 8 },
  recommendationCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 10,
  },
  recommendationCardActionable: { borderColor: colors.text },
  recommendationIconBadge: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  recommendationIconBadgeActionable: { backgroundColor: colors.accentSoft },
  recommendationIconText: { fontSize: 14 },
  recommendationBody: { flex: 1, gap: 4 },
  recommendationTitle: { color: colors.text, fontSize: 12, fontWeight: '600' },
  recommendationDetail: { color: colors.textMuted, fontSize: 12, lineHeight: 16 },
  recommendationButton: { alignSelf: 'flex-start', backgroundColor: colors.accent, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 7, marginTop: 3 },
  recommendationButtonHovered: { opacity: 0.85 },
  recommendationButtonText: { color: colors.onAccent, fontSize: 12, fontWeight: '600' },
  recommendationEmpty: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  recommendationEmptyIcon: { color: colors.positive, fontSize: 14, fontWeight: '600' },
  recommendationClear: { color: colors.positive, fontSize: 12, fontWeight: '500' },
  recommendationNote: { color: colors.textFaint, fontSize: 11, lineHeight: 15 },
  goalDisclosureIcon: { color: colors.textMuted, fontSize: 18, fontWeight: '400' },
  insightsPanel: { marginTop: 2, gap: 6 },
  insightsToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  insightsToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  insightsToggleTitle: { color: colors.text, fontSize: 13, fontWeight: '600' },
  insightsBadge: { backgroundColor: colors.accent, minWidth: 18, height: 18, borderRadius: radius.sm, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  insightsBadgeText: { color: colors.onAccent, fontSize: 10, fontWeight: '600' },
  insightsBody: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, gap: 10 },
  insightsTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  insightsTab: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  insightsTabSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  insightsTabText: { color: colors.text, fontSize: 12, fontWeight: '500' },
  insightsTabTextSelected: { color: colors.onAccent },
  insightsTabAlertText: { color: colors.danger },
  addGoalTrigger: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 2, ...glow },
  addGoalTriggerText: { color: colors.onAccent, fontSize: 13, fontWeight: '600' },
  formPanel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 16, gap: 8, marginTop: 2 },
  formPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  formCancelText: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 12, marginBottom: 2 },
  field: { gap: 5 },
  fieldLabel: { fontSize: 12, fontWeight: '500', color: colors.textMuted },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, minHeight: 46 },
  currencySymbol: { color: colors.textMuted, fontSize: 16, fontWeight: '500', marginRight: 6 },
  input: { flex: 1, color: colors.text, fontSize: 15, outlineStyle: 'none' as any },
  dateButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, minHeight: 46, justifyContent: 'center', paddingHorizontal: 12 },
  dateButtonText: { color: colors.text, fontSize: 13, fontWeight: '500' },
  dateInput: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.text, fontSize: 15, minHeight: 46, paddingHorizontal: 12 },
  formError: { color: colors.danger, fontSize: 12, lineHeight: 16, marginTop: 3 },
  disabledButton: { opacity: 0.55 },
  priorityRow: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  priorityChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8 },
  priorityChipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  priorityText: { color: colors.text, fontSize: 12, fontWeight: '500' },
  priorityTextSelected: { color: colors.onAccent },
  addButton: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 8, ...glow },
  addText: { color: colors.onAccent, fontSize: 14, fontWeight: '600' },
  emptyPanel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 24, alignItems: 'center', gap: 6 },
  emptyText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  emptySubtext: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  goalCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 16, marginBottom: 8, gap: 10 },
  goalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  goalNameWrap: { flex: 1 },
  goalName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  goalMeta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  goalStatus: { color: colors.positive, fontSize: 11, fontWeight: '600' },
  riskStatus: { color: colors.danger },
  progressTrack: { height: 6, backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.positive },
  goalStats: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  goalStat: { color: colors.textMuted, fontSize: 11, fontWeight: '500' },
  analysisPanel: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 12, gap: 6 },
  analysisTitle: { color: colors.text, fontSize: 12, fontWeight: '600', marginBottom: 2 },
  analysisRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  analysisLabel: { color: colors.textMuted, fontSize: 11, flexShrink: 1 },
  analysisValue: { color: colors.text, fontSize: 12, fontWeight: '600', textAlign: 'right' },
  analysisRisk: { color: colors.danger },
  sensitivityTitle: { color: colors.textMuted, fontSize: 11, fontWeight: '600', marginTop: 4 },
  analysisNote: { color: colors.textFaint, fontSize: 11, lineHeight: 15, marginTop: 3 },
  goalCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  detailsToggleText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  deleteText: { color: colors.danger, fontSize: 12, fontWeight: '500' },
  });
}
