import {
  comp,
  component,
  counit,
  functorObject,
  map,
  type AdjunctionDecl,
  type Context,
  type Equation,
  type FunctorDecl,
  type MorphismDecl,
  type NatTransDecl,
  type ObjectDecl,
  type ObjectExpr,
  type Term
} from "./syntax";
import { inferTerm, typecheckEquation } from "./typecheck";
import { equalObject } from "./equality";
import { normalizeTerm } from "./normalize";
import { prettyObject, prettyTerm } from "./pretty";

export interface Diagram {
  id: string;
  nodes: DiagramNode[];
  arrows: DiagramArrow[];
  regions: DiagramRegion[];
}

export interface DiagramNode {
  id: string;
  label: string;
  object: ObjectExpr;
  position: { x: number; y: number };
  status?: "given" | "constructed" | "auxiliary";
}

export interface DiagramArrow {
  id: string;
  from: string;
  to: string;
  label: string;
  term: Term;
  status: "given" | "constructed" | "placeholder" | "auxiliary";
}

export interface DiagramRegion {
  id: string;
  label?: string;
  leftPath: string[];
  rightPath: string[];
  goalId?: string;
}

export class DiagramError extends Error {
  readonly kind = "diagramError";
}

export interface AuxiliaryArrowInput {
  id: string;
  from: string;
  to: string;
  label: string;
  term: Term;
}

export interface AuxiliaryNodeInput {
  id: string;
  label?: string;
  object: ObjectExpr;
  position?: { x: number; y: number };
}

export function addAuxiliaryNode(diagram: Diagram, input: AuxiliaryNodeInput): Diagram {
  const id = input.id.trim();
  if (!id) {
    throw new DiagramError("Auxiliary node id is required.");
  }

  if (diagram.nodes.some((node) => node.id === id)) {
    throw new DiagramError(`Node already exists: ${id}`);
  }

  return {
    ...diagram,
    nodes: [
      ...diagram.nodes,
      {
        id,
        label: input.label?.trim() || prettyObject(input.object),
        object: input.object,
        position: input.position ?? nextAuxiliaryNodePosition(diagram),
        status: "auxiliary"
      }
    ]
  };
}

export function addAuxiliaryArrow(ctx: Context, diagram: Diagram, input: AuxiliaryArrowInput): Diagram {
  if (diagram.arrows.some((arrow) => arrow.id === input.id)) {
    throw new DiagramError(`Arrow already exists: ${input.id}`);
  }

  const sourceNode = requireNode(diagram, input.from);
  const targetNode = requireNode(diagram, input.to);
  const hom = inferTerm(ctx, input.term);

  if (!equalObject(hom.source, sourceNode.object) || !equalObject(hom.target, targetNode.object)) {
    throw new DiagramError("Auxiliary arrow term does not match the selected source and target nodes.");
  }

  return {
    ...diagram,
    arrows: [
      ...diagram.arrows,
      {
        id: input.id,
        from: input.from,
        to: input.to,
        label: input.label,
        term: input.term,
        status: "auxiliary"
      }
    ]
  };
}

export function removeAuxiliaryArrow(diagram: Diagram, arrowId: string): Diagram {
  const arrow = requireArrow(diagram, arrowId);
  if (arrow.status !== "auxiliary") {
    throw new DiagramError(`Only auxiliary arrows can be removed: ${arrowId}`);
  }

  return removeArrows(diagram, new Set([arrowId]));
}

export function removeAuxiliaryNode(diagram: Diagram, nodeId: string): Diagram {
  const node = requireNode(diagram, nodeId);
  if (node.status !== "auxiliary") {
    throw new DiagramError(`Only auxiliary nodes can be removed: ${nodeId}`);
  }

  const incidentAuxiliaryArrowIds = new Set(
    diagram.arrows
      .filter((arrow) => arrow.status === "auxiliary" && (arrow.from === nodeId || arrow.to === nodeId))
      .map((arrow) => arrow.id)
  );

  return {
    ...removeArrows(diagram, incidentAuxiliaryArrowIds),
    nodes: diagram.nodes.filter((candidate) => candidate.id !== nodeId)
  };
}

function removeArrows(diagram: Diagram, arrowIds: Set<string>): Diagram {
  return {
    ...diagram,
    arrows: diagram.arrows.filter((arrow) => !arrowIds.has(arrow.id)),
    regions: diagram.regions.filter(
      (region) => !region.leftPath.some((arrowId) => arrowIds.has(arrowId)) && !region.rightPath.some((arrowId) => arrowIds.has(arrowId))
    )
  };
}

function nextAuxiliaryNodePosition(diagram: Diagram): { x: number; y: number } {
  const auxiliaryIndex = diagram.nodes.filter((node) => /^aux-node(?:-|$)/.test(node.id)).length;
  return {
    x: 135 + (auxiliaryIndex % 3) * 100,
    y: 155 + Math.floor(auxiliaryIndex / 3) * 52
  };
}

export function pathTerm(ctx: Context, diagram: Diagram, path: string[]): Term {
  if (path.length === 0) {
    throw new DiagramError("A path must contain at least one arrow.");
  }

  const arrows = path.map((arrowId) => requireArrow(diagram, arrowId));
  for (let index = 1; index < arrows.length; index += 1) {
    if (arrows[index - 1].to !== arrows[index].from) {
      throw new DiagramError(`Path is not composable at ${arrows[index - 1].id} then ${arrows[index].id}.`);
    }
  }

  const term = arrows.map((arrow) => arrow.term).reduce((first, second) => comp(first, second));
  inferTerm(ctx, term);
  return term;
}

export function regionEquation(ctx: Context, diagram: Diagram, leftPath: string[], rightPath: string[]): Equation {
  const leftStart = pathStart(diagram, leftPath);
  const rightStart = pathStart(diagram, rightPath);
  const leftEnd = pathEnd(diagram, leftPath);
  const rightEnd = pathEnd(diagram, rightPath);

  if (leftStart !== rightStart || leftEnd !== rightEnd) {
    throw new DiagramError("Selected paths must have the same start and end nodes.");
  }

  const lhs = pathTerm(ctx, diagram, leftPath);
  const rhs = pathTerm(ctx, diagram, rightPath);
  const equation = typecheckEquation(ctx, lhs, rhs);

  const startObject = requireNode(diagram, leftStart).object;
  const endObject = requireNode(diagram, leftEnd).object;
  if (!equalObject(equation.hom.source, startObject) || !equalObject(equation.hom.target, endObject)) {
    throw new DiagramError("Path term hom-type does not match the selected diagram endpoints.");
  }

  return equation;
}

export function equationDiagram(ctx: Context, equation: Equation): Diagram {
  const lhsTerms = flattenComp(normalizeTerm(ctx, equation.lhs));
  const rhsTerms = flattenComp(normalizeTerm(ctx, equation.rhs));
  const nodes = new Map<string, DiagramNode>();
  const arrows: DiagramArrow[] = [];
  const sourceKey = objectKey(equation.hom.source);
  const targetKey = equalObject(equation.hom.source, equation.hom.target)
    ? `${sourceKey}-target`
    : objectKey(equation.hom.target);

  nodes.set(sourceKey, {
    id: sourceKey,
    label: prettyObject(equation.hom.source),
    object: equation.hom.source,
    position: { x: 55, y: 155 }
  });
  nodes.set(targetKey, {
    id: targetKey,
    label: prettyObject(equation.hom.target),
    object: equation.hom.target,
    position: { x: 415, y: 155 }
  });

  const leftPath = addPath(ctx, "lhs", lhsTerms, 78, sourceKey, targetKey, nodes, arrows);
  const rightPath = addPath(ctx, "rhs", rhsTerms, 232, sourceKey, targetKey, nodes, arrows);

  return {
    id: "goal-diagram",
    nodes: [...nodes.values()],
    arrows,
    regions: [
      {
        id: "goal",
        label: "current goal",
        leftPath,
        rightPath
      }
    ]
  };
}

export function counitNaturalityDiagram(ctx: Context, morphismName = "f"): Diagram {
  const adjunctionDecl = ctx.decls.find((decl): decl is AdjunctionDecl => decl.kind === "adjunctionDecl");
  const morphismDecl = ctx.decls.find(
    (decl): decl is MorphismDecl => decl.kind === "morphismDecl" && decl.term.name === morphismName
  );

  if (!adjunctionDecl || !morphismDecl) {
    throw new DiagramError("Counit naturality diagram needs an adjunction and a named morphism.");
  }

  const adjunction = adjunctionDecl.adjunction;
  const left = requireFunctorDecl(ctx, adjunction.left.name).functor;
  const right = requireFunctorDecl(ctx, adjunction.right.name).functor;
  const term = morphismDecl.term;
  const source = term.hom.source;
  const target = term.hom.target;
  const rightSource = functorObject(right, source);
  const rightTarget = functorObject(right, target);
  const leftRightSource = functorObject(left, rightSource);
  const leftRightTarget = functorObject(left, rightTarget);

  return {
    id: "counit-naturality",
    nodes: [
      { id: "fgfx", label: `${left.name} ${right.name} ${objectLabel(source)}`, object: leftRightSource, position: { x: 40, y: 40 } },
      { id: "fgy", label: `${left.name} ${right.name} ${objectLabel(target)}`, object: leftRightTarget, position: { x: 330, y: 40 } },
      { id: "fx", label: objectLabel(source), object: source, position: { x: 40, y: 220 } },
      { id: "y", label: objectLabel(target), object: target, position: { x: 330, y: 220 } }
    ],
    arrows: [
      {
        id: "top",
        from: "fgfx",
        to: "fgy",
        label: `${left.name}.map(${right.name}.map(${term.name}))`,
        term: map(left, map(right, term)),
        status: "constructed"
      },
      {
        id: "right",
        from: "fgy",
        to: "y",
        label: `eps(${adjunction.name}, ${objectLabel(target)})`,
        term: counit(adjunction, target),
        status: "constructed"
      },
      {
        id: "left",
        from: "fgfx",
        to: "fx",
        label: `eps(${adjunction.name}, ${objectLabel(source)})`,
        term: counit(adjunction, source),
        status: "constructed"
      },
      { id: "bottom", from: "fx", to: "y", label: term.name, term, status: "given" }
    ],
    regions: [
      {
        id: "square",
        label: "counit naturality",
        leftPath: ["top", "right"],
        rightPath: ["left", "bottom"]
      }
    ]
  };
}

export function verticalCompositeNaturalityDiagram(
  ctx: Context,
  firstName = "alpha",
  secondName = "beta",
  morphismName = "f"
): Diagram {
  const first = requireNatTransDecl(ctx, firstName).natTrans;
  const second = requireNatTransDecl(ctx, secondName).natTrans;
  const morphismDecl = ctx.decls.find(
    (decl): decl is MorphismDecl => decl.kind === "morphismDecl" && decl.term.name === morphismName
  );

  if (!morphismDecl) {
    throw new DiagramError(`Unknown morphism: ${morphismName}`);
  }

  const term = morphismDecl.term;
  const source = requireObjectDecl(ctx, objectLabel(term.hom.source)).object;
  const target = requireObjectDecl(ctx, objectLabel(term.hom.target)).object;
  const topLeft = functorObject(first.source, source);
  const topRight = functorObject(first.source, target);
  const middleLeft = functorObject(first.target, source);
  const middleRight = functorObject(first.target, target);
  const bottomLeft = functorObject(second.target, source);
  const bottomRight = functorObject(second.target, target);

  return {
    id: "vertical-composite-naturality",
    nodes: [
      { id: "fx", label: prettyObject(topLeft), object: topLeft, position: { x: 40, y: 40 } },
      { id: "fy", label: prettyObject(topRight), object: topRight, position: { x: 330, y: 40 } },
      { id: "gx", label: prettyObject(middleLeft), object: middleLeft, position: { x: 40, y: 155 } },
      { id: "gy", label: prettyObject(middleRight), object: middleRight, position: { x: 330, y: 155 } },
      { id: "hx", label: prettyObject(bottomLeft), object: bottomLeft, position: { x: 40, y: 270 } },
      { id: "hy", label: prettyObject(bottomRight), object: bottomRight, position: { x: 330, y: 270 } }
    ],
    arrows: [
      { id: "f-top", from: "fx", to: "fy", label: `${first.source.name}.map(${term.name})`, term: map(first.source, term), status: "constructed" },
      { id: "g-mid", from: "gx", to: "gy", label: `${first.target.name}.map(${term.name})`, term: map(first.target, term), status: "constructed" },
      { id: "h-bottom", from: "hx", to: "hy", label: `${second.target.name}.map(${term.name})`, term: map(second.target, term), status: "constructed" },
      { id: "alpha-x", from: "fx", to: "gx", label: `${first.name}_${objectLabel(source)}`, term: component(first, source), status: "given" },
      { id: "alpha-y", from: "fy", to: "gy", label: `${first.name}_${objectLabel(target)}`, term: component(first, target), status: "given" },
      { id: "beta-x", from: "gx", to: "hx", label: `${second.name}_${objectLabel(source)}`, term: component(second, source), status: "given" },
      { id: "beta-y", from: "gy", to: "hy", label: `${second.name}_${objectLabel(target)}`, term: component(second, target), status: "given" }
    ],
    regions: [
      {
        id: "outer",
        label: "vertical composite naturality",
        leftPath: ["f-top", "alpha-y", "beta-y"],
        rightPath: ["alpha-x", "beta-x", "h-bottom"]
      },
      {
        id: "alpha-square",
        label: `${first.name} naturality`,
        leftPath: ["f-top", "alpha-y"],
        rightPath: ["alpha-x", "g-mid"]
      },
      {
        id: "beta-square",
        label: `${second.name} naturality`,
        leftPath: ["g-mid", "beta-y"],
        rightPath: ["beta-x", "h-bottom"]
      }
    ]
  };
}

function pathStart(diagram: Diagram, path: string[]): string {
  return requireArrow(diagram, path[0]).from;
}

function pathEnd(diagram: Diagram, path: string[]): string {
  return requireArrow(diagram, path[path.length - 1]).to;
}

function requireArrow(diagram: Diagram, arrowId: string): DiagramArrow {
  const arrow = diagram.arrows.find((candidate) => candidate.id === arrowId);
  if (!arrow) {
    throw new DiagramError(`Unknown arrow: ${arrowId}`);
  }
  return arrow;
}

function requireNode(diagram: Diagram, nodeId: string): DiagramNode {
  const node = diagram.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) {
    throw new DiagramError(`Unknown node: ${nodeId}`);
  }
  return node;
}

function addPath(
  ctx: Context,
  prefix: "lhs" | "rhs",
  terms: Term[],
  y: number,
  sourceId: string,
  targetId: string,
  nodes: Map<string, DiagramNode>,
  arrows: DiagramArrow[]
): string[] {
  const path: string[] = [];

  for (let index = 0; index < terms.length; index += 1) {
    const term = terms[index];
    const hom = inferTerm(ctx, term);
    const arrowSourceId = ensurePathNode(prefix, index, terms.length, hom.source, y, sourceId, targetId, nodes);
    const arrowTargetId = ensurePathNode(prefix, index + 1, terms.length, hom.target, y, sourceId, targetId, nodes);
    const arrowId = `${prefix}-${index + 1}`;

    arrows.push({
      id: arrowId,
      from: arrowSourceId,
      to: arrowTargetId,
      label: prettyTerm(term),
      term,
      status: prefix === "rhs" && terms.length === 1 && term.kind === "var" ? "given" : "constructed"
    });
    path.push(arrowId);
  }

  return path;
}

function ensurePathNode(
  prefix: "lhs" | "rhs",
  index: number,
  length: number,
  object: ObjectExpr,
  y: number,
  sourceId: string,
  targetId: string,
  nodes: Map<string, DiagramNode>
): string {
  const id = index === 0 ? sourceId : index === length ? targetId : `${prefix}-node-${index}`;
  const endpoint = index === 0 || index === length;
  if (!nodes.has(id)) {
    const x = 55 + (360 * index) / Math.max(length, 1);
    nodes.set(id, {
      id,
      label: prettyObject(object),
      object,
      position: {
        x,
        y: endpoint ? 155 : y
      }
    });
  }
  return id;
}

function flattenComp(term: Term): Term[] {
  return term.kind === "comp" ? [...flattenComp(term.first), ...flattenComp(term.second)] : [term];
}

function requireFunctorDecl(ctx: Context, name: string): FunctorDecl {
  const decl = ctx.decls.find((candidate): candidate is FunctorDecl => candidate.kind === "functorDecl" && candidate.functor.name === name);
  if (!decl) {
    throw new DiagramError(`Unknown functor: ${name}`);
  }
  return decl;
}

function requireNatTransDecl(ctx: Context, name: string): NatTransDecl {
  const decl = ctx.decls.find((candidate): candidate is NatTransDecl => candidate.kind === "natTransDecl" && candidate.natTrans.name === name);
  if (!decl) {
    throw new DiagramError(`Unknown natural transformation: ${name}`);
  }
  return decl;
}

function requireObjectDecl(ctx: Context, name: string): ObjectDecl {
  const decl = ctx.decls.find((candidate): candidate is ObjectDecl => candidate.kind === "objectDecl" && candidate.object.name === name);
  if (!decl) {
    throw new DiagramError(`Unknown object: ${name}`);
  }
  return decl;
}

function objectLabel(object: ObjectExpr): string {
  switch (object.kind) {
    case "object":
      return object.name;
    case "functorObject":
      return `${object.functor.name} ${objectLabel(object.object)}`;
  }
}

function objectKey(object: ObjectExpr): string {
  return objectLabel(object).replace(/\s+/g, "-").toLowerCase();
}
