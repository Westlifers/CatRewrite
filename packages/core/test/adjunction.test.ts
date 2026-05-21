import { describe, expect, it } from "vitest";
import {
  adjunction,
  adjunctionSimpRules,
  category,
  comp,
  counit,
  emptyContext,
  equalHom,
  equalTerm,
  functor,
  functorObject,
  id,
  inferTerm,
  map,
  morphism,
  normalizeTerm,
  object,
  simplify,
  transpose,
  untranspose,
  unit,
  type Context
} from "../src";

describe("adjunction support", () => {
  const C = category("C");
  const D = category("D");
  const X = object("X", C);
  const Y = object("Y", D);
  const F = functor("F", C, D);
  const G = functor("G", D, C);
  const adj = adjunction("adj", F, G);
  const FX = functorObject(F, X);
  const GY = functorObject(G, Y);
  const f = morphism("f", FX, Y);
  const g = morphism("g", X, GY);

  const ctx: Context = {
    decls: [
      { kind: "categoryDecl", category: C },
      { kind: "categoryDecl", category: D },
      { kind: "objectDecl", object: X },
      { kind: "objectDecl", object: Y },
      { kind: "functorDecl", functor: F },
      { kind: "functorDecl", functor: G },
      { kind: "adjunctionDecl", adjunction: adj },
      { kind: "morphismDecl", term: f },
      { kind: "morphismDecl", term: g }
    ]
  };

  it("infers unit and counit hom-types", () => {
    expect(equalHom(inferTerm(ctx, unit(adj, X)), { source: X, target: functorObject(G, FX) })).toBe(true);
    expect(equalHom(inferTerm(ctx, counit(adj, Y)), { source: functorObject(F, GY), target: Y })).toBe(true);
  });

  it("defines transpose and untranspose helpers", () => {
    expect(equalHom(inferTerm(ctx, transpose(adj, f)), { source: X, target: GY })).toBe(true);
    expect(equalHom(inferTerm(ctx, untranspose(adj, g)), { source: FX, target: Y })).toBe(true);
  });

  it("generates triangle and naturality simplification rules", () => {
    const rules = adjunctionSimpRules(ctx, adj);

    expect(rules.some((rule) => rule.id === "adj.triangle.left.X")).toBe(true);
    expect(rules.some((rule) => rule.id === "adj.triangle.right.Y")).toBe(true);
    expect(rules.some((rule) => rule.id === "adj.counitNaturality.f")).toBe(true);
  });

  it("proves the first adjunction transpose example by normalize then simp", () => {
    const target = comp(map(F, comp(unit(adj, X), map(G, f))), counit(adj, Y));
    const normalized = normalizeTerm(ctx, target);
    const result = simplify(ctx, normalized, adjunctionSimpRules(ctx, adj));

    expect(result.stoppedBecause).toBe("fixedPoint");
    expect(equalTerm(result.term, f)).toBe(true);
  });

  it("simplifies a left triangle identity", () => {
    const result = simplify(ctx, comp(map(F, unit(adj, X)), counit(adj, FX)), adjunctionSimpRules(ctx, adj));

    expect(equalTerm(result.term, id(FX))).toBe(true);
  });
});
