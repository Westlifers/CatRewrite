import type { Context, Equation } from "./syntax";

export interface Goal {
  id: string;
  equation: Equation;
  status: "open" | "proved" | "failed";
  proofSteps: ProofStep[];
  parentGoalId?: string;
  completion?: GoalCompletion;
}

export type GoalCompletion = ProductExtCompletion;

export interface ProductExtCompletion {
  kind: "productExt";
  productName: string;
  side: "left" | "right";
}

export interface ProofStep {
  id: string;
  goalId: string;
  tactic: string;
  before: Equation;
  after?: Equation;
  message: string;
}

export interface ProofState {
  context: Context;
  goals: Goal[];
  activeGoalId?: string;
  proofLog: ProofStep[];
}

export function createGoal(id: string, equation: Equation): Goal {
  return {
    id,
    equation,
    status: "open",
    proofSteps: []
  };
}

export function createProofState(context: Context, goals: Goal[]): ProofState {
  return {
    context,
    goals,
    activeGoalId: goals[0]?.id,
    proofLog: []
  };
}
