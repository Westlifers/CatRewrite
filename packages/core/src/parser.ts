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
  unit,
  type AdjunctionExpr,
  type Context,
  type FunctorExpr,
  type NatTransExpr,
  type ObjectExpr,
  type ObjectVarExpr,
  type Term
} from "./syntax";
import { comp, id, map } from "./syntax";
import { typecheckEquation } from "./typecheck";

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

  const morph = findMorphism(ctx, trimmed);
  if (morph) {
    return morph;
  }

  throw new ParseError(`Could not parse term: ${input}`);
}

export function parseObjectExpr(input: string, ctx: Context): ObjectExpr {
  const trimmed = stripOuterParens(input.trim());
  const parts = trimmed.split(/\s+/);

  if (parts.length === 1) {
    const objectDecl = ctx.decls.find((decl) => decl.kind === "objectDecl" && decl.object.name === parts[0]);
    if (objectDecl?.kind === "objectDecl") {
      return objectDecl.object;
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

function findMorphism(ctx: Context, name: string): ReturnType<typeof morphism> | undefined {
  const decl = ctx.decls.find((candidate) => candidate.kind === "morphismDecl" && candidate.term.name === name);
  return decl?.kind === "morphismDecl" ? decl.term : undefined;
}

function splitTopLevel(input: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  let index = 0;

  while (index < input.length) {
    const char = input[index];
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
    } else if (depth === 0 && input.startsWith(separator, index)) {
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
