import { equalCategory, equalHom, equalObject, objectCategory } from "./equality";
import { functorObject, type Context, type Equation, type HomType, type ProductDecl, type Term } from "./syntax";

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

    case "productProjection": {
      const product = requireProductDecl(_ctx, term.product);
      return {
        source: product.product,
        target: term.side === "left" ? product.left : product.right
      };
    }

    case "productPair": {
      const product = requireProductDecl(_ctx, term.product);
      const left = inferTerm(_ctx, term.left);
      const right = inferTerm(_ctx, term.right);

      if (!equalObject(left.source, right.source)) {
        throw new TypecheckError("Cannot form product pairing: paired morphisms must have the same source.");
      }
      if (!equalObject(left.target, product.left) || !equalObject(right.target, product.right)) {
        throw new TypecheckError("Cannot form product pairing: paired morphisms do not target the product factors.");
      }

      return {
        source: left.source,
        target: product.product
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

function requireProductDecl(ctx: Context, product: ProductDecl["product"]): ProductDecl {
  const decl = ctx.decls.find(
    (candidate): candidate is ProductDecl =>
      candidate.kind === "productDecl" && equalObject(candidate.product, product)
  );
  if (!decl) {
    throw new TypecheckError(`Unknown product object: ${product.name}`);
  }
  return decl;
}
