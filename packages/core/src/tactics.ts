import { equalTerm } from "./equality";
import { generatedRules } from "./inspect";
import { normalizeTerm } from "./normalize";
import type { Goal, ProofState, ProofStep } from "./proofState";
import { applyRewriteOnce, simplify, type RewriteRule, type RuleTag } from "./rewrite";
import { type Equation, type Term } from "./syntax";
import { typecheckEquation } from "./typecheck";

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

  if (command === "normalize") {
    after = normalizeEquation(state, before);
    message = equationsEqual(after) ? "normalized and closed the goal" : "normalized both sides";
  } else if (command === "simp") {
    const result = simplifyEquation(state, before, generatedRules(state.context, rules));
    after = result.equation;
    ruleIds = result.ruleIds;
    message = equationsEqual(after)
      ? closeMessage("simplified and closed the goal", ruleIds)
      : progressMessage("simplified both sides", ruleIds);
  } else if (command === "try") {
    const result = tryEquation(state, before, generatedRules(state.context, rules));
    after = result.equation;
    ruleIds = result.ruleIds;
    message = equationsEqual(after)
      ? closeMessage("try closed the goal", ruleIds)
      : progressMessage("try could not close the goal", ruleIds);
  } else if (command.startsWith("rw ")) {
    const ruleName = command.slice(3).trim();
    after = rewriteEquationOnce(state, before, ruleName, generatedRules(state.context, rules));
    message = equationsEqual(after) ? `rewrote with ${ruleName} and closed the goal` : `rewrote with ${ruleName}`;
  } else if (command.startsWith("naturality ")) {
    const ruleName = parseNaturalityRuleName(command);
    after = rewriteEquationOnce(state, before, ruleName, generatedRules(state.context, rules));
    message = equationsEqual(after)
      ? `applied naturality of ${ruleName} and closed the goal`
      : `applied naturality of ${ruleName}`;
  } else {
    throw new Error(`Unsupported tactic: ${tactic}`);
  }

  const updatedGoal: Goal = {
    ...goal,
    equation: after,
    status: equationsEqual(after) ? "proved" : goal.status,
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
      goals: state.goals.map((candidate) => (candidate.id === goalId ? updatedGoal : candidate)),
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
