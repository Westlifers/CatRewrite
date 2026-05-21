import { equalCategory, equalHom, equalObject, objectCategory } from "./equality";
import { functorObject, type Context, type Equation, type HomType, type Term } from "./syntax";

export class TypecheckError extends Error {
  readonly kind = "typecheckError";
}

export function inferTerm(_ctx: Context, term: Term): HomType {
  switch (term.kind) {
    case "var":
      return term.hom;

    case "id":
      return { source: term.object, target: term.object };

    case "comp": {
      const first = inferTerm(_ctx, term.first);
      const second = inferTerm(_ctx, term.second);

      if (!equalObject(first.target, second.source)) {
        throw new TypecheckError("Cannot compose terms: target of first term does not match source of second term.");
      }

      return { source: first.source, target: second.target };
    }

    case "map": {
      const inner = inferTerm(_ctx, term.term);
      const sourceCategory = objectCategory(inner.source);
      const targetCategory = objectCategory(inner.target);

      if (!equalCategory(sourceCategory, term.functor.source) || !equalCategory(targetCategory, term.functor.source)) {
        throw new TypecheckError("Cannot map term: morphism is not in the source category of the functor.");
      }

      return {
        source: functorObject(term.functor, inner.source),
        target: functorObject(term.functor, inner.target)
      };
    }

    case "unit": {
      const objectInLeftSource = objectCategory(term.object);
      if (!equalCategory(objectInLeftSource, term.adjunction.left.source)) {
        throw new TypecheckError("Cannot form unit: object is not in the source category of the left adjoint.");
      }

      return {
        source: term.object,
        target: functorObject(term.adjunction.right, functorObject(term.adjunction.left, term.object))
      };
    }

    case "counit": {
      const objectInLeftTarget = objectCategory(term.object);
      if (!equalCategory(objectInLeftTarget, term.adjunction.left.target)) {
        throw new TypecheckError("Cannot form counit: object is not in the target category of the left adjoint.");
      }

      return {
        source: functorObject(term.adjunction.left, functorObject(term.adjunction.right, term.object)),
        target: term.object
      };
    }

    case "component": {
      const objectInSource = objectCategory(term.object);
      if (!equalCategory(objectInSource, term.natTrans.source.source)) {
        throw new TypecheckError("Cannot form component: object is not in the source category of the natural transformation.");
      }

      return {
        source: functorObject(term.natTrans.source, term.object),
        target: functorObject(term.natTrans.target, term.object)
      };
    }
  }
}

export function typecheckEquation(ctx: Context, lhs: Term, rhs: Term): Equation {
  const lhsHom = inferTerm(ctx, lhs);
  const rhsHom = inferTerm(ctx, rhs);

  if (!equalHom(lhsHom, rhsHom)) {
    throw new TypecheckError("Equation sides do not have the same hom-type.");
  }

  return { lhs, rhs, hom: lhsHom };
}
