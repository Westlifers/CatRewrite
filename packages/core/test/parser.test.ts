import { describe, expect, it } from "vitest";
import {
  createGoal,
  createProofState,
  parseContext,
  parseEquation,
  parseObjectExpr,
  parseTerm,
  prettyEquation,
  prettyTerm,
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

describe("parser", () => {
  it("parses MVP context declarations", () => {
    const ctx = parseContext(contextText);

    expect(ctx.decls).toHaveLength(8);
    expect(ctx.decls.some((decl) => decl.kind === "adjunctionDecl")).toBe(true);
  });

  it("parses functor object expressions", () => {
    const ctx = parseContext(contextText);
    const object = parseObjectExpr("F X", ctx);

    expect(object.kind).toBe("functorObject");
  });

  it("parses terms and prints them", () => {
    const ctx = parseContext(contextText);
    const term = parseTerm("F.map(eta(adj, X) >> G.map(f))", ctx);

    expect(prettyTerm(term)).toBe("F.map(eta(adj, X) >> G.map(f))");
  });

  it("parses and proves the first adjunction goal", () => {
    const ctx = parseContext(contextText);
    const equation = parseEquation("F.map(eta(adj, X) >> G.map(f)) >> eps(adj, Y) = f", ctx);
    const state = createProofState(ctx, [createGoal("goal-1", equation)]);

    const result = runTactic(state, "goal-1", "try");

    expect(result.goal.status).toBe("proved");
    expect(prettyEquation(result.goal.equation)).toBe("f = f");
  });
});
