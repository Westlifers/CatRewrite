import { describe, expect, it } from "vitest";
import {
  createGoal,
  createProofState,
  completeGoalByProductExt,
  equalHom,
  equalObject,
  generatedRules,
  inferTerm,
  latexObject,
  latexTerm,
  parseContext,
  parseEquation,
  parseObjectExpr,
  parseTerm,
  prettyEquation,
  prettyObject,
  prettyTerm,
  runTactic
} from "../src";

const contextText = `
category C
object A : C
object B : C
object Z : C
product P of A B
morphism f : Z -> A
morphism g : Z -> B
morphism h : Z -> A x B
`;

describe("products", () => {
  it("parses chosen products and product object notation", () => {
    const ctx = parseContext(contextText);
    const product = parseObjectExpr("P", ctx);

    expect(ctx.decls.some((decl) => decl.kind === "productDecl")).toBe(true);
    expect(equalObject(parseObjectExpr("A x B", ctx), product)).toBe(true);
    expect(equalObject(parseObjectExpr("A * B", ctx), product)).toBe(true);
    expect(equalObject(parseObjectExpr("A times B", ctx), product)).toBe(true);
    expect(equalObject(parseObjectExpr("A \\times B", ctx), product)).toBe(true);
    expect(prettyObject(product)).toBe("A x B");
    expect(latexObject(product)).toBe("A \\times B");
  });

  it("typechecks projections and pairing", () => {
    const ctx = parseContext(contextText);
    const product = parseObjectExpr("P", ctx);
    const source = parseObjectExpr("Z", ctx);
    const left = parseObjectExpr("A", ctx);
    const right = parseObjectExpr("B", ctx);

    expect(equalHom(inferTerm(ctx, parseTerm("pi1(P)", ctx)), { source: product, target: left })).toBe(true);
    expect(equalHom(inferTerm(ctx, parseTerm("pi2(P)", ctx)), { source: product, target: right })).toBe(true);
    expect(equalHom(inferTerm(ctx, parseTerm("<f, g>", ctx)), { source, target: product })).toBe(true);
    expect(equalHom(inferTerm(ctx, parseTerm("<f, g>_P", ctx)), { source, target: product })).toBe(true);
    expect(prettyTerm(parseTerm("<f, g>", ctx))).toBe("<f, g>_P");
    expect(latexTerm(parseTerm("<f, g>", ctx))).toBe("\\left\\langle f, g \\right\\rangle_{A \\times B}");
  });

  it("generates projection simplification rules and try proves projections", () => {
    const ctx = parseContext(contextText);
    const rules = generatedRules(ctx);

    expect(rules.some((rule) => rule.id === "P.product.pi1" && rule.tags.includes("product"))).toBe(true);
    expect(rules.some((rule) => rule.id === "P.product.pi2" && rule.tags.includes("product"))).toBe(true);

    const equation = parseEquation("<f, g> >> pi1(P) = f", ctx);
    const state = createProofState(ctx, [createGoal("goal-1", equation)]);
    const result = runTactic(state, "goal-1", "try");

    expect(result.goal.status).toBe("proved");
    expect(prettyEquation(result.goal.equation)).toBe("f = f");
    expect(result.step.message).toContain("P.product.pi1");
  });

  it("splits and completes pairing after precomposition by product extensionality", () => {
    const ctx = parseContext(`
category C
object W : C
object X : C
object A : C
object B : C
product P of A B
morphism h : W -> X
morphism f : X -> A
morphism g : X -> B
`);
    const equation = parseEquation("h >> <f, g> = <h >> f, h >> g>", ctx);
    const state = createProofState(ctx, [createGoal("goal-1", equation)]);
    const split = runTactic(state, "goal-1", "product_ext P");

    expect(split.goal.status).toBe("open");
    expect(split.state.goals.map((goal) => goal.id)).toEqual(["goal-1", "goal-1.pi1", "goal-1.pi2"]);
    expect(split.state.goals.find((goal) => goal.id === "goal-1.pi1")?.parentGoalId).toBe("goal-1");
    expect(split.step.message).toContain("split by product_ext P");

    const left = runTactic(split.state, "goal-1.pi1", "try");
    const right = runTactic(left.state, "goal-1.pi2", "try");
    const completed = completeGoalByProductExt(right.state, "goal-1");

    expect(completed.goal.status).toBe("proved");
    expect(completed.step.message).toContain("completed by product extensionality");
  });

  it("rejects ambiguous product notation", () => {
    const ctx = parseContext(`
category C
object A : C
object B : C
product P of A B
product Q of A B
`);

    expect(() => parseObjectExpr("A x B", ctx)).toThrow(/Ambiguous product/);
  });
});
