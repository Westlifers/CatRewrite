import type { Context, Equation, HomType, Term } from "./syntax";

export interface Goal {
  id: string;
  target: GoalTarget;
  equation: Equation;
  status: "open" | "proved" | "failed";
  proofSteps: ProofStep[];
  parentGoalId?: string;
  completion?: GoalCompletion;
}

export type GoalTarget = EquationTarget | IsoTarget;

export interface EquationTarget {
  kind: "equation";
  equation: Equation;
}

export interface IsoTarget {
  kind: "iso";
  forward: Term;
  inverse: Term;
  hom: HomType;
}

export type GoalCompletion = ProductExtCompletion | IsoCompletion;

export interface ProductExtCompletion {
  kind: "productExt";
  productName: string;
  side: "left" | "right";
}

export interface IsoCompletion {
  kind: "iso";
  side: "leftInverse" | "rightInverse";
  forwardName: string;
  inverseName: string;
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
    target: { kind: "equation", equation },
    equation,
    status: "open",
    proofSteps: []
  };
}

export function createIsoGoal(id: string, target: IsoTarget, carrierEquation: Equation): Goal {
  return {
    id,
    target,
    equation: carrierEquation,
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
