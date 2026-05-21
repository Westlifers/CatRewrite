import { describe, expect, it } from "vitest";
import {
  TypecheckError,
  category,
  comp,
  emptyContext,
  equalHom,
  functor,
  functorObject,
  id,
  inferTerm,
  map,
  morphism,
  object
} from "../src";

describe("inferTerm", () => {
  const ctx = emptyContext();
  const C = category("C");
  const D = category("D");
  const X = object("X", C);
  const Y = object("Y", C);
  const Z = object("Z", C);
  const W = object("W", D);
  const F = functor("F", C, D);

  const f = morphism("f", X, Y);
  const g = morphism("g", Y, Z);
  const h = morphism("h", W, W);

  it("infers identity morphism hom-types", () => {
    expect(equalHom(inferTerm(ctx, id(X)), { source: X, target: X })).toBe(true);
  });

  it("infers valid composition hom-types", () => {
    expect(equalHom(inferTerm(ctx, comp(f, g)), { source: X, target: Z })).toBe(true);
  });

  it("rejects non-composable terms", () => {
    expect(() => inferTerm(ctx, comp(f, h))).toThrow(TypecheckError);
  });

  it("infers functor map hom-types", () => {
    expect(
      equalHom(inferTerm(ctx, map(F, f)), {
        source: functorObject(F, X),
        target: functorObject(F, Y)
      })
    ).toBe(true);
  });

  it("rejects mapping a morphism outside the functor source category", () => {
    expect(() => inferTerm(ctx, map(F, h))).toThrow(TypecheckError);
  });
});
