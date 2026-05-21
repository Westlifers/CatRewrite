import { describe, expect, it } from "vitest";
import {
  createGoal,
  createProofState,
  inspectEquation,
  parseContext,
  parseEquation,
  prettyEquation,
  prettyHom,
  runTactic
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

describe("goal inspection", () => {
  it("reports hom-type, normalized goal, and generated rules", () => {
    const ctx = parseContext(contextText);
    const equation = parseEquation("F.map(eta(adj, X) >> G.map(f)) >> eps(adj, Y) = f", ctx);
    const inspection = inspectEquation(ctx, equation);

    expect(prettyHom(inspection.hom)).toBe("F X -> Y");
    expect(prettyEquation(inspection.normalizedEquation)).toBe(
      "F.map(eta(adj, X)) >> F.map(G.map(f)) >> eps(adj, Y) = f"
    );
    expect(inspection.availableRules.some((rule) => rule.id === "adj.counitNaturality.f")).toBe(true);
    expect(inspection.applicableRules.some((rule) => rule.id === "adj.counitNaturality.f")).toBe(true);
  });

  it("updates inspection after a tactic closes the goal", () => {
    const ctx = parseContext(contextText);
    const equation = parseEquation("F.map(eta(adj, X) >> G.map(f)) >> eps(adj, Y) = f", ctx);
    const state = createProofState(ctx, [createGoal("goal-1", equation)]);
    const result = runTactic(state, "goal-1", "try");
    const inspection = inspectEquation(ctx, result.goal.equation);

    expect(inspection.isClosed).toBe(true);
    expect(prettyEquation(inspection.equation)).toBe("f = f");
  });
});
