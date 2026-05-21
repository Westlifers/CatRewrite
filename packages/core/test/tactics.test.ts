import { describe, expect, it } from "vitest";
import {
  adjunction,
  category,
  comp,
  createGoal,
  createProofState,
  counit,
  functor,
  functorObject,
  id,
  map,
  morphism,
  object,
  parseContext,
  parseEquation,
  runTactic,
  type Context,
  typecheckEquation,
  unit
} from "../src";

describe("tactics", () => {
  const C = category("C");
  const D = category("D");
  const X = object("X", C);
  const Y = object("Y", D);
  const F = functor("F", C, D);
  const G = functor("G", D, C);
  const adj = adjunction("adj", F, G);
  const f = morphism("f", functorObject(F, X), Y);

  const ctx: Context = {
    decls: [
      { kind: "categoryDecl", category: C },
      { kind: "categoryDecl", category: D },
      { kind: "objectDecl", object: X },
      { kind: "objectDecl", object: Y },
      { kind: "functorDecl", functor: F },
      { kind: "functorDecl", functor: G },
      { kind: "adjunctionDecl", adjunction: adj },
      { kind: "morphismDecl", term: f }
    ]
  };

  it("closes the first adjunction proof target with try", () => {
    const lhs = comp(map(F, comp(unit(adj, X), map(G, f))), counit(adj, Y));
    const equation = typecheckEquation(ctx, lhs, f);
    const state = createProofState(ctx, [createGoal("goal-1", equation)]);

    const result = runTactic(state, "goal-1", "try");

    expect(result.goal.status).toBe("proved");
    expect(result.step.message).toBe(
      "try closed the goal using adj.counitNaturality.f, adj.triangle.left.tail.X.f"
    );
    expect(result.state.proofLog).toHaveLength(1);
  });

  it("normalizes simple goals without proving unequal sides", () => {
    const equation = typecheckEquation(ctx, comp(id(functorObject(F, X)), f), f);
    const state = createProofState(ctx, [createGoal("goal-1", equation)]);

    const result = runTactic(state, "goal-1", "normalize");

    expect(result.goal.status).toBe("proved");
  });

  it("does not run tactics on an already proved goal", () => {
    const equation = typecheckEquation(ctx, comp(id(functorObject(F, X)), f), f);
    const state = createProofState(ctx, [createGoal("goal-1", equation)]);
    const proved = runTactic(state, "goal-1", "normalize");

    expect(() => runTactic(proved.state, "goal-1", "try")).toThrow("Goal is already proved: goal-1");
    expect(proved.state.proofLog).toHaveLength(1);
  });

  it("tries naturality rules without requiring an explicit naturality tactic", () => {
    const naturalityContext = parseContext(`
category C
category D
functor F : C -> D
functor G : C -> D
nattrans alpha : F => G
object X : C
object Y : C
morphism f : X -> Y
`);
    const equation = parseEquation("F.map(f) >> alpha_Y = alpha_X >> G.map(f)", naturalityContext);
    const state = createProofState(naturalityContext, [createGoal("goal-1", equation)]);

    const result = runTactic(state, "goal-1", "try");

    expect(result.goal.status).toBe("proved");
    expect(result.step.message).toBe("try closed the goal using alpha.naturality.f");
  });
});
