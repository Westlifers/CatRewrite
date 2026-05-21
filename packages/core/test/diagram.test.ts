import { describe, expect, it } from "vitest";
import {
  addAuxiliaryArrow,
  addAuxiliaryNode,
  completeDiagramGoalBySubgoals,
  comp,
  counit,
  counitNaturalityDiagram,
  createDiagramProofState,
  createSubgoalFromRegion,
  createSubgoalFromPaths,
  diagramSubgoalRules,
  equationDiagram,
  functorObject,
  map,
  parseContext,
  parseObjectExpr,
  parseTerm,
  prettyEquation,
  prettyTerm,
  proveDiagramSubgoal,
  removeAuxiliaryArrow,
  removeAuxiliaryNode,
  regionEquation,
  parseEquation,
  runTactic,
  createGoal,
  createProofState,
  splitDiagramGoal,
  splittableRegions,
  verticalCompositeNaturalityDiagram,
  type Diagram
} from "../src";

const contextText = `
category C
category D
object X : C
object Y : D
functor F : C -> D
functor G : D -> C
adjunction adj : F -| G
morphism f : F X -> Y
`;

const verticalCompositeContext = `
category C
category D
functor F : C -> D
functor G : C -> D
functor H : C -> D
nattrans alpha : F => G
nattrans beta : G => H
object X : C
object Y : C
morphism f : X -> Y
`;

describe("diagram paths", () => {
  it("turns two explicit paths into an equation", () => {
    const ctx = parseContext(contextText);
    const F = ctx.decls.find((decl) => decl.kind === "functorDecl" && decl.functor.name === "F")?.functor;
    const G = ctx.decls.find((decl) => decl.kind === "functorDecl" && decl.functor.name === "G")?.functor;
    const adj = ctx.decls.find((decl) => decl.kind === "adjunctionDecl")?.adjunction;
    const f = ctx.decls.find((decl) => decl.kind === "morphismDecl" && decl.term.name === "f")?.term;
    if (!F || !G || !adj || !f) {
      throw new Error("Bad test setup.");
    }

    const FX = f.hom.source;
    const Y = f.hom.target;
    const GFX = functorObject(G, FX);
    const GY = functorObject(G, Y);
    const FGY = functorObject(F, GY);
    const FGFX = functorObject(F, GFX);

    const diagram: Diagram = {
      id: "counit-square",
      nodes: [
        { id: "fgfx", label: "F G F X", object: FGFX, position: { x: 0, y: 0 } },
        { id: "fgy", label: "F G Y", object: FGY, position: { x: 240, y: 0 } },
        { id: "fx", label: "F X", object: FX, position: { x: 0, y: 160 } },
        { id: "y", label: "Y", object: Y, position: { x: 240, y: 160 } }
      ],
      arrows: [
        { id: "top", from: "fgfx", to: "fgy", label: "F.map(G.map(f))", term: map(F, map(G, f)), status: "constructed" },
        { id: "right", from: "fgy", to: "y", label: "eps_Y", term: counit(adj, Y), status: "constructed" },
        { id: "left", from: "fgfx", to: "fx", label: "eps_FX", term: counit(adj, FX), status: "constructed" },
        { id: "bottom", from: "fx", to: "y", label: "f", term: f, status: "given" }
      ],
      regions: []
    };

    const equation = regionEquation(ctx, diagram, ["top", "right"], ["left", "bottom"]);

    expect(prettyEquation(equation)).toBe("F.map(G.map(f)) >> eps(adj, Y) = eps(adj, F X) >> f");
    expect(prettyEquation({ ...equation, lhs: comp(map(F, map(G, f)), counit(adj, Y)) })).toBe(prettyEquation(equation));
  });

  it("adds only type-correct auxiliary arrows", () => {
    const ctx = parseContext(contextText);
    const diagram = counitNaturalityDiagram(ctx, "f");

    const withAuxiliary = addAuxiliaryArrow(ctx, diagram, {
      id: "diag",
      from: "fgfx",
      to: "y",
      label: "top >> right",
      term: parseTerm("F.map(G.map(f)) >> eps(adj, Y)", ctx)
    });

    expect(withAuxiliary.arrows.some((arrow) => arrow.id === "diag" && arrow.status === "auxiliary")).toBe(true);
    expect(() =>
      addAuxiliaryArrow(ctx, diagram, {
        id: "bad",
        from: "fx",
        to: "y",
        label: "bad",
        term: parseTerm("F.map(G.map(f)) >> eps(adj, Y)", ctx)
      })
    ).toThrow("Auxiliary arrow term does not match");
  });

  it("adds auxiliary nodes with typed objects", () => {
    const ctx = parseContext(contextText);
    const diagram = counitNaturalityDiagram(ctx, "f");
    const withNode = addAuxiliaryNode(diagram, {
      id: "aux-node",
      label: "G Y",
      object: parseObjectExpr("G Y", ctx)
    });

    expect(withNode.nodes.at(-1)).toMatchObject({
      id: "aux-node",
      label: "G Y",
      position: { x: 235, y: 155 },
      status: "auxiliary"
    });
    expect(() =>
      addAuxiliaryNode(withNode, {
        id: "aux-node",
        object: parseObjectExpr("X", ctx)
      })
    ).toThrow("Node already exists");
  });

  it("removes auxiliary nodes and incident auxiliary arrows", () => {
    const ctx = parseContext(contextText);
    const diagram = addAuxiliaryNode(counitNaturalityDiagram(ctx, "f"), {
      id: "aux-node",
      object: parseObjectExpr("Y", ctx)
    });
    const withArrow = addAuxiliaryArrow(ctx, diagram, {
      id: "aux-arrow",
      from: "fx",
      to: "aux-node",
      label: "f",
      term: parseTerm("f", ctx)
    });
    const removedNode = removeAuxiliaryNode(withArrow, "aux-node");

    expect(removedNode.nodes.some((node) => node.id === "aux-node")).toBe(false);
    expect(removedNode.arrows.some((arrow) => arrow.id === "aux-arrow")).toBe(false);
    expect(() => removeAuxiliaryNode(withArrow, "fx")).toThrow("Only auxiliary nodes can be removed");
    expect(() => removeAuxiliaryArrow(withArrow, "bottom")).toThrow("Only auxiliary arrows can be removed");
  });

  it("builds a diagram from the current goal equation", () => {
    const ctx = parseContext(contextText);
    const equation = parseEquation("F.map(eta(adj, X) >> G.map(f)) >> eps(adj, Y) = f", ctx);
    const diagram = equationDiagram(ctx, equation);
    const goalRegion = diagram.regions[0];
    const regenerated = regionEquation(ctx, diagram, goalRegion.leftPath, goalRegion.rightPath);

    expect(goalRegion.leftPath).toEqual(["lhs-1", "lhs-2", "lhs-3"]);
    expect(goalRegion.rightPath).toEqual(["rhs-1"]);
    expect(prettyEquation(regenerated)).toBe(
      "(F.map(eta(adj, X)) >> F.map(G.map(f))) >> eps(adj, Y) = f"
    );
  });

  it("duplicates endpoint nodes for identity endomorphism diagrams", () => {
    const ctx = parseContext(contextText);
    const equation = parseEquation("id(X) = id(X)", ctx);
    const diagram = equationDiagram(ctx, equation);
    const goalRegion = diagram.regions[0];
    const regenerated = regionEquation(ctx, diagram, goalRegion.leftPath, goalRegion.rightPath);

    expect(diagram.nodes.map((node) => node.id)).toEqual(["x", "x-target"]);
    expect(diagram.arrows.map((arrow) => [arrow.from, arrow.to])).toEqual([
      ["x", "x-target"],
      ["x", "x-target"]
    ]);
    expect(prettyEquation(regenerated)).toBe("id(X) = id(X)");
  });

  it("tracks selected paths as diagram subgoals", () => {
    const ctx = parseContext(contextText);
    const diagram = counitNaturalityDiagram(ctx, "f");
    const proofState = createDiagramProofState(diagram, "square");
    const withSubgoal = createSubgoalFromPaths(ctx, proofState, {
      leftPath: ["top", "right"],
      rightPath: ["left", "bottom"]
    });

    expect(withSubgoal.subgoals).toHaveLength(1);
    expect(withSubgoal.diagram.regions.at(-1)?.goalId).toBe("subgoal-1");
    expect(prettyEquation(withSubgoal.subgoals[0].equation)).toBe(
      "F.map(G.map(f)) >> eps(adj, Y) = eps(adj, F X) >> f"
    );
  });

  it("proves a diagram subgoal with the tactic engine", () => {
    const ctx = parseContext(contextText);
    const equation = parseEquation("F.map(eta(adj, X) >> G.map(f)) >> eps(adj, Y) = f", ctx);
    const diagram = equationDiagram(ctx, equation);
    const proofState = createSubgoalFromPaths(ctx, createDiagramProofState(diagram), {
      leftPath: diagram.regions[0].leftPath,
      rightPath: diagram.regions[0].rightPath
    });
    const proved = proveDiagramSubgoal(ctx, proofState, "subgoal-1", "try");

    expect(proved.subgoals[0].status).toBe("proved");
    expect(proved.subgoals[0].proofSteps[0].message).toContain("try closed the goal using");
    expect(proved.provedRegionIds).toEqual(["subgoal-1-region"]);
    expect(() => proveDiagramSubgoal(ctx, proved, "subgoal-1", "try")).toThrow(
      "Diagram subgoal is already proved: subgoal-1"
    );
    expect(proved.subgoals[0].proofSteps).toHaveLength(1);
  });

  it("turns proved diagram subgoals into local simplification rules", () => {
    const ctx = parseContext(contextText);
    const equation = parseEquation("F.map(eta(adj, X) >> G.map(f)) >> eps(adj, Y) = f", ctx);
    const diagram = equationDiagram(ctx, equation);
    const proofState = createSubgoalFromPaths(ctx, createDiagramProofState(diagram), {
      leftPath: diagram.regions[0].leftPath,
      rightPath: diagram.regions[0].rightPath
    });
    const proved = proveDiagramSubgoal(ctx, proofState, "subgoal-1", "try");
    const rules = diagramSubgoalRules(proved);
    const tacticResult = runTactic(
      createProofState(ctx, [createGoal("goal-1", equation)]),
      "goal-1",
      "try",
      rules
    );

    expect(rules.map((rule) => rule.id)).toEqual(["subgoal-1", "subgoal-1.tail"]);
    expect(prettyEquation(tacticResult.goal.equation)).toBe("f = f");
    expect(tacticResult.goal.status).toBe("proved");
  });

  it("proves a vertical composite naturality rectangle by splitting it into two squares", () => {
    const ctx = parseContext(verticalCompositeContext);
    const outerEquation = parseEquation("F.map(f) >> alpha_Y >> beta_Y = alpha_X >> beta_X >> H.map(f)", ctx);
    const goalDiagram = equationDiagram(ctx, outerEquation);
    const diagram = addAuxiliaryArrow(ctx, goalDiagram, {
      id: "g-mid",
      from: "rhs-node-1",
      to: "lhs-node-2",
      label: "G.map(f)",
      term: parseTerm("G.map(f)", ctx)
    });
    const withAlpha = createSubgoalFromPaths(ctx, createDiagramProofState(diagram), {
      id: "alpha-square",
      leftPath: ["lhs-1", "lhs-2"],
      rightPath: ["rhs-1", "g-mid"]
    });
    const withBeta = createSubgoalFromPaths(ctx, withAlpha, {
      id: "beta-square",
      leftPath: ["g-mid", "lhs-3"],
      rightPath: ["rhs-2", "rhs-3"]
    });
    const provedAlpha = proveDiagramSubgoal(ctx, withBeta, "alpha-square", "naturality alpha at f");
    const provedBoth = proveDiagramSubgoal(ctx, provedAlpha, "beta-square", "naturality beta at f");
    const outerResult = completeDiagramGoalBySubgoals(
      ctx,
      provedBoth,
      createProofState(ctx, [createGoal("outer-goal", outerEquation)]),
      "outer-goal"
    );

    expect(provedBoth.subgoals.map((subgoal) => subgoal.status)).toEqual(["proved", "proved"]);
    expect(prettyEquation(provedBoth.subgoals[0].originalEquation)).toBe(
      "F.map(f) >> alpha_Y = alpha_X >> G.map(f)"
    );
    expect(prettyEquation(provedBoth.subgoals[1].originalEquation)).toBe(
      "G.map(f) >> beta_Y = beta_X >> H.map(f)"
    );
    expect(outerResult.goal.status).toBe("proved");
    expect(outerResult.step.tactic).toBe("pasting");
    expect(outerResult.step.message).toBe("completed by pasting alpha-square and beta-square");
    expect(outerResult.proofState.proofLog.at(-1)).toMatchObject({
      tactic: "pasting",
      message: "completed by pasting alpha-square and beta-square"
    });
    expect(outerResult.proofState.goals[0].proofSteps.at(-1)).toMatchObject({
      tactic: "pasting",
      message: "completed by pasting alpha-square and beta-square"
    });
    expect(outerResult.diagramProofState.provedRegionIds).toEqual([
      "alpha-square-region",
      "beta-square-region",
      "goal"
    ]);
  });

  it("refuses to complete a diagram goal while a subgoal is still open", () => {
    const ctx = parseContext(verticalCompositeContext);
    const outerEquation = parseEquation("F.map(f) >> alpha_Y >> beta_Y = alpha_X >> beta_X >> H.map(f)", ctx);
    const diagram = addAuxiliaryArrow(ctx, equationDiagram(ctx, outerEquation), {
      id: "g-mid",
      from: "rhs-node-1",
      to: "lhs-node-2",
      label: "G.map(f)",
      term: parseTerm("G.map(f)", ctx)
    });
    const withAlpha = createSubgoalFromPaths(ctx, createDiagramProofState(diagram), {
      id: "alpha-square",
      leftPath: ["lhs-1", "lhs-2"],
      rightPath: ["rhs-1", "g-mid"]
    });
    const withBeta = createSubgoalFromPaths(ctx, withAlpha, {
      id: "beta-square",
      leftPath: ["g-mid", "lhs-3"],
      rightPath: ["rhs-2", "rhs-3"]
    });
    const provedAlpha = proveDiagramSubgoal(ctx, withBeta, "alpha-square", "naturality alpha at f");

    expect(() =>
      completeDiagramGoalBySubgoals(
        ctx,
        provedAlpha,
        createProofState(ctx, [createGoal("outer-goal", outerEquation)]),
        "outer-goal"
      )
    ).toThrow("Cannot paste with open subgoals: beta-square");
  });

  it("initializes the vertical composite example from only the outer goal", () => {
    const ctx = parseContext(verticalCompositeContext);
    const equation = parseEquation("F.map(f) >> alpha_Y >> beta_Y = alpha_X >> beta_X >> H.map(f)", ctx);
    const diagram = equationDiagram(ctx, equation);

    expect(diagram.arrows.map((arrow) => arrow.id)).toEqual([
      "lhs-1",
      "lhs-2",
      "lhs-3",
      "rhs-1",
      "rhs-2",
      "rhs-3"
    ]);
    expect(diagram.arrows.some((arrow) => prettyTerm(arrow.term) === "G.map(f)")).toBe(false);
    expect(diagram.regions).toHaveLength(1);
  });

  it("splits a goal diagram using an added auxiliary bridge arrow", () => {
    const ctx = parseContext(verticalCompositeContext);
    const equation = parseEquation("F.map(f) >> alpha_Y >> beta_Y = alpha_X >> beta_X >> H.map(f)", ctx);
    const diagram = addAuxiliaryArrow(ctx, equationDiagram(ctx, equation), {
      id: "g-mid",
      from: "rhs-node-1",
      to: "lhs-node-2",
      label: "G.map(f)",
      term: parseTerm("G.map(f)", ctx)
    });
    const split = splitDiagramGoal(ctx, createDiagramProofState(diagram));

    expect(split.subgoals.map((subgoal) => subgoal.id)).toEqual(["g-mid-upper", "g-mid-lower"]);
    expect(split.subgoals.map((subgoal) => prettyEquation(subgoal.originalEquation))).toEqual([
      "F.map(f) >> alpha_Y = alpha_X >> G.map(f)",
      "G.map(f) >> beta_Y = beta_X >> H.map(f)"
    ]);
  });

  it("creates a subgoal from an inferred auxiliary bridge region", () => {
    const ctx = parseContext(verticalCompositeContext);
    const equation = parseEquation("F.map(f) >> alpha_Y >> beta_Y = alpha_X >> beta_X >> H.map(f)", ctx);
    const diagram = addAuxiliaryArrow(ctx, equationDiagram(ctx, equation), {
      id: "g-mid",
      from: "rhs-node-1",
      to: "lhs-node-2",
      label: "G.map(f)",
      term: parseTerm("G.map(f)", ctx)
    });
    const withSubgoal = createSubgoalFromRegion(ctx, createDiagramProofState(diagram), "g-mid-upper");

    expect(withSubgoal.diagram.regions.some((region) => region.id === "g-mid-upper")).toBe(true);
    expect(withSubgoal.subgoals.map((subgoal) => subgoal.id)).toEqual(["g-mid-upper"]);
    expect(prettyEquation(withSubgoal.subgoals[0].originalEquation)).toBe(
      "F.map(f) >> alpha_Y = alpha_X >> G.map(f)"
    );
  });

  it("can split a diagram goal from declared subregions", () => {
    const ctx = parseContext(verticalCompositeContext);
    const diagram = verticalCompositeNaturalityDiagram(ctx);
    const proofState = createDiagramProofState(diagram, "outer");
    const split = splitDiagramGoal(ctx, proofState);

    expect(splittableRegions(proofState).map((region) => region.id)).toEqual(["alpha-square", "beta-square"]);
    expect(split.subgoals.map((subgoal) => subgoal.id)).toEqual(["alpha-square", "beta-square"]);
    expect(split.subgoals.map((subgoal) => prettyEquation(subgoal.originalEquation))).toEqual([
      "F.map(f) >> alpha_Y = alpha_X >> G.map(f)",
      "G.map(f) >> beta_Y = beta_X >> H.map(f)"
    ]);
  });
});
