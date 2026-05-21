import { equalCategory, equalFunctor, objectCategory } from "./equality";
import { comp, component, map, type Context, type MorphismDecl, type NatTransExpr } from "./syntax";
import type { RewriteRule } from "./rewrite";

export function natTransNaturalityRules(ctx: Context, natTrans: NatTransExpr): RewriteRule[] {
  const morphismDecls = ctx.decls.filter((decl): decl is MorphismDecl => decl.kind === "morphismDecl");
  const rules: RewriteRule[] = [];

  for (const decl of morphismDecls) {
    const term = decl.term;
    const sourceCategory = objectCategory(term.hom.source);
    const targetCategory = objectCategory(term.hom.target);

    if (equalCategory(sourceCategory, natTrans.source.source) && equalCategory(targetCategory, natTrans.source.source)) {
      rules.push(naturalityRule(natTrans, term));
    }
  }

  return rules;
}

export function naturalityRule(natTrans: NatTransExpr, term: MorphismDecl["term"]): RewriteRule {
  if (!equalFunctor(natTrans.source, natTrans.target) && !equalCategory(natTrans.source.source, natTrans.target.source)) {
    throw new Error("Natural transformation functors must share a source category.");
  }

  return {
    id: `${natTrans.name}.naturality.${term.name}`,
    name: `${natTrans.name} naturality at ${term.name}`,
    lhs: comp(map(natTrans.source, term), component(natTrans, term.hom.target)),
    rhs: comp(component(natTrans, term.hom.source), map(natTrans.target, term)),
    tags: ["naturality"]
  };
}
