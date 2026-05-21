import type { Equation, HomType, ObjectExpr, Term } from "./syntax";

export function prettyEquation(equation: Equation): string {
  return `${prettyTerm(equation.lhs)} = ${prettyTerm(equation.rhs)}`;
}

export function prettyTerm(term: Term): string {
  switch (term.kind) {
    case "var":
      return term.name;
    case "id":
      return `id(${prettyObject(term.object)})`;
    case "comp":
      return `${parenthesizeComp(term.first)} >> ${prettyTerm(term.second)}`;
    case "map":
      return `${term.functor.name}.map(${prettyTerm(term.term)})`;
    case "unit":
      return `eta(${term.adjunction.name}, ${prettyObject(term.object)})`;
    case "counit":
      return `eps(${term.adjunction.name}, ${prettyObject(term.object)})`;
    case "component":
      return `${term.natTrans.name}_${prettyObject(term.object)}`;
  }
}

export function prettyObject(object: ObjectExpr): string {
  switch (object.kind) {
    case "object":
      return object.name;
    case "functorObject":
      return `${object.functor.name} ${prettyObject(object.object)}`;
  }
}

export function prettyHom(hom: HomType): string {
  return `${prettyObject(hom.source)} -> ${prettyObject(hom.target)}`;
}

export function latexEquation(equation: Equation): string {
  return `${latexTerm(equation.lhs)} = ${latexTerm(equation.rhs)}`;
}

export function latexTerm(term: Term): string {
  switch (term.kind) {
    case "var":
      return latexName(term.name);
    case "id":
      return `\\operatorname{id}_{${latexObject(term.object)}}`;
    case "comp":
      return `${latexTerm(term.second)} \\circ ${parenthesizeLatexComp(term.first)}`;
    case "map":
      return `${latexName(term.functor.name)}(${latexTerm(term.term)})`;
    case "unit":
      return `\\eta^{${latexName(term.adjunction.name)}}_{${latexObject(term.object)}}`;
    case "counit":
      return `\\varepsilon^{${latexName(term.adjunction.name)}}_{${latexObject(term.object)}}`;
    case "component":
      return `${latexName(term.natTrans.name)}_{${latexObject(term.object)}}`;
  }
}

export function latexObject(object: ObjectExpr): string {
  switch (object.kind) {
    case "object":
      return latexName(object.name);
    case "functorObject":
      return `${latexName(object.functor.name)}(${latexObject(object.object)})`;
  }
}

export function latexHom(hom: HomType): string {
  return `${latexObject(hom.source)} \\to ${latexObject(hom.target)}`;
}

function parenthesizeComp(term: Term): string {
  return term.kind === "comp" ? `(${prettyTerm(term)})` : prettyTerm(term);
}

function parenthesizeLatexComp(term: Term): string {
  return term.kind === "comp" ? `\\left(${latexTerm(term)}\\right)` : latexTerm(term);
}

function latexName(name: string): string {
  const escaped = escapeLatex(name);
  const greek = greekNames.get(escaped);
  if (greek) {
    return greek;
  }

  const match = /^([A-Za-z]+)(?:[_-]([A-Za-z0-9-]+))?$/.exec(escaped);
  if (!match || !match[2]) {
    return escaped;
  }

  return `${latexName(match[1])}_{${escapeLatex(match[2]).replace(/-/g, "\\text{-}")}}`;
}

function escapeLatex(value: string): string {
  return value.replace(/\\/g, "\\backslash{}").replace(/([#$%&_{}])/g, "\\$1");
}

const greekNames = new Map([
  ["alpha", "\\alpha"],
  ["beta", "\\beta"],
  ["gamma", "\\gamma"],
  ["delta", "\\delta"],
  ["epsilon", "\\epsilon"],
  ["eta", "\\eta"],
  ["theta", "\\theta"],
  ["lambda", "\\lambda"],
  ["mu", "\\mu"],
  ["nu", "\\nu"],
  ["pi", "\\pi"],
  ["rho", "\\rho"],
  ["sigma", "\\sigma"],
  ["tau", "\\tau"],
  ["phi", "\\phi"],
  ["psi", "\\psi"],
  ["omega", "\\omega"]
]);
