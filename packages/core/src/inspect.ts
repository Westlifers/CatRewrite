import { adjunctionSimpRules } from "./adjunction";
import { equalTerm } from "./equality";
import { natTransNaturalityRules } from "./natTrans";
import { normalizeTerm } from "./normalize";
import { productProjectionRules } from "./product";
import { applyRewriteOnce, type RewriteRule } from "./rewrite";
import {
  type AdjunctionDecl,
  type Context,
  type Equation,
  type HomType,
  type NatTransDecl,
  type ProductDecl,
  type Term
} from "./syntax";
import { inferTerm, typecheckEquation } from "./typecheck";

export interface GoalInspection {
  equation: Equation;
  hom: HomType;
  normalizedEquation: Equation;
  isClosed: boolean;
  availableRules: RuleSummary[];
  applicableRules: ApplicableRuleSummary[];
}

export interface RuleSummary {
  id: string;
  name: string;
  tags: string[];
}

export interface ApplicableRuleSummary extends RuleSummary {
  side: "lhs" | "rhs";
  result: Term;
}

export function generatedRules(ctx: Context, extraRules: RewriteRule[] = []): RewriteRule[] {
  const adjunctionRules = ctx.decls
    .filter((decl): decl is AdjunctionDecl => decl.kind === "adjunctionDecl")
    .flatMap((decl) => adjunctionSimpRules(ctx, decl.adjunction));
  const natTransRules = ctx.decls
    .filter((decl): decl is NatTransDecl => decl.kind === "natTransDecl")
    .flatMap((decl) => natTransNaturalityRules(ctx, decl.natTrans));
  const productRules = ctx.decls
    .filter((decl): decl is ProductDecl => decl.kind === "productDecl")
    .flatMap((decl) => productProjectionRules(decl));

  return [...adjunctionRules, ...natTransRules, ...productRules, ...extraRules];
}

export function inspectEquation(ctx: Context, equation: Equation, rules: RewriteRule[] = []): GoalInspection {
  const normalizedEquation = typecheckEquation(
    ctx,
    normalizeTerm(ctx, equation.lhs),
    normalizeTerm(ctx, equation.rhs)
  );
  const allRules = generatedRules(ctx, rules);

  return {
    equation,
    hom: inferTerm(ctx, equation.lhs),
    normalizedEquation,
    isClosed: equalTerm(equation.lhs, equation.rhs),
    availableRules: allRules.map(summarizeRule),
    applicableRules: applicableRules(normalizedEquation, allRules)
  };
}

export function inspectActiveGoal(
  ctx: Context,
  equation: Equation | undefined,
  rules: RewriteRule[] = []
): GoalInspection | undefined {
  return equation ? inspectEquation(ctx, equation, rules) : undefined;
}

function applicableRules(equation: Equation, rules: RewriteRule[]): ApplicableRuleSummary[] {
  const summaries: ApplicableRuleSummary[] = [];

  for (const rule of rules) {
    const lhs = applyRewriteOnce(equation.lhs, [rule]);
    if (lhs) {
      summaries.push({ ...summarizeRule(rule), side: "lhs", result: lhs.term });
    }

    const rhs = applyRewriteOnce(equation.rhs, [rule]);
    if (rhs) {
      summaries.push({ ...summarizeRule(rule), side: "rhs", result: rhs.term });
    }
  }

  return summaries;
}

function summarizeRule(rule: RewriteRule): RuleSummary {
  return {
    id: rule.id,
    name: rule.name,
    tags: rule.tags
  };
}
