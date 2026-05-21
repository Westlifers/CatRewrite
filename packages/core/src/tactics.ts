import { equalObject, equalTerm } from "./equality";
import { generatedRules } from "./inspect";
import { normalizeTerm } from "./normalize";
import type { Goal, ProofState, ProofStep } from "./proofState";
import { applyRewriteOnce, simplify, type RewriteRule, type RuleTag } from "./rewrite";
import { comp, productProjection, type Equation, type ProductDecl, type Term } from "./syntax";
import { inferTerm, typecheckEquation } from "./typecheck";

interface TacticComputation {
  equation: Equation;
  ruleIds: string[];
}

export interface TacticResult {
  state: ProofState;
  goal: Goal;
  step: ProofStep;
}

export function runTactic(state: ProofState, goalId: string, tactic: string, rules: RewriteRule[] = []): TacticResult {
  const goal = state.goals.find((candidate) => candidate.id === goalId);
  if (!goal) {
    throw new Error(`Unknown goal: ${goalId}`);
  }
  if (goal.status === "proved") {
    throw new Error(`Goal is already proved: ${goalId}`);
  }

  const command = tactic.trim();
  const before = goal.equation;

  let after: Equation;
  let message: string;
  let ruleIds: string[] = [];
  let closed = false;
  let extraGoals: Goal[] = [];
  let activeGoalId = state.activeGoalId;

  if (command === "normalize") {
    after = normalizeEquation(state, before);
    closed = equationsEqual(after);
    message = closed ? "normalized and closed the goal" : "normalized both sides";
  } else if (command === "simp") {
    const result = simplifyEquation(state, before, generatedRules(state.context, rules));
    after = result.equation;
    ruleIds = result.ruleIds;
    closed = equationsEqual(after);
    message = closed
      ? closeMessage("simplified and closed the goal", ruleIds)
      : progressMessage("simplified both sides", ruleIds);
  } else if (command === "try") {
    const result = tryEquation(state, before, generatedRules(state.context, rules));
    after = result.equation;
    ruleIds = result.ruleIds;
    closed = equationsEqual(after);
    message = closed
      ? closeMessage("try closed the goal", ruleIds)
      : progressMessage("try could not close the goal", ruleIds);
  } else if (command.startsWith("product_ext ")) {
    const productName = command.slice("product_ext ".length).trim();
    const result = splitProductExtGoals(state, goal, productName);
    after = before;
    extraGoals = result.goals;
    activeGoalId = result.goals[0]?.id ?? activeGoalId;
    message = `split by product_ext ${productName} into ${result.goals.map((child) => child.id).join(" and ")}`;
  } else if (command.startsWith("rw ")) {
    const ruleName = command.slice(3).trim();
    after = rewriteEquationOnce(state, before, ruleName, generatedRules(state.context, rules));
    closed = equationsEqual(after);
    message = closed ? `rewrote with ${ruleName} and closed the goal` : `rewrote with ${ruleName}`;
  } else if (command.startsWith("naturality ")) {
    const ruleName = parseNaturalityRuleName(command);
    after = rewriteEquationOnce(state, before, ruleName, generatedRules(state.context, rules));
    closed = equationsEqual(after);
    message = closed
      ? `applied naturality of ${ruleName} and closed the goal`
      : `applied naturality of ${ruleName}`;
  } else {
    throw new Error(`Unsupported tactic: ${tactic}`);
  }

  const updatedGoal: Goal = {
    ...goal,
    equation: after,
    status: closed ? "proved" : goal.status,
    proofSteps: [
      ...goal.proofSteps,
      {
        id: `step-${state.proofLog.length + 1}`,
        goalId,
        tactic: command,
        before,
        after,
        message
      }
    ]
  };
  const step = updatedGoal.proofSteps[updatedGoal.proofSteps.length - 1];

  return {
    state: {
      ...state,
      goals: [...state.goals.map((candidate) => (candidate.id === goalId ? updatedGoal : candidate)), ...extraGoals],
      activeGoalId,
      proofLog: [...state.proofLog, step]
    },
    goal: updatedGoal,
    step
  };
}

function normalizeEquation(state: ProofState, equation: Equation): Equation {
  return typecheckEquation(
    state.context,
    normalizeTerm(state.context, equation.lhs),
    normalizeTerm(state.context, equation.rhs)
  );
}

function simplifyEquation(state: ProofState, equation: Equation, rules: RewriteRule[]): TacticComputation {
  return simplifyEquationWithTags(state, equation, rules, ["simp"]);
}

function tryEquation(state: ProofState, equation: Equation, rules: RewriteRule[]): TacticComputation {
  const first = simplifyEquationWithTags(state, normalizeEquation(state, equation), rules, ["simp", "naturality"]);
  const second = simplifyEquationWithTags(state, normalizeEquation(state, first.equation), rules, [
    "simp",
    "naturality"
  ]);

  return {
    equation: second.equation,
    ruleIds: [...first.ruleIds, ...second.ruleIds]
  };
}

function splitProductExtGoals(
  state: ProofState,
  goal: Goal,
  productName: string
): { goals: Goal[] } {
  const product = requireProductDecl(state, productName);
  const hom = inferTerm(state.context, goal.equation.lhs);
  if (!equalObject(hom.target, product.product)) {
    throw new Error(`product_ext ${productName} applies only to goals whose target is ${productName}.`);
  }
  if (state.goals.some((candidate) => candidate.parentGoalId === goal.id)) {
    throw new Error(`Goal ${goal.id} already has subgoals.`);
  }

  return {
    goals: [
      productExtGoal(state, goal, product, "left"),
      productExtGoal(state, goal, product, "right")
    ]
  };
}

function productExtGoal(state: ProofState, goal: Goal, product: ProductDecl, side: "left" | "right"): Goal {
  const projection = productProjection(product.product, side);
  const equation = typecheckEquation(
    state.context,
    comp(goal.equation.lhs, projection),
    comp(goal.equation.rhs, projection)
  );
  const suffix = side === "left" ? "pi1" : "pi2";

  return {
    id: `${goal.id}.${suffix}`,
    equation,
    status: "open",
    proofSteps: [],
    parentGoalId: goal.id,
    completion: {
      kind: "productExt",
      productName: product.product.name,
      side
    }
  };
}

function simplifyEquationWithTags(
  state: ProofState,
  equation: Equation,
  rules: RewriteRule[],
  tags: RuleTag[]
): TacticComputation {
  const lhs = simplify(state.context, equation.lhs, rules, { tags });
  const rhs = simplify(state.context, equation.rhs, rules, { tags });

  return {
    equation: typecheckEquation(state.context, lhs.term, rhs.term),
    ruleIds: [...lhs.steps.map((step) => step.rule.id), ...rhs.steps.map((step) => step.rule.id)]
  };
}

function rewriteEquationOnce(state: ProofState, equation: Equation, ruleName: string, rules: RewriteRule[]): Equation {
  const rule = rules.find((candidate) => candidate.id === ruleName || candidate.name === ruleName);
  if (!rule) {
    throw new Error(`Unknown rewrite rule: ${ruleName}`);
  }

  const lhs = rewriteTermOnce(equation.lhs, rule);
  const rhs = equalTerm(lhs, equation.lhs) ? rewriteTermOnce(equation.rhs, rule) : equation.rhs;

  return typecheckEquation(state.context, lhs, rhs);
}

function rewriteTermOnce(term: Term, rule: RewriteRule): Term {
  return applyRewriteOnce(term, [rule])?.term ?? term;
}

function requireProductDecl(state: ProofState, name: string): ProductDecl {
  const decl = state.context.decls.find(
    (candidate): candidate is ProductDecl => candidate.kind === "productDecl" && candidate.product.name === name
  );
  if (!decl) {
    throw new Error(`Unknown product: ${name}`);
  }
  return decl;
}

export function completeGoalByProductExt(state: ProofState, goalId = rootGoalId(state)): TacticResult {
  if (!goalId) {
    throw new Error("No goal to complete by product extensionality.");
  }

  const goal = state.goals.find((candidate) => candidate.id === goalId);
  if (!goal) {
    throw new Error(`Unknown goal: ${goalId}`);
  }
  if (goal.status === "proved") {
    throw new Error(`Goal is already proved: ${goalId}`);
  }

  const children = state.goals.filter(
    (candidate) => candidate.parentGoalId === goalId && candidate.completion?.kind === "productExt"
  );
  if (children.length !== 2) {
    throw new Error(`Goal ${goalId} does not have product_ext subgoals.`);
  }

  const openChildren = children.filter((child) => child.status !== "proved");
  if (openChildren.length > 0) {
    throw new Error(`Cannot complete product_ext with open subgoals: ${openChildren.map((child) => child.id).join(", ")}`);
  }

  const productNames = [...new Set(children.map((child) => child.completion?.productName).filter(Boolean))];
  const productName = productNames[0] ?? "product";
  const step: ProofStep = {
    id: `step-${state.proofLog.length + 1}`,
    goalId,
    tactic: `complete product_ext ${productName}`,
    before: goal.equation,
    after: goal.equation,
    message: `completed by product extensionality using ${children.map((child) => child.id).join(" and ")}`
  };
  const updatedGoal: Goal = {
    ...goal,
    status: "proved",
    proofSteps: [...goal.proofSteps, step]
  };
  const updatedState: ProofState = {
    ...state,
    goals: state.goals.map((candidate) => (candidate.id === goalId ? updatedGoal : candidate)),
    activeGoalId: goalId,
    proofLog: [...state.proofLog, step]
  };

  return {
    state: updatedState,
    goal: updatedGoal,
    step
  };
}

function rootGoalId(state: ProofState): string | undefined {
  return state.goals.find((goal) => !goal.parentGoalId)?.id ?? state.activeGoalId;
}

function equationsEqual(equation: Equation): boolean {
  return equalTerm(equation.lhs, equation.rhs);
}

function closeMessage(base: string, ruleIds: string[]): string {
  return ruleIds.length ? `${base} using ${formatRuleIds(ruleIds)}` : base;
}

function progressMessage(base: string, ruleIds: string[]): string {
  return ruleIds.length ? `${base}; used ${formatRuleIds(ruleIds)}` : base;
}

function formatRuleIds(ruleIds: string[]): string {
  return [...new Set(ruleIds)].join(", ");
}

function parseNaturalityRuleName(command: string): string {
  const match = /^naturality\s+([A-Za-z][A-Za-z0-9_]*)\s+at\s+([A-Za-z][A-Za-z0-9_]*)$/.exec(command);
  if (!match) {
    throw new Error(`Unsupported naturality tactic: ${command}`);
  }

  return `${match[1]}.naturality.${match[2]}`;
}
