import { equalFunctor, objectCategory } from "./equality";
import {
  comp,
  counit,
  functorObject,
  id,
  map,
  unit,
  type AdjunctionExpr,
  type Context,
  type MorphismDecl,
  type ObjectDecl,
  type ObjectExpr,
  type Term
} from "./syntax";
import type { RewriteRule } from "./rewrite";

export function transpose(adjunction: AdjunctionExpr, term: Term): Term {
  return comp(unit(adjunction, inferTransposeSourceObject(adjunction, term)), map(adjunction.right, term));
}

export function untranspose(adjunction: AdjunctionExpr, term: Term): Term {
  return comp(map(adjunction.left, term), counit(adjunction, inferUntransposeTargetObject(adjunction, term)));
}

export function adjunctionSimpRules(ctx: Context, adjunction: AdjunctionExpr): RewriteRule[] {
  const objectDecls = ctx.decls.filter((decl): decl is ObjectDecl => decl.kind === "objectDecl");
  const morphismDecls = ctx.decls.filter((decl): decl is MorphismDecl => decl.kind === "morphismDecl");
  const rules: RewriteRule[] = [];

  for (const decl of objectDecls) {
    const object = decl.object;
    const category = objectCategory(object);

    if (category.name === adjunction.left.source.name) {
      rules.push(leftTriangleRule(adjunction, object));
    }

    if (category.name === adjunction.left.target.name) {
      rules.push(rightTriangleRule(adjunction, object));
    }
  }

  for (const decl of morphismDecls) {
    const term = decl.term;
    const sourceCategory = objectCategory(term.hom.source);
    const targetCategory = objectCategory(term.hom.target);

    if (sourceCategory.name === adjunction.left.source.name && targetCategory.name === adjunction.left.source.name) {
      rules.push(unitNaturalityRule(adjunction, term));
    }

    if (sourceCategory.name === adjunction.left.target.name && targetCategory.name === adjunction.left.target.name) {
      rules.push(counitNaturalityRule(adjunction, term));
    }

    const sourceObject = unwrapFunctorObject(term.hom.source, adjunction.left);
    if (sourceObject) {
      rules.push(leftTriangleWithTailRule(adjunction, sourceObject, term));
    }
  }

  return rules;
}

export function leftTriangleRule(adjunction: AdjunctionExpr, object: ObjectExpr): RewriteRule {
  const left = adjunction.left;
  const fx = functorObject(left, object);

  return {
    id: `${adjunction.name}.triangle.left.${objectKey(object)}`,
    name: `${adjunction.name} left triangle at ${objectKey(object)}`,
    lhs: comp(map(left, unit(adjunction, object)), counit(adjunction, fx)),
    rhs: id(fx),
    tags: ["simp", "triangle", "adjunction"]
  };
}

export function rightTriangleRule(adjunction: AdjunctionExpr, object: ObjectExpr): RewriteRule {
  const right = adjunction.right;
  const gy = functorObject(right, object);

  return {
    id: `${adjunction.name}.triangle.right.${objectKey(object)}`,
    name: `${adjunction.name} right triangle at ${objectKey(object)}`,
    lhs: comp(unit(adjunction, gy), map(right, counit(adjunction, object))),
    rhs: id(gy),
    tags: ["simp", "triangle", "adjunction"]
  };
}

export function unitNaturalityRule(adjunction: AdjunctionExpr, term: Term): RewriteRule {
  if (term.kind !== "var") {
    throw new Error("Unit naturality rules currently require a named morphism.");
  }

  return {
    id: `${adjunction.name}.unitNaturality.${term.name}`,
    name: `${adjunction.name} unit naturality at ${term.name}`,
    lhs: comp(term, unit(adjunction, term.hom.target)),
    rhs: comp(unit(adjunction, term.hom.source), map(adjunction.right, map(adjunction.left, term))),
    tags: ["naturality", "adjunction"]
  };
}

export function counitNaturalityRule(adjunction: AdjunctionExpr, term: Term): RewriteRule {
  if (term.kind !== "var") {
    throw new Error("Counit naturality rules currently require a named morphism.");
  }

  return {
    id: `${adjunction.name}.counitNaturality.${term.name}`,
    name: `${adjunction.name} counit naturality at ${term.name}`,
    lhs: comp(map(adjunction.left, map(adjunction.right, term)), counit(adjunction, term.hom.target)),
    rhs: comp(counit(adjunction, term.hom.source), term),
    tags: ["simp", "naturality", "adjunction"]
  };
}

export function leftTriangleWithTailRule(adjunction: AdjunctionExpr, object: ObjectExpr, tail: Term): RewriteRule {
  const left = adjunction.left;
  const fx = functorObject(left, object);

  return {
    id: `${adjunction.name}.triangle.left.tail.${objectKey(object)}.${tailKey(tail)}`,
    name: `${adjunction.name} left triangle before ${tailKey(tail)}`,
    lhs: comp(map(left, unit(adjunction, object)), comp(counit(adjunction, fx), tail)),
    rhs: tail,
    tags: ["simp", "triangle", "adjunction"]
  };
}

function unwrapFunctorObject(object: ObjectExpr, expectedFunctor: AdjunctionExpr["left"]): ObjectExpr | undefined {
  if (object.kind === "functorObject" && equalFunctor(object.functor, expectedFunctor)) {
    return object.object;
  }

  return undefined;
}

function inferTransposeSourceObject(_adjunction: AdjunctionExpr, term: Term): ObjectExpr {
  if (term.kind === "var" && term.hom.source.kind === "functorObject") {
    return term.hom.source.object;
  }

  throw new Error("Cannot infer transpose source object for this term yet.");
}

function inferUntransposeTargetObject(_adjunction: AdjunctionExpr, term: Term): ObjectExpr {
  if (term.kind === "var" && term.hom.target.kind === "functorObject") {
    return term.hom.target.object;
  }

  throw new Error("Cannot infer untranspose target object for this term yet.");
}

function objectKey(object: ObjectExpr): string {
  switch (object.kind) {
    case "object":
      return object.name;
    case "functorObject":
      return `${object.functor.name}${objectKey(object.object)}`;
  }
}

function tailKey(term: Term): string {
  return term.kind === "var" ? term.name : term.kind;
}
