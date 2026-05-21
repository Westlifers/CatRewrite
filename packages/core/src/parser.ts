import {
  adjunction,
  category,
  component,
  counit,
  functor,
  functorObject,
  morphism,
  natTrans,
  object,
  productObject,
  productPair,
  productProjection,
  unit,
  type AdjunctionExpr,
  type Context,
  type FunctorExpr,
  type NatTransExpr,
  type ObjectExpr,
  type ObjectVarExpr,
  type ProductDecl,
  type Term
} from "./syntax";
import { comp, id, map } from "./syntax";
import { equalCategory, equalObject, objectCategory } from "./equality";
import { inferTerm, typecheckEquation } from "./typecheck";

export class ParseError extends Error {
  readonly kind = "parseError";
}

interface Env {
  categories: Map<string, ReturnType<typeof category>>;
  objects: Map<string, ObjectVarExpr>;
  functors: Map<string, FunctorExpr>;
  natTrans: Map<string, NatTransExpr>;
  adjunctions: Map<string, AdjunctionExpr>;
  morphisms: Map<string, ReturnType<typeof morphism>>;
}

export function parseContext(input: string): Context {
  const env = emptyEnv();
  const ctx: Context = { decls: [] };
  const lines = input
    .split(/\r?\n/)
    .map((line) => stripComment(line).trim())
    .filter(Boolean);

  for (const line of lines) {
    if (line.startsWith("category ")) {
      const name = line.slice("category ".length).trim();
      assertName(name, "category name");
      const parsed = category(name);
      env.categories.set(name, parsed);
      ctx.decls.push({ kind: "categoryDecl", category: parsed });
      continue;
    }

    const objectMatch = /^object\s+([A-Za-z][A-Za-z0-9_]*)\s*:\s*([A-Za-z][A-Za-z0-9_]*)$/.exec(line);
    if (objectMatch) {
      const parsed = object(objectMatch[1], requireMap(env.categories, objectMatch[2], "category"));
      env.objects.set(parsed.name, parsed);
      ctx.decls.push({ kind: "objectDecl", object: parsed });
      continue;
    }

    const productMatch = /^product\s+([A-Za-z][A-Za-z0-9_]*)\s+of\s+(.+)\s+(.+)$/.exec(line);
    if (productMatch) {
      const left = parseObjectExpr(productMatch[2], ctx);
      const right = parseObjectExpr(productMatch[3], ctx);
      const leftCategory = objectCategory(left);
      const rightCategory = objectCategory(right);
      if (!equalCategory(leftCategory, rightCategory)) {
        throw new ParseError("Product factors must belong to the same category.");
      }
      const parsed = productObject(productMatch[1], leftCategory, left, right);
      env.objects.set(parsed.name, parsed);
      ctx.decls.push({ kind: "productDecl", product: parsed, left, right });
      continue;
    }

    const functorMatch =
      /^functor\s+([A-Za-z][A-Za-z0-9_]*)\s*:\s*([A-Za-z][A-Za-z0-9_]*)\s*->\s*([A-Za-z][A-Za-z0-9_]*)$/.exec(
        line
      );
    if (functorMatch) {
      const parsed = functor(
        functorMatch[1],
        requireMap(env.categories, functorMatch[2], "category"),
        requireMap(env.categories, functorMatch[3], "category")
      );
      env.functors.set(parsed.name, parsed);
      ctx.decls.push({ kind: "functorDecl", functor: parsed });
      continue;
    }

    const natTransMatch =
      /^nattrans\s+([A-Za-z][A-Za-z0-9_]*)\s*:\s*([A-Za-z][A-Za-z0-9_]*)\s*=>\s*([A-Za-z][A-Za-z0-9_]*)$/.exec(
        line
      );
    if (natTransMatch) {
      const parsed = natTrans(
        natTransMatch[1],
        requireMap(env.functors, natTransMatch[2], "functor"),
        requireMap(env.functors, natTransMatch[3], "functor")
      );
      env.natTrans.set(parsed.name, parsed);
      ctx.decls.push({ kind: "natTransDecl", natTrans: parsed });
      continue;
    }

    const adjunctionMatch = /^adjunction\s+([A-Za-z][A-Za-z0-9_]*)\s*:\s*([A-Za-z][A-Za-z0-9_]*)\s*(?:-\||⊣)\s*([A-Za-z][A-Za-z0-9_]*)$/.exec(line);
    if (adjunctionMatch) {
      const parsed = adjunction(
        adjunctionMatch[1],
        requireMap(env.functors, adjunctionMatch[2], "functor"),
        requireMap(env.functors, adjunctionMatch[3], "functor")
      );
      env.adjunctions.set(parsed.name, parsed);
      ctx.decls.push({ kind: "adjunctionDecl", adjunction: parsed });
      continue;
    }

    const morphismMatch = /^morphism\s+([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.+)\s*->\s*(.+)$/.exec(line);
    if (morphismMatch) {
      const parsed = morphism(
        morphismMatch[1],
        parseObjectExpr(morphismMatch[2], ctx),
        parseObjectExpr(morphismMatch[3], ctx)
      );
      env.morphisms.set(parsed.name, parsed);
      ctx.decls.push({ kind: "morphismDecl", term: parsed });
      continue;
    }

    throw new ParseError(`Could not parse context declaration: ${line}`);
  }

  return ctx;
}

export function parseEquation(input: string, ctx: Context) {
  const parts = splitTopLevel(input, "=");
  if (parts.length !== 2) {
    throw new ParseError("Expected an equation with exactly one top-level '='.");
  }

  return typecheckEquation(ctx, parseTerm(parts[0], ctx), parseTerm(parts[1], ctx));
}

export function parseTerm(input: string, ctx: Context): Term {
  const trimmed = stripOuterParens(input.trim());
  const pieces = splitTopLevel(trimmed, ">>");
  if (pieces.length > 1) {
    return pieces.map((piece) => parseTerm(piece, ctx)).reduce((first, second) => comp(first, second));
  }

  const idMatch = /^id\s*\((.+)\)$/.exec(trimmed) ?? /^id\s+(.+)$/.exec(trimmed);
  if (idMatch) {
    return id(parseObjectExpr(idMatch[1], ctx));
  }

  const mapMatch = /^([A-Za-z][A-Za-z0-9_]*)\.map\s*\((.+)\)$/.exec(trimmed);
  if (mapMatch) {
    return map(requireFunctor(ctx, mapMatch[1]), parseTerm(mapMatch[2], ctx));
  }

  const etaMatch = /^eta\s*\(\s*([A-Za-z][A-Za-z0-9_]*)\s*,\s*(.+)\)$/.exec(trimmed);
  if (etaMatch) {
    return unit(requireAdjunction(ctx, etaMatch[1]), parseObjectExpr(etaMatch[2], ctx));
  }

  const epsMatch = /^eps\s*\(\s*([A-Za-z][A-Za-z0-9_]*)\s*,\s*(.+)\)$/.exec(trimmed);
  if (epsMatch) {
    return counit(requireAdjunction(ctx, epsMatch[1]), parseObjectExpr(epsMatch[2], ctx));
  }

  const componentMatch = /^([A-Za-z][A-Za-z0-9_]*)_([A-Za-z][A-Za-z0-9_]*)$/.exec(trimmed);
  if (componentMatch) {
    return component(requireNatTrans(ctx, componentMatch[1]), parseObjectExpr(componentMatch[2], ctx));
  }

  const piMatch = /^pi([12])\s*\(\s*([A-Za-z][A-Za-z0-9_]*)\s*\)$/.exec(trimmed);
  if (piMatch) {
    return productProjection(requireProduct(ctx, piMatch[2]).product, piMatch[1] === "1" ? "left" : "right");
  }

  const pairCallMatch = /^pair\s*\(\s*([A-Za-z][A-Za-z0-9_]*)\s*,\s*(.+)\s*,\s*(.+)\)$/.exec(trimmed);
  if (pairCallMatch) {
    return productPair(
      requireProduct(ctx, pairCallMatch[1]).product,
      parseTerm(pairCallMatch[2], ctx),
      parseTerm(pairCallMatch[3], ctx)
    );
  }

  const anglePairMatch = /^<(.+),(.+)>(?:_([A-Za-z][A-Za-z0-9_]*))?$/.exec(trimmed);
  if (anglePairMatch) {
    const left = parseTerm(anglePairMatch[1], ctx);
    const right = parseTerm(anglePairMatch[2], ctx);
    const product = anglePairMatch[3] ? requireProduct(ctx, anglePairMatch[3]) : resolvePairProduct(ctx, left, right);
    return productPair(product.product, left, right);
  }

  const morph = findMorphism(ctx, trimmed);
  if (morph) {
    return morph;
  }

  throw new ParseError(`Could not parse term: ${input}`);
}

export function parseObjectExpr(input: string, ctx: Context): ObjectExpr {
  const trimmed = stripOuterParens(input.trim());
  const productParts = splitProductObject(trimmed);
  if (productParts) {
    return resolveProductObject(ctx, parseObjectExpr(productParts[0], ctx), parseObjectExpr(productParts[1], ctx));
  }

  const parts = trimmed.split(/\s+/);

  if (parts.length === 1) {
    const objectDecl = ctx.decls.find((decl) => decl.kind === "objectDecl" && decl.object.name === parts[0]);
    if (objectDecl?.kind === "objectDecl") {
      return objectDecl.object;
    }
    const productDecl = ctx.decls.find((decl): decl is ProductDecl => decl.kind === "productDecl" && decl.product.name === parts[0]);
    if (productDecl) {
      return productDecl.product;
    }
    throw new ParseError(`Unknown object: ${parts[0]}`);
  }

  if (parts.length === 2) {
    return functorObject(requireFunctor(ctx, parts[0]), parseObjectExpr(parts[1], ctx));
  }

  throw new ParseError(`Could not parse object expression: ${input}`);
}

function emptyEnv(): Env {
  return {
    categories: new Map(),
    objects: new Map(),
    functors: new Map(),
    natTrans: new Map(),
    adjunctions: new Map(),
    morphisms: new Map()
  };
}

function stripComment(line: string): string {
  return line.replace(/#.*/, "");
}

function assertName(name: string, label: string): void {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) {
    throw new ParseError(`Invalid ${label}: ${name}`);
  }
}

function requireMap<T>(map: Map<string, T>, key: string, label: string): T {
  const value = map.get(key);
  if (!value) {
    throw new ParseError(`Unknown ${label}: ${key}`);
  }
  return value;
}

function requireFunctor(ctx: Context, name: string): FunctorExpr {
  const decl = ctx.decls.find((candidate) => candidate.kind === "functorDecl" && candidate.functor.name === name);
  if (decl?.kind !== "functorDecl") {
    throw new ParseError(`Unknown functor: ${name}`);
  }
  return decl.functor;
}

function requireNatTrans(ctx: Context, name: string): NatTransExpr {
  const decl = ctx.decls.find((candidate) => candidate.kind === "natTransDecl" && candidate.natTrans.name === name);
  if (decl?.kind !== "natTransDecl") {
    throw new ParseError(`Unknown natural transformation: ${name}`);
  }
  return decl.natTrans;
}

function requireAdjunction(ctx: Context, name: string): AdjunctionExpr {
  const decl = ctx.decls.find((candidate) => candidate.kind === "adjunctionDecl" && candidate.adjunction.name === name);
  if (decl?.kind !== "adjunctionDecl") {
    throw new ParseError(`Unknown adjunction: ${name}`);
  }
  return decl.adjunction;
}

function requireProduct(ctx: Context, name: string): ProductDecl {
  const decl = ctx.decls.find((candidate): candidate is ProductDecl => candidate.kind === "productDecl" && candidate.product.name === name);
  if (!decl) {
    throw new ParseError(`Unknown product: ${name}`);
  }
  return decl;
}

function findMorphism(ctx: Context, name: string): ReturnType<typeof morphism> | undefined {
  const decl = ctx.decls.find((candidate) => candidate.kind === "morphismDecl" && candidate.term.name === name);
  return decl?.kind === "morphismDecl" ? decl.term : undefined;
}

function resolvePairProduct(ctx: Context, left: Term, right: Term): ProductDecl {
  const leftHom = inferTerm(ctx, left);
  const rightHom = inferTerm(ctx, right);
  if (!equalObject(leftHom.source, rightHom.source)) {
    throw new ParseError("Cannot infer product pairing target: paired morphisms must have the same source.");
  }
  return resolveProductDecl(ctx, leftHom.target, rightHom.target);
}

function resolveProductObject(ctx: Context, left: ObjectExpr, right: ObjectExpr): ObjectVarExpr {
  return resolveProductDecl(ctx, left, right).product;
}

function resolveProductDecl(ctx: Context, left: ObjectExpr, right: ObjectExpr): ProductDecl {
  const matches = ctx.decls.filter(
    (decl): decl is ProductDecl =>
      decl.kind === "productDecl" && equalObject(decl.left, left) && equalObject(decl.right, right)
  );
  if (matches.length === 0) {
    throw new ParseError("No chosen product of these factors is declared.");
  }
  if (matches.length > 1) {
    throw new ParseError(`Ambiguous product ${matches.map((decl) => decl.product.name).join(", ")}; use a product name explicitly.`);
  }
  return matches[0];
}

function splitProductObject(input: string): [string, string] | undefined {
  for (const separator of ["\\times", " times ", " x ", " * ", " × "]) {
    const parts = splitTopLevel(input, separator).filter(Boolean);
    if (parts.length === 2) {
      return [parts[0], parts[1]];
    }
  }
  return undefined;
}

function splitTopLevel(input: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let angleDepth = 0;
  let start = 0;
  let index = 0;

  while (index < input.length) {
    const char = input[index];
    if (angleDepth > 0 && input.startsWith(">>", index)) {
      index += 2;
      continue;
    }
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
    } else if (char === "<") {
      angleDepth += 1;
    } else if (char === ">" && angleDepth > 0 && !input.startsWith(">>", index)) {
      angleDepth -= 1;
    } else if (depth === 0 && angleDepth === 0 && input.startsWith(separator, index)) {
      parts.push(input.slice(start, index).trim());
      index += separator.length;
      start = index;
      continue;
    }
    index += 1;
  }

  parts.push(input.slice(start).trim());
  return parts;
}

function stripOuterParens(input: string): string {
  let current = input;
  while (current.startsWith("(") && current.endsWith(")") && enclosesAll(current)) {
    current = current.slice(1, -1).trim();
  }
  return current;
}

function enclosesAll(input: string): boolean {
  let depth = 0;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
      if (depth === 0 && index < input.length - 1) {
        return false;
      }
    }
  }
  return depth === 0;
}
