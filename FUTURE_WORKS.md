# Future Works: Financial Goal Planning

## Problem

Individuals often have several financial goals with different deadlines, such as retirement, children's education, buying a home, and maintaining an emergency fund. These goals compete for the same income and savings. Without a combined view, users may:

- Prioritize less important goals over essential ones.
- Allocate too little money to high-priority goals.
- Set deadlines that their income and savings cannot support.
- Discover conflicts only after their plans become difficult to change.

Vectorr currently records and summarizes expenses. Future work should extend it into a goal-planning system that evaluates goals together with the user's available resources.

## Product Goal

Help users answer three questions:

1. Which financial goals should receive priority?
2. Can the user's current income, savings, and expenses support those goals?
3. What needs to change when goals conflict with each other or with available resources?

The system should explain trade-offs clearly instead of presenting financial calculations without context.

## Proposed Features

### 1. Financial Profile

Allow users to record:

- Monthly income and expected income changes.
- Current savings and investments.
- Fixed and variable expenses.
- Existing debt and monthly repayments.
- Minimum emergency-fund target.
- Preferred monthly amount available for goals.

The profile should distinguish between recurring values and one-time values.

### 2. Goal Management

Allow users to create goals with:

- Goal name and category.
- Target amount.
- Current amount saved.
- Target date or time horizon.
- Priority: essential, important, or optional.
- Expected return rate, when applicable.
- Minimum acceptable contribution.
- Flexible or fixed deadline.

Initial goal categories could include emergency fund, retirement, education, home, debt repayment, and custom goals.

### 3. Feasibility Analysis

For each goal, calculate:

- Required monthly contribution.
- Estimated completion date at the current contribution rate.
- Projected value at the target date.
- Shortfall or surplus.
- Sensitivity to changes in income, expenses, savings, and return assumptions.

Use transparent assumptions and show how each result was calculated.

### 4. Conflict Detection

Analyze goals together and identify conflicts such as:

- Required monthly contributions exceeding available monthly funds.
- Multiple goals requiring the same savings before the same deadline.
- A goal contribution reducing the emergency fund below its minimum target.
- A fixed deadline requiring an unrealistic savings rate.
- Debt repayment and investment goals competing for the same funds.

Each conflict should explain the cause and identify the affected goals.

### 5. Prioritization Scenarios

Generate comparison scenarios, for example:

- Protect essentials first.
- Meet the earliest deadline first.
- Maximize long-term growth.
- Balance all goals proportionally.
- User-defined priority order.

For each scenario, show contributions, projected completion dates, and remaining shortfalls. Users should be able to compare scenarios without changing their saved plan.

### 6. Recommendations

Provide practical, editable suggestions such as:

- Increase the monthly contribution by a specified amount.
- Extend a goal deadline.
- Reduce a target amount.
- Reorder goal priorities.
- Reduce discretionary spending.
- Build the emergency fund before investing toward optional goals.

Recommendations should be presented as trade-offs, not as personal financial advice or guarantees.

### 7. Progress Dashboard

Add a dashboard that shows:

- Total monthly amount available for goals.
- Goal funding progress.
- Goals on track, at risk, or unrealistic.
- Upcoming deadlines.
- Current resource conflicts.
- Changes since the previous review.

The existing expense dashboard can provide the spending data needed for this view.

## Suggested Data Model

```text
FinancialProfile
- monthlyIncome
- currentSavings
- monthlyDebtPayments
- emergencyFundTarget
- goalContributionBudget
- assumptions

FinancialGoal
- id
- name
- category
- targetAmount
- currentAmount
- targetDate
- priority
- minimumMonthlyContribution
- expectedAnnualReturn
- deadlineFlexibility

GoalScenario
- id
- name
- priorityStrategy
- goalContributions
- projectedResults
- conflicts
- createdAt
```

## Implementation Phases

### Phase 1: Goal Tracking

- Add goal creation, editing, and deletion.
- Store current amount, target amount, priority, and target date.
- Display basic progress and required monthly contribution.

### Phase 2: Financial Profile

- Add income, savings, debt, and emergency-fund inputs.
- Calculate the amount available for goals after essential expenses.
- Connect the profile to the existing expense data.

### Phase 3: Conflict Analysis

- Detect contribution-budget shortfalls.
- Detect deadline and emergency-fund conflicts.
- Add clear status labels: on track, at risk, and unrealistic.

### Phase 4: Scenarios and Recommendations

- Add multiple prioritization strategies.
- Compare projected outcomes.
- Let users adjust deadlines, contributions, and priorities.
- Generate explainable recommendations.

### Phase 5: Review and Notifications

- Add monthly planning reviews.
- Track changes in spending and goal progress.
- Notify users when a goal becomes at risk, with opt-in controls.

## Calculation Principles

- Show nominal calculations separately from inflation-adjusted calculations.
- Make return, inflation, and income-growth assumptions visible.
- Avoid treating uncertain investment returns as guaranteed.
- Keep emergency savings separate from long-term investment goals.
- Round displayed values for readability while retaining precise internal values.
- Handle missing or incomplete information with explicit assumptions.

## Success Criteria

The future system should allow a user to:

- Enter at least three goals with different priorities and deadlines.
- See whether the combined monthly contribution is affordable.
- Identify which goals conflict and why.
- Compare at least two alternative priority scenarios.
- Understand the effect of changing a deadline or contribution.
- See which goals are on track without needing financial-planning expertise.

## Open Questions

- Should goal calculations support multiple currencies or remain INR-first?
- Should investment returns be entered manually or use default assumptions?
- Should expense categories be mapped automatically to essential and discretionary spending?
- How much financial detail should be required before showing projections?
- Should data remain local-only, or should account-based sync be added later?
- What privacy and security requirements apply before adding cloud storage?

## Out of Scope for the First Version

- Automated investment transactions.
- Tax filing or tax optimization.
- Guaranteed investment recommendations.
- Bank account connections without a clear privacy model.
- Credit scoring or lending decisions.

The first useful version should focus on visibility, prioritization, and explainable trade-offs between goals and available resources.
