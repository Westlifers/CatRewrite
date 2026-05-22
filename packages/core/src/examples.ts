import { createGoal, createIsoGoal, createProofState, type ProofState } from "./proofState";
import { isIsoGoalText, parseContext, parseEquation, parseIsoGoal } from "./parser";
import { runTactic } from "./tactics";
import { typecheckEquation } from "./typecheck";

export interface ProofExample {
  id: string;
  title: string;
  summary: string;
  explanation: string;
  contextText: string;
  goalText: string;
  tacticText: string;
  provesWithTactic?: boolean;
}

const adjunctionContext = `category C
category D

object X : C
object X2 : C
object Y : D

functor F : C -> D
functor G : D -> C

adjunction adj : F -| G

morphism f : F X -> Y
morphism u : X -> X2`;

const productContext = `category C

object W : C
object X : C
object A : C
object B : C

product P of A B

morphism h : W -> X
morphism f : X -> A
morphism g : X -> B`;

const terminalProductContext = `category C

object A : C
terminal One : C

product P of One A`;

export const proofExamples: ProofExample[] = [
  {
    id: "transpose-counit",
    title: "Transpose then untranspose",
    summary: "Shows that transposing f : F X -> Y and then untransposing gives f back.",
    explanation:
      "The term eta(adj, X) >> G.map(f) is the transpose of f. Applying F.map to it and then composing with eps(adj, Y) untransposes it. When you click Prove, the try tactic first normalizes F.map over composition, rewrites the counit naturality square for f, then uses the left triangle identity to reduce the remaining eta/eps pair to an identity. The final normalized equation is f = f.",
    contextText: adjunctionContext,
    goalText: "F.map(eta(adj, X) >> G.map(f)) >> eps(adj, Y) = f",
    tacticText: "try"
  },
  {
    id: "product-pairing-precompose",
    title: "Pairing after precomposition",
    summary: "Proves that precomposing a pairing is the pairing of the precomposed maps.",
    explanation:
      "Run product_ext P on the main goal to add the projection arrows pi1(P) and pi2(P) to the diagram. This creates two projection subgoals. Prove each with try, then use Complete Goal to close the original equality by product extensionality.",
    contextText: productContext,
    goalText: "h >> <f, g> = <h >> f, h >> g>",
    tacticText: "product_ext P",
    provesWithTactic: false
  },
  {
    id: "terminal-product-right-unitor",
    title: "1 x A is iso to A",
    summary: "Splits the canonical inverse pair into the two equations that witness an isomorphism.",
    explanation:
      "The projection pi2(P) : 1 x A -> A has inverse <terminalMap(One, A), id(A)> : A -> 1 x A. Run iso pi2(P) with <terminalMap(One, A), id(A)> to create the two inverse-law subgoals. The left-inverse subgoal needs product_ext P; its pi1 part closes by terminal_ext One and its pi2 part closes by try. The right-inverse subgoal closes by try.",
    contextText: terminalProductContext,
    goalText: "iso pi2(P) with <terminalMap(One, A), id(A)>",
    tacticText: "iso",
    provesWithTactic: false
  }
];

export function buildExampleState(example: ProofExample): ProofState {
  const context = parseContext(example.contextText);
  if (isIsoGoalText(example.goalText)) {
    const target = parseIsoGoal(example.goalText, context);
    return createProofState(context, [createIsoGoal("goal-1", target, typecheckEquation(context, target.forward, target.forward))]);
  }

  const equation = parseEquation(example.goalText, context);

  return createProofState(context, [createGoal("goal-1", equation)]);
}

export function runExample(example: ProofExample): ProofState {
  const state = buildExampleState(example);
  const activeGoalId = state.activeGoalId;
  if (!activeGoalId) {
    throw new Error("Example did not create an active goal.");
  }

  return runTactic(state, activeGoalId, example.tacticText).state;
}
