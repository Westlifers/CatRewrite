import { describe, expect, it } from "vitest";
import {
  createGoal,
  createProofState,
  equalHom,
  inferTerm,
  latexTerm,
  parseContext,
  parseEquation,
  parseObjectExpr,
  parseTerm,
  prettyTerm,
  runTactic
} from "../src";

const contextText = `
category C
object X : C
terminal One : C
morphism f : X -> One
morphism g : X -> One
`;

describe("terminal objects", () => {
  it("parses terminal declarations and terminal maps", () => {
    const ctx = parseContext(contextText);
    const source = parseObjectExpr("X", ctx);
    const terminal = parseObjectExpr("One", ctx);
    const term = parseTerm("terminalMap(One, X)", ctx);

    expect(ctx.decls.some((decl) => decl.kind === "terminalDecl")).toBe(true);
    expect(equalHom(inferTerm(ctx, term), { source, target: terminal })).toBe(true);
    expect(prettyTerm(term)).toBe("terminalMap(One, X)");
    expect(latexTerm(term)).toBe("!^{One}_{X}");
  });

  it("closes maps into a terminal object by terminal extensionality", () => {
    const ctx = parseContext(contextText);
    const equation = parseEquation("f = g", ctx);
    const state = createProofState(ctx, [createGoal("goal-1", equation)]);
    const result = runTactic(state, "goal-1", "terminal_ext One");

    expect(result.goal.status).toBe("proved");
    expect(result.step.message).toBe("closed by terminal uniqueness for One");
  });

  it("rejects terminal extensionality away from the terminal target", () => {
    const ctx = parseContext(`
category C
object X : C
object Y : C
terminal One : C
morphism f : X -> Y
morphism g : X -> Y
`);
    const equation = parseEquation("f = g", ctx);
    const state = createProofState(ctx, [createGoal("goal-1", equation)]);

    expect(() => runTactic(state, "goal-1", "terminal_ext One")).toThrow(
      "terminal_ext One applies only to goals whose target is One."
    );
  });
});
