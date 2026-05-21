import { describe, expect, it } from "vitest";
import { latexEquation, latexHom, latexObject, latexTerm, parseContext, parseEquation, parseObjectExpr, parseTerm } from "../src";

const contextText = `
category C
category D
object X : C
object Y : C
functor F : C -> D
functor G : C -> D
nattrans alpha : F => G
morphism f : X -> Y
`;

describe("latex pretty printer", () => {
  it("prints objects and hom types", () => {
    const ctx = parseContext(contextText);
    const object = parseObjectExpr("F X", ctx);
    const equation = parseEquation("f = f", ctx);

    expect(latexObject(object)).toBe("F(X)");
    expect(latexHom(equation.hom)).toBe("X \\to Y");
  });

  it("prints terms in conventional composition order", () => {
    const ctx = parseContext(contextText);
    const term = parseTerm("F.map(f) >> alpha_Y", ctx);

    expect(latexTerm(term)).toBe("\\alpha_{Y} \\circ F(f)");
  });

  it("prints equations", () => {
    const ctx = parseContext(contextText);
    const equation = parseEquation("F.map(f) >> alpha_Y = alpha_X >> G.map(f)", ctx);

    expect(latexEquation(equation)).toBe("\\alpha_{Y} \\circ F(f) = G(f) \\circ \\alpha_{X}");
  });
});
