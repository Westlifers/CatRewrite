import type { AdjunctionExpr, CategoryExpr, FunctorExpr, HomType, NatTransExpr, ObjectExpr, Term } from "./syntax";

export function equalCategory(left: CategoryExpr, right: CategoryExpr): boolean {
  return left.name === right.name;
}

export function objectCategory(object: ObjectExpr): CategoryExpr {
  switch (object.kind) {
    case "object":
      return object.category;
    case "functorObject":
      return object.functor.target;
  }
}

export function equalObject(left: ObjectExpr, right: ObjectExpr): boolean {
  if (left.kind !== right.kind) {
    return false;
  }

  switch (left.kind) {
    case "object":
      return right.kind === "object" && left.name === right.name && equalCategory(left.category, right.category);
    case "functorObject":
      return (
        right.kind === "functorObject" &&
        left.functor.name === right.functor.name &&
        equalCategory(left.functor.source, right.functor.source) &&
        equalCategory(left.functor.target, right.functor.target) &&
        equalObject(left.object, right.object)
      );
  }
}

export function equalHom(left: HomType, right: HomType): boolean {
  return equalObject(left.source, right.source) && equalObject(left.target, right.target);
}

export function equalFunctor(left: FunctorExpr, right: FunctorExpr): boolean {
  return left.name === right.name && equalCategory(left.source, right.source) && equalCategory(left.target, right.target);
}

export function equalAdjunction(left: AdjunctionExpr, right: AdjunctionExpr): boolean {
  return left.name === right.name && equalFunctor(left.left, right.left) && equalFunctor(left.right, right.right);
}

export function equalNatTrans(left: NatTransExpr, right: NatTransExpr): boolean {
  return left.name === right.name && equalFunctor(left.source, right.source) && equalFunctor(left.target, right.target);
}

export function equalTerm(left: Term, right: Term): boolean {
  if (left.kind !== right.kind) {
    return false;
  }

  switch (left.kind) {
    case "var":
      return right.kind === "var" && left.name === right.name && equalHom(left.hom, right.hom);
    case "id":
      return right.kind === "id" && equalObject(left.object, right.object);
    case "comp":
      return right.kind === "comp" && equalTerm(left.first, right.first) && equalTerm(left.second, right.second);
    case "map":
      return (
        right.kind === "map" &&
        equalFunctor(left.functor, right.functor) &&
        equalTerm(left.term, right.term)
      );
    case "unit":
      return right.kind === "unit" && equalAdjunction(left.adjunction, right.adjunction) && equalObject(left.object, right.object);
    case "counit":
      return (
        right.kind === "counit" &&
        equalAdjunction(left.adjunction, right.adjunction) &&
        equalObject(left.object, right.object)
      );
    case "component":
      return (
        right.kind === "component" &&
        equalNatTrans(left.natTrans, right.natTrans) &&
        equalObject(left.object, right.object)
      );
    case "productProjection":
      return (
        right.kind === "productProjection" &&
        left.side === right.side &&
        equalObject(left.product, right.product)
      );
    case "productPair":
      return (
        right.kind === "productPair" &&
        equalObject(left.product, right.product) &&
        equalTerm(left.left, right.left) &&
        equalTerm(left.right, right.right)
      );
    case "terminalMap":
      return right.kind === "terminalMap" && equalObject(left.terminal, right.terminal) && equalObject(left.source, right.source);
  }
}
