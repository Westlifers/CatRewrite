import { equalObject } from "./equality";
import { comp, id, map, type Context, type Term } from "./syntax";
import { inferTerm } from "./typecheck";

export function normalizeTerm(ctx: Context, term: Term): Term {
  switch (term.kind) {
    case "var":
    case "id":
    case "unit":
    case "counit":
    case "component":
    case "productProjection":
      return term;

    case "productPair":
      return {
        kind: "productPair",
        product: term.product,
        left: normalizeTerm(ctx, term.left),
        right: normalizeTerm(ctx, term.right)
      };

    case "map": {
      const inner = normalizeTerm(ctx, term.term);

      if (inner.kind === "id") {
        return id(mapObject(term.functor, inner.object));
      }

      if (inner.kind === "comp") {
        return normalizeTerm(ctx, comp(map(term.functor, inner.first), map(term.functor, inner.second)));
      }

      return map(term.functor, inner);
    }

    case "comp": {
      const first = normalizeTerm(ctx, term.first);
      const second = normalizeTerm(ctx, term.second);

      if (first.kind === "id") {
        const secondHom = inferTerm(ctx, second);
        if (equalObject(first.object, secondHom.source)) {
          return second;
        }
      }

      if (second.kind === "id") {
        const firstHom = inferTerm(ctx, first);
        if (equalObject(firstHom.target, second.object)) {
          return first;
        }
      }

      if (first.kind === "comp") {
        return normalizeTerm(ctx, comp(first.first, comp(first.second, second)));
      }

      return comp(first, second);
    }
  }
}

function mapObject(functor: Parameters<typeof map>[0], object: Parameters<typeof id>[0]) {
  return {
    kind: "functorObject" as const,
    functor,
    object
  };
}
