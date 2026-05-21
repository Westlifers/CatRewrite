import { equalTerm } from "./equality";
import { generatedRules } from "./inspect";
import { normalizeTerm } from "./normalize";
import type { Goal, ProofState, ProofStep } from "./proofState";
import { applyRewriteOnce, simplify, type RewriteRule } from "./rewrite";
import { type Equation, type Term } from "./syntax";
import { typecheckEquation } from "./typecheck";

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

  const command = tactic.trim();
  const before = goal.equation;

  let after: Equation;
  let message: string;

  if (command === "normalize") {
    after = normalizeEquation(state, before);
    message = equationsEqual(after) ? "normalized and closed the goal" : "normalized both sides";
  } else if (command === "simp") {
    after = simplifyEquation(state, before, generatedRules(state.context, rules));
    message = equationsEqual(after) ? "simplified and closed the goal" : "simplified both sides";
  } else if (command === "try") {
    after = simplifyEquation(state, normalizeEquation(state, before), generatedRules(state.context, rules));
    message = equationsEqual(after) ? "try closed the goal" : "try could not close the goal";
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

function simplifyEquation(state: ProofState, equation: Equation, rules: RewriteRule[]): Equation {
  const lhs = simplify(state.context, equation.lhs, rules).term;
  const rhs = simplify(state.context, equation.rhs, rules).term;

  return typecheckEquation(state.context, lhs, rhs);
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

function parseNaturalityRuleName(command: string): string {
  const match = /^naturality\s+([A-Za-z][A-Za-z0-9_]*)\s+at\s+([A-Za-z][A-Za-z0-9_]*)$/.exec(command);
  if (!match) {
    throw new Error(`Unsupported naturality tactic: ${command}`);
  }

  return `${match[1]}.naturality.${match[2]}`;
}
