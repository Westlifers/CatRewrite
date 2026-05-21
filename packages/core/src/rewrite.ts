import { equalAdjunction, equalFunctor, equalNatTrans, equalObject, equalTerm } from "./equality";
import {
  component,
  comp,
  counit,
  id,
  map,
  productPair,
  productProjection,
  unit,
  type AdjunctionExpr,
  type Context,
  type FunctorExpr,
  type NatTransExpr,
  type ObjectExpr,
  type ObjectVarExpr,
  type Term
} from "./syntax";

export type RuleTag =
  | "simp"
  | "naturality"
  | "adjunction"
  | "triangle"
  | "functoriality"
  | "product"
  | "universal"
  | "extensionality"
  | "user";

export type PatternObject = ObjectExpr | PatternObjectVar | PatternFunctorObject;

export interface PatternObjectVar {
  kind: "objectPattern";
  name: string;
}

export interface PatternFunctorObject {
  kind: "functorObject";
  functor: FunctorExpr;
  object: PatternObject;
}

export type PatternTerm =
  | Term
  | PatternTermVar
  | PatternIdTerm
  | PatternCompTerm
  | PatternFunctorMapTerm
  | PatternUnitTerm
  | PatternCounitTerm
  | PatternComponentTerm
  | PatternProductProjectionTerm
  | PatternProductPairTerm;

export interface PatternTermVar {
  kind: "termPattern";
  name: string;
}

export interface PatternIdTerm {
  kind: "id";
  object: PatternObject;
}

export interface PatternCompTerm {
  kind: "comp";
  first: PatternTerm;
  second: PatternTerm;
}

export interface PatternFunctorMapTerm {
  kind: "map";
  functor: FunctorExpr;
  term: PatternTerm;
}

export interface PatternUnitTerm {
  kind: "unit";
  adjunction: AdjunctionExpr;
  object: PatternObject;
}

export interface PatternCounitTerm {
  kind: "counit";
  adjunction: AdjunctionExpr;
  object: PatternObject;
}

export interface PatternComponentTerm {
  kind: "component";
  natTrans: NatTransExpr;
  object: PatternObject;
}

export interface PatternProductProjectionTerm {
  kind: "productProjection";
  product: ObjectVarExpr;
  side: "left" | "right";
}

export interface PatternProductPairTerm {
  kind: "productPair";
  product: ObjectVarExpr;
  left: PatternTerm;
  right: PatternTerm;
}

export interface RewriteRule {
  id: string;
  name: string;
  lhs: PatternTerm;
  rhs: PatternTerm;
  tags: RuleTag[];
}

export interface RewriteResult {
  term: Term;
  rule: RewriteRule;
}

export interface SimplifyResult {
  term: Term;
  steps: RewriteResult[];
  stoppedBecause: "fixedPoint" | "maxSteps" | "cycle";
}

interface MatchEnv {
  objects: Map<string, ObjectExpr>;
  terms: Map<string, Term>;
}

export const objectPattern = (name: string): PatternObjectVar => ({ kind: "objectPattern", name });

export const functorObjectPattern = (functor: FunctorExpr, object: PatternObject): PatternFunctorObject => ({
  kind: "functorObject",
  functor,
  object
});

export const termPattern = (name: string): PatternTermVar => ({ kind: "termPattern", name });

export function matchTerm(pattern: PatternTerm, term: Term): MatchEnv | undefined {
  return matchTermWithEnv(pattern, term, emptyMatchEnv());
}

export function applyRewriteOnce(term: Term, rules: RewriteRule[]): RewriteResult | undefined {
  for (const rule of rules) {
    const env = matchTerm(rule.lhs, term);
    if (env) {
      return { term: instantiateTerm(rule.rhs, env), rule };
    }
  }

  switch (term.kind) {
    case "var":
    case "id":
    case "unit":
    case "counit":
    case "component":
    case "productProjection":
      return undefined;

    case "productPair": {
      const left = applyRewriteOnce(term.left, rules);
      if (left) {
        return { term: productPair(term.product, left.term, term.right), rule: left.rule };
      }

      const right = applyRewriteOnce(term.right, rules);
      if (right) {
        return { term: productPair(term.product, term.left, right.term), rule: right.rule };
      }

      return undefined;
    }

    case "map": {
      const inner = applyRewriteOnce(term.term, rules);
      if (!inner) {
        return undefined;
      }

      return { term: map(term.functor, inner.term), rule: inner.rule };
    }

    case "comp": {
      const first = applyRewriteOnce(term.first, rules);
      if (first) {
        return { term: comp(first.term, term.second), rule: first.rule };
      }

      const second = applyRewriteOnce(term.second, rules);
      if (second) {
        return { term: comp(term.first, second.term), rule: second.rule };
      }

      return undefined;
    }
  }
}

export function simplify(
  _ctx: Context,
  term: Term,
  rules: RewriteRule[],
  options: { maxSteps?: number; tags?: RuleTag[] } = {}
): SimplifyResult {
  const tags = options.tags ?? ["simp"];
  const simpRules = rules.filter((rule) => tags.some((tag) => rule.tags.includes(tag)));
  const maxSteps = options.maxSteps ?? 100;
  const seen = new Set<string>();
  const steps: RewriteResult[] = [];
  let current = term;

  for (let step = 0; step < maxSteps; step += 1) {
    const key = JSON.stringify(current);
    if (seen.has(key)) {
      return { term: current, steps, stoppedBecause: "cycle" };
    }
    seen.add(key);

    const result = applyRewriteOnce(current, simpRules);
    if (!result) {
      return { term: current, steps, stoppedBecause: "fixedPoint" };
    }

    current = result.term;
    steps.push(result);
  }

  return { term: current, steps, stoppedBecause: "maxSteps" };
}

function emptyMatchEnv(): MatchEnv {
  return { objects: new Map(), terms: new Map() };
}

function matchTermWithEnv(pattern: PatternTerm, term: Term, env: MatchEnv): MatchEnv | undefined {
  if (pattern.kind === "termPattern") {
    return bindTerm(pattern.name, term, env);
  }

  if (pattern.kind !== term.kind) {
    return undefined;
  }

  switch (pattern.kind) {
    case "var":
      return term.kind === "var" && equalTerm(pattern, term) ? env : undefined;
    case "id":
      return term.kind === "id" ? matchObjectWithEnv(pattern.object, term.object, env) : undefined;
    case "comp": {
      if (term.kind !== "comp") {
        return undefined;
      }
      const firstEnv = matchTermWithEnv(pattern.first, term.first, env);
      return firstEnv ? matchTermWithEnv(pattern.second, term.second, firstEnv) : undefined;
    }
    case "map": {
      if (term.kind !== "map" || !equalFunctor(pattern.functor, term.functor)) {
        return undefined;
      }
      return matchTermWithEnv(pattern.term, term.term, env);
    }
    case "unit":
      return term.kind === "unit" && equalAdjunction(pattern.adjunction, term.adjunction)
        ? matchObjectWithEnv(pattern.object, term.object, env)
        : undefined;
    case "counit":
      return term.kind === "counit" && equalAdjunction(pattern.adjunction, term.adjunction)
        ? matchObjectWithEnv(pattern.object, term.object, env)
        : undefined;
    case "component":
      return term.kind === "component" && equalNatTrans(pattern.natTrans, term.natTrans)
        ? matchObjectWithEnv(pattern.object, term.object, env)
        : undefined;
    case "productProjection":
      return term.kind === "productProjection" && pattern.side === term.side && equalObject(pattern.product, term.product)
        ? env
        : undefined;
    case "productPair": {
      if (term.kind !== "productPair" || !equalObject(pattern.product, term.product)) {
        return undefined;
      }
      const leftEnv = matchTermWithEnv(pattern.left, term.left, env);
      return leftEnv ? matchTermWithEnv(pattern.right, term.right, leftEnv) : undefined;
    }
  }
}

function matchObjectWithEnv(pattern: PatternObject, object: ObjectExpr, env: MatchEnv): MatchEnv | undefined {
  if (pattern.kind === "objectPattern") {
    return bindObject(pattern.name, object, env);
  }

  if (pattern.kind !== object.kind) {
    return undefined;
  }

  switch (pattern.kind) {
    case "object":
      return object.kind === "object" && equalObject(pattern, object) ? env : undefined;
    case "functorObject": {
      if (object.kind !== "functorObject" || !equalFunctor(pattern.functor, object.functor)) {
        return undefined;
      }
      return matchObjectWithEnv(pattern.object, object.object, env);
    }
  }
}

function bindObject(name: string, object: ObjectExpr, env: MatchEnv): MatchEnv | undefined {
  const existing = env.objects.get(name);
  if (existing) {
    return equalObject(existing, object) ? env : undefined;
  }

  env.objects.set(name, object);
  return env;
}

function bindTerm(name: string, term: Term, env: MatchEnv): MatchEnv | undefined {
  const existing = env.terms.get(name);
  if (existing) {
    return equalTerm(existing, term) ? env : undefined;
  }

  env.terms.set(name, term);
  return env;
}

function instantiateTerm(pattern: PatternTerm, env: MatchEnv): Term {
  switch (pattern.kind) {
    case "termPattern": {
      const term = env.terms.get(pattern.name);
      if (!term) {
        throw new Error(`Unbound term pattern: ${pattern.name}`);
      }
      return term;
    }
    case "var":
      return pattern;
    case "id":
      return id(instantiateObject(pattern.object, env));
    case "comp":
      return comp(instantiateTerm(pattern.first, env), instantiateTerm(pattern.second, env));
    case "map":
      return map(pattern.functor, instantiateTerm(pattern.term, env));
    case "unit":
      return unit(pattern.adjunction, instantiateObject(pattern.object, env));
    case "counit":
      return counit(pattern.adjunction, instantiateObject(pattern.object, env));
    case "component":
      return component(pattern.natTrans, instantiateObject(pattern.object, env));
    case "productProjection":
      return productProjection(pattern.product, pattern.side);
    case "productPair":
      return productPair(pattern.product, instantiateTerm(pattern.left, env), instantiateTerm(pattern.right, env));
  }
}

function instantiateObject(pattern: PatternObject, env: MatchEnv): ObjectExpr {
  switch (pattern.kind) {
    case "objectPattern": {
      const object = env.objects.get(pattern.name);
      if (!object) {
        throw new Error(`Unbound object pattern: ${pattern.name}`);
      }
      return object;
    }
    case "object":
      return pattern;
    case "functorObject":
      return {
        kind: "functorObject",
        functor: pattern.functor,
        object: instantiateObject(pattern.object, env)
      };
  }
}
