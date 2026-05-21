import { describe, expect, it } from "vitest";
import {
  applyRewriteOnce,
  category,
  comp,
  emptyContext,
  equalTerm,
  functor,
  functorObject,
  id,
  map,
  morphism,
  object,
  objectPattern,
  simplify,
  termPattern,
  type RewriteRule
} from "../src";

describe("rewrite engine", () => {
  const ctx = emptyContext();
  const C = category("C");
  const D = category("D");
  const X = object("X", C);
  const Y = object("Y", C);
  const F = functor("F", C, D);
  const f = morphism("f", X, Y);

  const objectX = objectPattern("X");
  const termF = termPattern("f");

  const leftIdentity: RewriteRule = {
    id: "left_identity",
    name: "left identity",
    lhs: comp(id(objectX), termF),
    rhs: termF,
    tags: ["simp"]
  };

  it("matches and rewrites a term once", () => {
    const result = applyRewriteOnce(comp(id(X), f), [leftIdentity]);

    expect(result).toBeDefined();
    expect(result?.rule.id).toBe("left_identity");
    expect(result && equalTerm(result.term, f)).toBe(true);
  });

  it("rewrites recursively inside larger terms", () => {
    const result = applyRewriteOnce(map(F, comp(id(X), f)), [leftIdentity]);

    expect(result).toBeDefined();
    expect(result && equalTerm(result.term, map(F, f))).toBe(true);
  });

  it("uses only simp-tagged rules during simplification", () => {
    const ignored: RewriteRule = {
      id: "ignored",
      name: "ignored",
      lhs: f,
      rhs: id(X),
      tags: ["user"]
    };

    const result = simplify(ctx, comp(id(X), f), [ignored, leftIdentity]);

    expect(result.stoppedBecause).toBe("fixedPoint");
    expect(result.steps).toHaveLength(1);
    expect(equalTerm(result.term, f)).toBe(true);
  });

  it("stops when simplification cycles", () => {
    const toIdentity: RewriteRule = {
      id: "to_identity",
      name: "to identity",
      lhs: f,
      rhs: id(X),
      tags: ["simp"]
    };
    const fromIdentity: RewriteRule = {
      id: "from_identity",
      name: "from identity",
      lhs: id(X),
      rhs: f,
      tags: ["simp"]
    };

    const result = simplify(ctx, f, [toIdentity, fromIdentity]);

    expect(result.stoppedBecause).toBe("cycle");
    expect(result.steps.length).toBeGreaterThan(1);
  });

  it("can express a triangle-style identity rewrite", () => {
    const FY = functorObject(F, Y);
    const triangleLike: RewriteRule = {
      id: "triangle_like",
      name: "triangle-like identity",
      lhs: comp(termPattern("eta"), termPattern("eps")),
      rhs: id(FY),
      tags: ["simp", "triangle"]
    };
    const eta = morphism("eta", FY, X);
    const eps = morphism("eps", X, FY);

    const result = simplify(ctx, comp(eta, eps), [triangleLike]);

    expect(result.stoppedBecause).toBe("fixedPoint");
    expect(equalTerm(result.term, id(FY))).toBe(true);
  });
});
