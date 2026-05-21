import { describe, expect, it } from "vitest";
import {
  category,
  comp,
  emptyContext,
  equalTerm,
  functor,
  id,
  map,
  morphism,
  normalizeTerm,
  object
} from "../src";

describe("normalizeTerm", () => {
  const ctx = emptyContext();
  const C = category("C");
  const D = category("D");
  const X = object("X", C);
  const Y = object("Y", C);
  const Z = object("Z", C);
  const W = object("W", C);
  const F = functor("F", C, D);

  const f = morphism("f", X, Y);
  const g = morphism("g", Y, Z);
  const h = morphism("h", Z, W);

  it("removes a left identity", () => {
    expect(equalTerm(normalizeTerm(ctx, comp(id(X), f)), f)).toBe(true);
  });

  it("removes a right identity", () => {
    expect(equalTerm(normalizeTerm(ctx, comp(f, id(Y))), f)).toBe(true);
  });

  it("right-associates composition", () => {
    expect(equalTerm(normalizeTerm(ctx, comp(comp(f, g), h)), comp(f, comp(g, h)))).toBe(true);
  });

  it("normalizes functor preservation of identities", () => {
    expect(equalTerm(normalizeTerm(ctx, map(F, id(X))), id({ kind: "functorObject", functor: F, object: X }))).toBe(
      true
    );
  });

  it("normalizes functor preservation of composition", () => {
    expect(equalTerm(normalizeTerm(ctx, map(F, comp(f, g))), comp(map(F, f), map(F, g)))).toBe(true);
  });
});
