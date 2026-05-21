export interface CategoryExpr {
  kind: "category";
  name: string;
}

export interface ObjectVarExpr {
  kind: "object";
  name: string;
  category: CategoryExpr;
  productFactors?: {
    left: ObjectExpr;
    right: ObjectExpr;
  };
}

export interface FunctorExpr {
  kind: "functor";
  name: string;
  source: CategoryExpr;
  target: CategoryExpr;
}

export interface AdjunctionExpr {
  kind: "adjunction";
  name: string;
  left: FunctorExpr;
  right: FunctorExpr;
}

export interface NatTransExpr {
  kind: "natTrans";
  name: string;
  source: FunctorExpr;
  target: FunctorExpr;
}

export interface FunctorObjectExpr {
  kind: "functorObject";
  functor: FunctorExpr;
  object: ObjectExpr;
}

export type ObjectExpr = ObjectVarExpr | FunctorObjectExpr;

export interface HomType {
  source: ObjectExpr;
  target: ObjectExpr;
}

export interface VarTerm {
  kind: "var";
  name: string;
  hom: HomType;
}

export interface IdTerm {
  kind: "id";
  object: ObjectExpr;
}

export interface CompTerm {
  kind: "comp";
  first: Term;
  second: Term;
}

export interface FunctorMapTerm {
  kind: "map";
  functor: FunctorExpr;
  term: Term;
}

export interface UnitTerm {
  kind: "unit";
  adjunction: AdjunctionExpr;
  object: ObjectExpr;
}

export interface CounitTerm {
  kind: "counit";
  adjunction: AdjunctionExpr;
  object: ObjectExpr;
}

export interface ComponentTerm {
  kind: "component";
  natTrans: NatTransExpr;
  object: ObjectExpr;
}

export interface ProductProjectionTerm {
  kind: "productProjection";
  product: ObjectVarExpr;
  side: "left" | "right";
}

export interface ProductPairTerm {
  kind: "productPair";
  product: ObjectVarExpr;
  left: Term;
  right: Term;
}

export type Term =
  | VarTerm
  | IdTerm
  | CompTerm
  | FunctorMapTerm
  | UnitTerm
  | CounitTerm
  | ComponentTerm
  | ProductProjectionTerm
  | ProductPairTerm;

export interface Equation {
  lhs: Term;
  rhs: Term;
  hom: HomType;
}

export type Decl =
  | CategoryDecl
  | ObjectDecl
  | ProductDecl
  | FunctorDecl
  | NatTransDecl
  | MorphismDecl
  | AdjunctionDecl
  | EquationDecl;

export interface CategoryDecl {
  kind: "categoryDecl";
  category: CategoryExpr;
}

export interface ObjectDecl {
  kind: "objectDecl";
  object: ObjectVarExpr;
}

export interface ProductDecl {
  kind: "productDecl";
  product: ObjectVarExpr;
  left: ObjectExpr;
  right: ObjectExpr;
}

export interface FunctorDecl {
  kind: "functorDecl";
  functor: FunctorExpr;
}

export interface NatTransDecl {
  kind: "natTransDecl";
  natTrans: NatTransExpr;
}

export interface MorphismDecl {
  kind: "morphismDecl";
  term: VarTerm;
}

export interface AdjunctionDecl {
  kind: "adjunctionDecl";
  adjunction: AdjunctionExpr;
}

export interface EquationDecl {
  kind: "equationDecl";
  name: string;
  equation: Equation;
}

export interface Context {
  decls: Decl[];
}

export const category = (name: string): CategoryExpr => ({ kind: "category", name });

export const object = (name: string, category: CategoryExpr): ObjectVarExpr => ({
  kind: "object",
  name,
  category
});

export const productObject = (name: string, category: CategoryExpr, left: ObjectExpr, right: ObjectExpr): ObjectVarExpr => ({
  kind: "object",
  name,
  category,
  productFactors: { left, right }
});

export const functor = (
  name: string,
  source: CategoryExpr,
  target: CategoryExpr
): FunctorExpr => ({
  kind: "functor",
  name,
  source,
  target
});

export const adjunction = (name: string, left: FunctorExpr, right: FunctorExpr): AdjunctionExpr => ({
  kind: "adjunction",
  name,
  left,
  right
});

export const natTrans = (name: string, source: FunctorExpr, target: FunctorExpr): NatTransExpr => ({
  kind: "natTrans",
  name,
  source,
  target
});

export const functorObject = (
  functor: FunctorExpr,
  object: ObjectExpr
): FunctorObjectExpr => ({
  kind: "functorObject",
  functor,
  object
});

export const morphism = (name: string, source: ObjectExpr, target: ObjectExpr): VarTerm => ({
  kind: "var",
  name,
  hom: { source, target }
});

export const id = (object: ObjectExpr): IdTerm => ({ kind: "id", object });

export const comp = (first: Term, second: Term): CompTerm => ({
  kind: "comp",
  first,
  second
});

export const map = (functor: FunctorExpr, term: Term): FunctorMapTerm => ({
  kind: "map",
  functor,
  term
});

export const unit = (adjunction: AdjunctionExpr, object: ObjectExpr): UnitTerm => ({
  kind: "unit",
  adjunction,
  object
});

export const counit = (adjunction: AdjunctionExpr, object: ObjectExpr): CounitTerm => ({
  kind: "counit",
  adjunction,
  object
});

export const component = (natTrans: NatTransExpr, object: ObjectExpr): ComponentTerm => ({
  kind: "component",
  natTrans,
  object
});

export const productProjection = (product: ObjectVarExpr, side: "left" | "right"): ProductProjectionTerm => ({
  kind: "productProjection",
  product,
  side
});

export const productPair = (product: ObjectVarExpr, left: Term, right: Term): ProductPairTerm => ({
  kind: "productPair",
  product,
  left,
  right
});

export const emptyContext = (): Context => ({ decls: [] });
