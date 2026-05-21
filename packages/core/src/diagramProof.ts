import { regionEquation, type Diagram, type DiagramArrow, type DiagramNode, type DiagramRegion } from "./diagram";
import { equalObject } from "./equality";
import { createGoal, createProofState, type Goal, type ProofState, type ProofStep } from "./proofState";
import { runTactic } from "./tactics";
import { productProjection, type Context, type Equation, type ObjectExpr, type ProductDecl } from "./syntax";
import { termPattern, type PatternTerm, type RewriteRule } from "./rewrite";
import { prettyObject, prettyTerm } from "./pretty";

export interface DiagramProofState {
  diagram: Diagram;
  outerGoalRegionId: string;
  subgoals: DiagramSubgoal[];
  provedRegionIds: string[];
  completion?: DiagramCompletion;
}

export type DiagramCompletion = ProductExtDiagramCompletion;

export interface ProductExtDiagramCompletion {
  kind: "productExt";
  productName: string;
  parentGoalId: string;
}

export interface DiagramSubgoal {
  id: string;
  regionId: string;
  label?: string;
  leftPath: string[];
  rightPath: string[];
  originalEquation: Equation;
  equation: Equation;
  status: "open" | "proved" | "failed";
  proofSteps: ProofStep[];
}

export interface DiagramSubgoalInput {
  id?: string;
  label?: string;
  leftPath: string[];
  rightPath: string[];
}

export interface DiagramCompletionResult {
  proofState: ProofState;
  diagramProofState: DiagramProofState;
  goal: Goal;
  step: ProofStep;
}

export function createDiagramProofState(diagram: Diagram, outerGoalRegionId = diagram.regions[0]?.id): DiagramProofState {
  if (!outerGoalRegionId) {
    throw new Error("A diagram proof state needs an outer goal region.");
  }

  return {
    diagram,
    outerGoalRegionId,
    subgoals: [],
    provedRegionIds: []
  };
}

export function createSubgoalFromPaths(
  ctx: Context,
  state: DiagramProofState,
  input: DiagramSubgoalInput
): DiagramProofState {
  const id = input.id?.trim() || `subgoal-${state.subgoals.length + 1}`;
  if (state.subgoals.some((subgoal) => subgoal.id === id)) {
    throw new Error(`Diagram subgoal already exists: ${id}`);
  }

  const regionId = `${id}-region`;
  const equation = regionEquation(ctx, state.diagram, input.leftPath, input.rightPath);
  const subgoal: DiagramSubgoal = {
    id,
    regionId,
    label: input.label,
    leftPath: [...input.leftPath],
    rightPath: [...input.rightPath],
    originalEquation: equation,
    equation,
    status: "open",
    proofSteps: []
  };

  return {
    ...state,
    diagram: {
      ...state.diagram,
      regions: [
        ...state.diagram.regions,
        {
          id: regionId,
          label: input.label ?? id,
          leftPath: subgoal.leftPath,
          rightPath: subgoal.rightPath,
          goalId: id
        }
      ]
    },
    subgoals: [...state.subgoals, subgoal]
  };
}

export function createSubgoalFromRegion(ctx: Context, state: DiagramProofState, regionId: string): DiagramProofState {
  const region = state.diagram.regions.find((candidate) => candidate.id === regionId) ?? splittableRegions(state).find((candidate) => candidate.id === regionId);
  if (!region) {
    throw new Error(`Unknown diagram region: ${regionId}`);
  }

  const stateWithRegion = ensureDiagramRegion(state, region);

  if (stateWithRegion.subgoals.some((subgoal) => subgoal.regionId === region.id)) {
    return stateWithRegion;
  }

  return appendSubgoal(ctx, stateWithRegion, region.id, {
    id: region.goalId ?? region.id,
    label: region.label,
    leftPath: region.leftPath,
    rightPath: region.rightPath
  });
}

export function splitDiagramGoal(ctx: Context, state: DiagramProofState): DiagramProofState {
  return splittableRegions(state).reduce(
    (current, region) => createSubgoalFromRegion(ctx, ensureDiagramRegion(current, region), region.id),
    state
  );
}

export function splitDiagramGoalByProductExt(
  ctx: Context,
  state: DiagramProofState,
  productName: string,
  parentGoalId = "goal-1"
): DiagramProofState {
  if (state.completion) {
    throw new Error("The diagram goal has already been split by a completion principle.");
  }

  const product = requireProductDecl(ctx, productName);
  const outer = state.diagram.regions.find((region) => region.id === state.outerGoalRegionId);
  if (!outer) {
    throw new Error("No outer goal region is available.");
  }

  const productNodeId = pathEnd(state.diagram, outer.leftPath);
  const productNode = state.diagram.nodes.find((node) => node.id === productNodeId);
  if (!productNode || !equalObject(productNode.object, product.product)) {
    throw new Error(`product_ext ${productName} applies only to goals whose target is ${productName}.`);
  }

  const leftProjection = ensureProjection(state.diagram, product, productNodeId, "left");
  const rightProjection = ensureProjection(leftProjection.diagram, product, productNodeId, "right");
  const pi1Region: DiagramRegion = {
    id: `${outer.id}-pi1`,
    label: `${product.product.name} projection 1`,
    leftPath: [...outer.leftPath, leftProjection.arrowId],
    rightPath: [...outer.rightPath, leftProjection.arrowId],
    goalId: `${parentGoalId}.pi1`
  };
  const pi2Region: DiagramRegion = {
    id: `${outer.id}-pi2`,
    label: `${product.product.name} projection 2`,
    leftPath: [...outer.leftPath, rightProjection.arrowId],
    rightPath: [...outer.rightPath, rightProjection.arrowId],
    goalId: `${parentGoalId}.pi2`
  };
  const withRegions: DiagramProofState = {
    ...state,
    diagram: {
      ...rightProjection.diagram,
      regions: [...rightProjection.diagram.regions, pi1Region, pi2Region]
    },
    completion: {
      kind: "productExt",
      productName: product.product.name,
      parentGoalId
    }
  };

  return createSubgoalFromRegion(ctx, createSubgoalFromRegion(ctx, withRegions, pi1Region.id), pi2Region.id);
}

export function splittableRegions(state: DiagramProofState): DiagramRegion[] {
  const subgoalRegionIds = new Set(state.subgoals.map((subgoal) => subgoal.regionId));
  const declaredRegions = state.diagram.regions.filter(
    (region) => region.id !== state.outerGoalRegionId && !subgoalRegionIds.has(region.id)
  );
  const declaredRegionIds = new Set(state.diagram.regions.map((region) => region.id));
  const inferredRegions = auxiliarySplitRegions(state).filter(
    (region) => !declaredRegionIds.has(region.id) && !subgoalRegionIds.has(region.id)
  );

  return [...declaredRegions, ...inferredRegions];
}

function ensureDiagramRegion(state: DiagramProofState, region: DiagramRegion): DiagramProofState {
  if (state.diagram.regions.some((candidate) => candidate.id === region.id)) {
    return state;
  }

  return {
    ...state,
    diagram: {
      ...state.diagram,
      regions: [...state.diagram.regions, region]
    }
  };
}

function auxiliarySplitRegions(state: DiagramProofState): DiagramRegion[] {
  const outer = state.diagram.regions.find((region) => region.id === state.outerGoalRegionId);
  if (!outer) {
    return [];
  }

  const leftBoundaries = pathBoundaries(state.diagram, outer.leftPath);
  const rightBoundaries = pathBoundaries(state.diagram, outer.rightPath);
  const outerArrowIds = new Set([...outer.leftPath, ...outer.rightPath]);

  return state.diagram.arrows.flatMap((arrow) => {
    if (arrow.status !== "auxiliary" || outerArrowIds.has(arrow.id)) {
      return [];
    }

    const leftFromIndex = leftBoundaries.indexOf(arrow.from);
    const leftToIndex = leftBoundaries.indexOf(arrow.to);
    const rightFromIndex = rightBoundaries.indexOf(arrow.from);
    const rightToIndex = rightBoundaries.indexOf(arrow.to);

    if (rightFromIndex > 0 && rightFromIndex < rightBoundaries.length - 1 && leftToIndex > 0 && leftToIndex < leftBoundaries.length - 1) {
      return [
        {
          id: `${arrow.id}-upper`,
          label: `${arrow.id} upper`,
          leftPath: outer.leftPath.slice(0, leftToIndex),
          rightPath: [...outer.rightPath.slice(0, rightFromIndex), arrow.id]
        },
        {
          id: `${arrow.id}-lower`,
          label: `${arrow.id} lower`,
          leftPath: [arrow.id, ...outer.leftPath.slice(leftToIndex)],
          rightPath: outer.rightPath.slice(rightFromIndex)
        }
      ];
    }

    if (leftFromIndex > 0 && leftFromIndex < leftBoundaries.length - 1 && rightToIndex > 0 && rightToIndex < rightBoundaries.length - 1) {
      return [
        {
          id: `${arrow.id}-upper`,
          label: `${arrow.id} upper`,
          leftPath: [...outer.leftPath.slice(0, leftFromIndex), arrow.id],
          rightPath: outer.rightPath.slice(0, rightToIndex)
        },
        {
          id: `${arrow.id}-lower`,
          label: `${arrow.id} lower`,
          leftPath: outer.leftPath.slice(leftFromIndex),
          rightPath: [arrow.id, ...outer.rightPath.slice(rightToIndex)]
        }
      ];
    }

    return [];
  });
}

function pathBoundaries(diagram: Diagram, path: string[]): string[] {
  if (path.length === 0) {
    return [];
  }

  const arrows = path.map((arrowId) => {
    const arrow = diagram.arrows.find((candidate) => candidate.id === arrowId);
    if (!arrow) {
      throw new Error(`Unknown arrow: ${arrowId}`);
    }
    return arrow;
  });

  return [arrows[0].from, ...arrows.map((arrow) => arrow.to)];
}

function pathEnd(diagram: Diagram, path: string[]): string {
  const arrowId = path.at(-1);
  if (!arrowId) {
    throw new Error("A path must contain at least one arrow.");
  }
  const arrow = diagram.arrows.find((candidate) => candidate.id === arrowId);
  if (!arrow) {
    throw new Error(`Unknown arrow: ${arrowId}`);
  }
  return arrow.to;
}

function ensureProjection(
  diagram: Diagram,
  product: ProductDecl,
  productNodeId: string,
  side: "left" | "right"
): { diagram: Diagram; arrowId: string } {
  const targetObject = side === "left" ? product.left : product.right;
  const existingTarget = diagram.nodes.find((node) => equalObject(node.object, targetObject));
  const targetNode = existingTarget ?? projectionNode(diagram, productNodeId, targetObject, side);
  const arrowId = `${product.product.name}-${side === "left" ? "pi1" : "pi2"}`;

  if (diagram.arrows.some((arrow) => arrow.id === arrowId)) {
    return { diagram, arrowId };
  }

  const term = productProjection(product.product, side);
  const arrow: DiagramArrow = {
    id: arrowId,
    from: productNodeId,
    to: targetNode.id,
    label: prettyTerm(term),
    term,
    status: "constructed"
  };

  return {
    diagram: {
      ...diagram,
      nodes: existingTarget ? diagram.nodes : [...diagram.nodes, targetNode],
      arrows: [...diagram.arrows, arrow]
    },
    arrowId
  };
}

function projectionNode(
  diagram: Diagram,
  productNodeId: string,
  object: ObjectExpr,
  side: "left" | "right"
): DiagramNode {
  const productNode = diagram.nodes.find((node) => node.id === productNodeId);
  const base = productNode?.position ?? { x: 415, y: 155 };

  return {
    id: uniqueNodeId(diagram, `${objectLabel(object)}-${side === "left" ? "factor-1" : "factor-2"}`),
    label: prettyObject(object),
    object,
    position: {
      x: base.x + 120,
      y: base.y + (side === "left" ? -72 : 72)
    },
    status: "constructed"
  };
}

function uniqueNodeId(diagram: Diagram, base: string): string {
  const normalized = base.replace(/\s+/g, "-").toLowerCase();
  if (!diagram.nodes.some((node) => node.id === normalized)) {
    return normalized;
  }
  let index = 2;
  while (diagram.nodes.some((node) => node.id === `${normalized}-${index}`)) {
    index += 1;
  }
  return `${normalized}-${index}`;
}

function requireProductDecl(ctx: Context, name: string): ProductDecl {
  const decl = ctx.decls.find(
    (candidate): candidate is ProductDecl => candidate.kind === "productDecl" && candidate.product.name === name
  );
  if (!decl) {
    throw new Error(`Unknown product: ${name}`);
  }
  return decl;
}

function objectLabel(object: ObjectExpr): string {
  switch (object.kind) {
    case "object":
      return object.name;
    case "functorObject":
      return `${object.functor.name} ${objectLabel(object.object)}`;
  }
}

function appendSubgoal(
  ctx: Context,
  state: DiagramProofState,
  regionId: string,
  input: DiagramSubgoalInput
): DiagramProofState {
  const id = input.id?.trim() || `subgoal-${state.subgoals.length + 1}`;
  if (state.subgoals.some((subgoal) => subgoal.id === id)) {
    throw new Error(`Diagram subgoal already exists: ${id}`);
  }

  const equation = regionEquation(ctx, state.diagram, input.leftPath, input.rightPath);
  const subgoal: DiagramSubgoal = {
    id,
    regionId,
    label: input.label,
    leftPath: [...input.leftPath],
    rightPath: [...input.rightPath],
    originalEquation: equation,
    equation,
    status: "open",
    proofSteps: []
  };

  return {
    ...state,
    diagram: {
      ...state.diagram,
      regions: state.diagram.regions.map((region) =>
        region.id === regionId ? { ...region, goalId: id } : region
      )
    },
    subgoals: [...state.subgoals, subgoal]
  };
}

export function diagramSubgoalRules(state: DiagramProofState): RewriteRule[] {
  return state.subgoals.filter((subgoal) => subgoal.status === "proved").flatMap((subgoal) => {
    const directRule: RewriteRule = {
      id: subgoal.id,
      name: subgoal.label ?? subgoal.id,
      lhs: subgoal.originalEquation.lhs,
      rhs: subgoal.originalEquation.rhs,
      tags: ["simp", "user"] as const
    };
    const tailRule = tailRewriteRule(subgoal);

    return tailRule ? [directRule, tailRule] : [directRule];
  });
}

function tailRewriteRule(subgoal: DiagramSubgoal): RewriteRule | undefined {
  const lhsTerms = flattenCompPattern(subgoal.originalEquation.lhs);
  const rhsTerms = flattenCompPattern(subgoal.originalEquation.rhs);

  if (lhsTerms.length < 2) {
    return undefined;
  }

  const tail = termPattern("tail");
  return {
    id: `${subgoal.id}.tail`,
    name: `${subgoal.label ?? subgoal.id} with tail`,
    lhs: rightAssociatePattern([...lhsTerms, tail]),
    rhs: rightAssociatePattern([...rhsTerms, tail]),
    tags: ["simp", "user"]
  };
}

function flattenCompPattern(term: PatternTerm): PatternTerm[] {
  return term.kind === "comp" ? [...flattenCompPattern(term.first), ...flattenCompPattern(term.second)] : [term];
}

function rightAssociatePattern(terms: PatternTerm[]): PatternTerm {
  if (terms.length === 0) {
    throw new Error("Cannot build an empty rewrite pattern.");
  }

  return terms
    .slice()
    .reverse()
    .reduce<PatternTerm | undefined>(
      (rest, term) => (rest ? { kind: "comp", first: term, second: rest } : term),
      undefined
    ) as PatternTerm;
}

export function proveDiagramSubgoal(
  ctx: Context,
  state: DiagramProofState,
  subgoalId: string,
  tactic: string,
  rules: RewriteRule[] = []
): DiagramProofState {
  const subgoal = state.subgoals.find((candidate) => candidate.id === subgoalId);
  if (!subgoal) {
    throw new Error(`Unknown diagram subgoal: ${subgoalId}`);
  }
  if (subgoal.status === "proved") {
    throw new Error(`Diagram subgoal is already proved: ${subgoalId}`);
  }

  const proofState = {
    ...createProofState(ctx, [
      {
        ...createGoal(subgoal.id, subgoal.equation),
        proofSteps: subgoal.proofSteps
      }
    ]),
    proofLog: subgoal.proofSteps
  };
  const result = runTactic(proofState, subgoal.id, tactic, rules);
  const updatedGoal = result.goal;
  const updatedSubgoal: DiagramSubgoal = {
    ...subgoal,
    equation: updatedGoal.equation,
    status: updatedGoal.status,
    proofSteps: updatedGoal.proofSteps
  };
  const provedRegionIds =
    updatedSubgoal.status === "proved" && !state.provedRegionIds.includes(subgoal.regionId)
      ? [...state.provedRegionIds, subgoal.regionId]
      : state.provedRegionIds;

  return {
    ...state,
    subgoals: state.subgoals.map((candidate) => (candidate.id === subgoalId ? updatedSubgoal : candidate)),
    provedRegionIds
  };
}

export function completeDiagramGoalBySubgoals(
  ctx: Context,
  state: DiagramProofState,
  proofState: ProofState,
  goalId = proofState.activeGoalId,
  rules: RewriteRule[] = []
): DiagramCompletionResult {
  if (!goalId) {
    throw new Error("No active goal to complete.");
  }

  if (state.subgoals.length === 0) {
    throw new Error("No diagram subgoals are available for pasting.");
  }

  const openSubgoals = state.subgoals.filter((subgoal) => subgoal.status !== "proved");
  if (openSubgoals.length > 0) {
    throw new Error(`Cannot paste with open subgoals: ${openSubgoals.map((subgoal) => subgoal.id).join(", ")}`);
  }

  if (state.completion?.kind === "productExt") {
    const goal = proofState.goals.find((candidate) => candidate.id === goalId);
    if (!goal) {
      throw new Error(`Unknown goal: ${goalId}`);
    }

    const productSubgoals = state.subgoals.filter((subgoal) => subgoal.id.startsWith(`${goalId}.pi`));
    const step: ProofStep = {
      id: `step-${proofState.proofLog.length + 1}`,
      goalId,
      tactic: `complete product_ext ${state.completion.productName}`,
      before: goal.equation,
      after: goal.equation,
      message: `completed by product extensionality using ${productSubgoals.map((subgoal) => subgoal.id).join(" and ")}`
    };
    const completedGoal: Goal = {
      ...goal,
      status: "proved",
      proofSteps: [...goal.proofSteps, step]
    };
    const provedRegionIds = state.provedRegionIds.includes(state.outerGoalRegionId)
      ? state.provedRegionIds
      : [...state.provedRegionIds, state.outerGoalRegionId];

    return {
      proofState: {
        ...proofState,
        goals: proofState.goals.map((candidate) => (candidate.id === goalId ? completedGoal : candidate)),
        activeGoalId: goalId,
        proofLog: [...proofState.proofLog, step]
      },
      diagramProofState: {
        ...state,
        provedRegionIds
      },
      goal: completedGoal,
      step
    };
  }

  const result = runTactic({ ...proofState, context: ctx }, goalId, "try", [...rules, ...diagramSubgoalRules(state)]);
  if (result.goal.status !== "proved") {
    throw new Error("Pasting did not close the diagram goal.");
  }

  const pastedSubgoals = state.subgoals.map((subgoal) => subgoal.label ?? subgoal.id);
  const step: ProofStep = {
    ...result.step,
    tactic: "pasting",
    message: `completed by pasting ${pastedSubgoals.join(" and ")}`
  };
  const goal: Goal = {
    ...result.goal,
    proofSteps: [...result.goal.proofSteps.slice(0, -1), step]
  };
  const updatedProofState: ProofState = {
    ...result.state,
    goals: result.state.goals.map((candidate) => (candidate.id === goalId ? goal : candidate)),
    proofLog: [...result.state.proofLog.slice(0, -1), step]
  };
  const provedRegionIds = state.provedRegionIds.includes(state.outerGoalRegionId)
    ? state.provedRegionIds
    : [...state.provedRegionIds, state.outerGoalRegionId];

  return {
    proofState: updatedProofState,
    diagramProofState: {
      ...state,
      provedRegionIds
    },
    goal,
    step
  };
}
