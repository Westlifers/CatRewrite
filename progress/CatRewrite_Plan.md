# CatRewrite: Interactive Diagrammatic Prover for Category-Theoretic Equations

## 0. One-Sentence Goal

Build a local interactive academic tool where a user can enter a categorical context, draw or enter a target commutative diagram, refine the target by adding auxiliary arrows/subdiagrams, and use Lean-style tactics plus bounded proof search to prove commutativity by typed categorical rewriting.

The tool is **not** intended to be a full replacement for Lean 4. It is intended to be a diagram-first, category-theory-specific proof assistant companion.

---

## 1. Project Name

Working name:

```text
CatRewrite
```

Possible alternatives:

```text
CatProofKit
DiagramTactic
CatTactic
ComDiag
```

Use `CatRewrite` for now.

---

## 2. Intended User

A pure mathematics Ph.D. student working heavily with category theory, categorical algebra, adjunctions, naturality, Frobenius-style arguments, Beck-Chevalley-style arguments, and commutative diagrams.

The tool should be optimized for:

- proving that diagrams commute;
- checking categorical equation manipulations;
- decomposing a diagram into subgoals;
- generating human-readable proof traces;
- exporting LaTeX using the `CD` environment;
- eventually exporting Lean 4 theorem skeletons or tactic scripts.

The tool should **not** initially aim to formalize all of category theory.

---

## 3. Core Design Philosophy

The primitive object of the tool is not a theorem in the full dependent type theory sense.

The primitive object is a **diagrammatic proof state**.

A diagrammatic proof state consists of:

```text
Context
Current diagram
Current selected region/subdiagram
Current equation goals
Known equations/rewrite rules
Proof log
Pending auxiliary arrows/subgoals
```

The user interaction should feel like Lean:

| CatRewrite concept | Lean analogue |
|---|---|
| context panel | local context |
| target diagram | current goal |
| selected region | selected subgoal |
| adding auxiliary arrow | `have` |
| splitting a diagram | goal refinement |
| tactic console | tactic mode |
| `simp`, `rw`, `normalize` | Lean tactics |
| proof trace | tactic script / proof term explanation |
| unknown arrow | metavariable |
| legal construction check | type checking / elaboration |

But CatRewrite is diagram-first and specialized to categorical equations.

---

## 4. Recommended Technology Stack

### 4.1 Language

Use TypeScript throughout the core and frontend.

Reason:

- The proof engine and UI need to share formal data structures.
- The tool is highly interactive.
- Avoid a Python/TypeScript serialization boundary at the beginning.
- TypeScript is good enough for a typed symbolic engine.
- Codex should be able to maintain and extend a TypeScript codebase effectively.

### 4.2 Frontend

Use:

```text
Vue 3
TypeScript
Vite
Vue Flow
Pinia
Vitest
```

Recommended roles:

| Tool | Role |
|---|---|
| Vue 3 | frontend framework |
| TypeScript | type safety across UI and core |
| Vite | build/dev server |
| Vue Flow | diagram canvas: nodes, arrows, dragging, selection |
| Pinia | application state management |
| Vitest | unit tests for the core engine and UI-adjacent logic |

### 4.3 External References for Stack

Current official/documentation references:

- Vue Flow: https://vueflow.dev/
- Pinia: https://pinia.vuejs.org/
- Vite: https://vite.dev/guide/

### 4.4 Do Not Start With

Do **not** start with:

- Nuxt;
- Electron;
- Tauri;
- Python backend;
- Lean 4 backend;
- database;
- user authentication;
- cloud sync.

These can be added later. The first goal is a local working prototype.

---

## 5. High-Level Architecture

Use a monorepo-like structure:

```text
catrewrite/
  package.json
  pnpm-workspace.yaml

  packages/
    core/
      src/
        syntax.ts
        context.ts
        typecheck.ts
        normalize.ts
        rewrite.ts
        tactics.ts
        proofState.ts
        pretty.ts
        latex.ts
      test/

    parser/
      src/
        lexer.ts
        parser.ts
        parseContext.ts
        parseTerm.ts
        parseTactic.ts
      test/

    app/
      src/
        main.ts
        App.vue

        stores/
          contextStore.ts
          diagramStore.ts
          proofStore.ts
          uiStore.ts

        components/
          ContextPanel.vue
          DiagramCanvas.vue
          GoalPanel.vue
          TacticConsole.vue
          ProofTrace.vue
          TermInspector.vue
          RuleBrowser.vue

        views/
          WorkspaceView.vue
```

Important rule:

```text
All mathematical logic belongs in packages/core.
Vue components must not contain proof-kernel logic.
```

Frontend components may call core functions, but should not implement type checking, normalization, rewriting, or tactics themselves.

---

## 6. Conceptual Model

### 6.1 Context

A context contains declarations such as:

```text
category C
category D

object X : C
object Y : D

functor F : C -> D
functor G : D -> C

adjunction adj : F ⊣ G

morphism f : F X -> Y
morphism g : X -> G Y
```

Internally, the context should store typed declarations, not raw strings.

Possible TypeScript model:

```ts
export type Decl =
  | CategoryDecl
  | ObjectDecl
  | FunctorDecl
  | MorphismDecl
  | NatTransDecl
  | AdjunctionDecl
  | EquationDecl;

export interface Context {
  decls: Decl[];
  generatedRules: RewriteRule[];
}
```

When the user declares an adjunction, the system should generate:

```text
unit
counit
naturality rules
triangle identity rules
optional transpose/mate rules
```

### 6.2 Categories

A category is represented by a name.

```ts
export interface CategoryExpr {
  kind: "category";
  name: string;
}
```

Use display conventions:

- user may type `C`;
- display can render it as `\mathcal C` in LaTeX;
- internally the name may remain `"C"`.

### 6.3 Objects

Objects are category-indexed.

```ts
export interface ObjectExpr {
  kind: "object";
  name: string;
  category: CategoryExpr;
}
```

Functor application to objects should be represented explicitly:

```ts
export interface FunctorObjectExpr {
  kind: "functorObject";
  functor: FunctorExpr;
  object: ObjectExpr;
}
```

For example:

```text
F X
```

is an object of `D` if:

```text
F : C -> D
X : C
```

### 6.4 Morphisms

A morphism has a source and target object.

```ts
export interface HomType {
  source: ObjectExpr;
  target: ObjectExpr;
}
```

Basic named morphism:

```ts
export interface MorphismTerm {
  kind: "var";
  name: string;
  hom: HomType;
}
```

### 6.5 Terms

Use Lean/mathlib-style composition internally:

```text
f ≫ g
```

means first \(f\), then \(g\).

If:

```text
f : X -> Y
g : Y -> Z
```

then:

```text
f ≫ g : X -> Z
```

This is less error-prone for path composition in diagrams.

Core term constructors:

```ts
export type Term =
  | VarTerm
  | IdTerm
  | CompTerm
  | FunctorMapTerm
  | NatTransComponentTerm
  | UnitTerm
  | CounitTerm
  | PlaceholderTerm;
```

Suggested interfaces:

```ts
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

export interface NatTransComponentTerm {
  kind: "component";
  natTrans: NatTransExpr;
  object: ObjectExpr;
}

export interface UnitTerm {
  kind: "unit";
  adjunction: string;
  object: ObjectExpr;
}

export interface CounitTerm {
  kind: "counit";
  adjunction: string;
  object: ObjectExpr;
}
```

### 6.6 Equations

An equation is a pair of terms with the same hom-type.

```ts
export interface Equation {
  lhs: Term;
  rhs: Term;
  hom: HomType;
}
```

Typechecking an equation means:

1. infer the type of `lhs`;
2. infer the type of `rhs`;
3. check that both source and target agree.

### 6.7 Goals

A goal is an equation plus metadata.

```ts
export interface Goal {
  id: string;
  equation: Equation;
  status: "open" | "proved" | "failed";
  sourceRegionId?: string;
  proofSteps: ProofStep[];
}
```

---

## 7. Diagram Model

Do not store diagrams as pictures.

Store diagrams as formal graphs, and let the UI render them.

```ts
export interface Diagram {
  id: string;
  nodes: DiagramNode[];
  arrows: DiagramArrow[];
  regions: DiagramRegion[];
}
```

### 7.1 Nodes

```ts
export interface DiagramNode {
  id: string;
  label: string;
  object: ObjectExpr;
  position: { x: number; y: number };
}
```

### 7.2 Arrows

```ts
export interface DiagramArrow {
  id: string;
  from: string;
  to: string;
  label: string;
  term: Term;
  status: "given" | "constructed" | "placeholder" | "auxiliary";
}
```

An arrow can be:

- given from the context;
- constructed from a term;
- placeholder/metavariable;
- auxiliary arrow inserted during proof.

### 7.3 Regions

A selected commutative subdiagram/region corresponds to an equation between two paths.

```ts
export interface DiagramRegion {
  id: string;
  label?: string;
  leftPath: string[];   // arrow ids
  rightPath: string[];  // arrow ids
  goalId?: string;
}
```

The backend should convert a region into an equation by composing the terms along both paths.

---

## 8. Proof State

A proof state should include:

```ts
export interface ProofState {
  context: Context;
  diagrams: Diagram[];
  goals: Goal[];
  activeGoalId?: string;
  proofLog: ProofStep[];
}
```

A proof step records what happened.

```ts
export interface ProofStep {
  id: string;
  goalId: string;
  tactic: string;
  before: Equation;
  after?: Equation;
  newGoals?: Goal[];
  message: string;
}
```

Example proof step:

```text
Goal 3:
  tactic: simp
  before: F.map(id_X) ≫ f = f
  after: id_(F X) ≫ f = f
  message: simplified functor preservation of identity
```

---

## 9. Typechecker

The typechecker is the foundation. It must be implemented before advanced tactics.

Core function:

```ts
export function inferTerm(ctx: Context, term: Term): HomType | TypeError;
```

The typechecker must handle:

### 9.1 Identity

```text
id_X : X -> X
```

### 9.2 Composition

If:

```text
f : X -> Y
g : Y -> Z
```

then:

```text
f ≫ g : X -> Z
```

Reject if the target of `f` does not match the source of `g`.

### 9.3 Functor Map

If:

```text
F : C -> D
f : X -> Y in C
```

then:

```text
F.map f : F X -> F Y in D
```

Reject if `f` is not a morphism in the source category of `F`.

### 9.4 Natural Transformation Component

If:

```text
α : F => G
X : C
```

then:

```text
α_X : F X -> G X
```

### 9.5 Adjunction Unit/Counit

If:

```text
F : C -> D
G : D -> C
adj : F ⊣ G
```

then:

```text
η_X : X -> G(F X)
ε_Y : F(G Y) -> Y
```

### 9.6 Equality Goals

An equation is well-typed if both sides have the same source and target.

---

## 10. Normalization

Normalization should be deterministic and terminating.

Start with these rules.

### 10.1 Identity Laws

```text
id_X ≫ f  ↦ f
f ≫ id_Y  ↦ f
```

### 10.2 Associativity Convention

Choose right-association:

```text
(f ≫ g) ≫ h  ↦  f ≫ (g ≫ h)
```

or left-association, but choose exactly one and enforce it everywhere.

Recommended:

```text
right-association
```

because it aligns well with recursively processing path tails.

### 10.3 Functoriality

```text
F.map(id_X)       ↦ id_(F X)
F.map(f ≫ g)      ↦ F.map(f) ≫ F.map(g)
```

### 10.4 Optional Pretty Normalization

The internal normal form may be verbose. The pretty-printer should display a readable version.

---

## 11. Rewrite Engine

A rewrite rule has:

```ts
export interface RewriteRule {
  id: string;
  name: string;
  lhs: PatternTerm;
  rhs: PatternTerm;
  direction: "forward" | "backward" | "bidirectional";
  tags: RuleTag[];
}
```

Rule tags:

```ts
export type RuleTag =
  | "simp"
  | "naturality"
  | "adjunction"
  | "triangle"
  | "functoriality"
  | "user";
```

Important design:

- `simp` should only use terminating/simplifying rules.
- Naturality rules may be dangerous if used blindly in both directions.
- Triangle identities should usually simplify toward identities.
- User equations should be explicit and controlled.

---

## 12. Adjunction Support

Given:

```text
adj : F ⊣ G
F : C -> D
G : D -> C
```

the system should generate:

### 12.1 Unit

```text
η_X : X -> G(F X)
```

### 12.2 Counit

```text
ε_Y : F(G Y) -> Y
```

### 12.3 Triangle Identities

Using `≫` as left-to-right composition:

```text
η_(G Y) ≫ G.map(ε_Y) = id_(G Y)
```

```text
F.map(η_X) ≫ ε_(F X) = id_(F X)
```

### 12.4 Naturality of Unit

For:

```text
f : X -> X'
```

the unit naturality equation is:

```text
f ≫ η_(X') = η_X ≫ G.map(F.map(f))
```

### 12.5 Naturality of Counit

For:

```text
g : Y -> Y'
```

the counit naturality equation is:

```text
F.map(G.map(g)) ≫ ε_(Y') = ε_Y ≫ g
```

### 12.6 Transpose/Mate

For:

```text
f : F X -> Y
```

the right transpose is:

```text
transpose(f) := η_X ≫ G.map(f)
```

For:

```text
g : X -> G Y
```

the left untranspose is:

```text
untranspose(g) := F.map(g) ≫ ε_Y
```

The system should be able to prove:

```text
untranspose(transpose(f)) = f
```

and:

```text
transpose(untranspose(g)) = g
```

using functoriality, naturality, and triangle identities.

---

## 13. Tactics

Tactics act on goals and produce either:

```text
proved
```

or a transformed goal, or a list of subgoals.

### 13.1 `normalize`

Normalize both sides of the active equation.

```text
normalize
```

Should apply:

- identity simplification;
- associativity normalization;
- functoriality simplification.

### 13.2 `simp`

Apply registered simplification rules repeatedly, with loop protection.

```text
simp
simp [triangle_right]
simp [adjunction]
```

The first implementation can simply use all rules tagged `"simp"`.

### 13.3 `rw`

Rewrite using a named equation/rule.

```text
rw triangle_right
rw counit_naturality
rw user_lemma_3
```

Later support directional variants:

```text
rw <- unit_naturality
```

### 13.4 `naturality`

Instantiate and apply naturality of a selected natural transformation.

Examples:

```text
naturality η at f
naturality ε at g
```

The tactic should:

1. infer the type of the morphism;
2. find the relevant natural transformation;
3. generate the corresponding naturality equation;
4. try to rewrite the current goal.

### 13.5 `triangle`

Apply a triangle identity from an adjunction.

Examples:

```text
triangle adj left
triangle adj right
```

### 13.6 `mate`

Move an equation across an adjunction.

This is harder. Implement after basic adjunction rewriting works.

Possible commands:

```text
mate adj
transpose adj f
untranspose adj g
```

### 13.7 `split_by_arrow`

Diagrammatic tactic.

Given a region/goal and an auxiliary arrow, split a larger commutativity goal into smaller commutativity goals.

For example, if a rectangle is divided by an auxiliary arrow into two triangles or squares, replace the outer goal by the corresponding inner goals.

This tactic must be formal: it should decompose path equations according to the graph structure, not by geometric intuition alone.

### 13.8 `try`

Bounded proof search.

```text
try
try depth 5
try [simp, naturality, triangle]
```

Algorithm for MVP:

1. normalize;
2. simp;
3. try applicable triangle identities;
4. try applicable naturality rewrites;
5. normalize again;
6. compare normal forms;
7. optionally breadth-first search up to a small depth.

Failure mode should be informative:

```text
Failed to close the goal.
Remaining normalized goal:
  ...
Possible applicable rules:
  - naturality of ε at f
  - triangle_right for adj
```

---

## 14. Diagrammatic Interaction Model

### 14.1 Basic Workflow

User enters context:

```text
category C
category D
functor F : C -> D
functor G : D -> C
adjunction adj : F ⊣ G
object X : C
object Y : D
morphism f : F X -> Y
```

User creates a target equation:

```text
F.map(η_X ≫ G.map(f)) ≫ ε_Y = f
```

or draws the corresponding diagram.

System creates a goal.

User runs:

```text
simp
```

or:

```text
try
```

System proves or reduces the goal.

### 14.2 Adding Auxiliary Arrows

User draws an arrow between two objects.

The system asks for one of:

```text
1. choose existing morphism
2. define by term
3. synthesize from context
4. create placeholder assumption
```

If user defines:

```text
p := η_X ≫ G.map(f)
```

then the system typechecks:

```text
p : X -> G Y
```

If legal, it adds the arrow.

### 14.3 Splitting Diagrams

User selects a rectangle and an auxiliary arrow.

System decomposes the original region into subregions.

Original goal:

```text
path_outer_left = path_outer_right
```

New goals:

```text
subpath_1_left = subpath_1_right
subpath_2_left = subpath_2_right
```

Once all subgoals are proved, the original goal is marked proved by pasting.

### 14.4 Selecting a Region

When a user selects a triangle/square/region, the UI should show:

```text
Region equation:
  left path = right path

Left path:
  ...

Right path:
  ...

Type:
  source -> target
```

This is crucial. The user should always know what equation the picture means.

---

## 15. Parser / Surface Syntax

Do not try to parse full LaTeX or full Lean at first.

Create a small custom language.

### 15.1 Context Syntax

Example:

```text
category C
category D

object X : C
object Y : D

functor F : C -> D
functor G : D -> C

adjunction adj : F ⊣ G

morphism f : F X -> Y
```

Allow ASCII fallback:

```text
adjunction adj : F -| G
```

### 15.2 Term Syntax

Use:

```text
id X
f >> g
F.map f
eta adj X
eps adj Y
```

or allow Unicode aliases:

```text
f ≫ g
η[adj, X]
ε[adj, Y]
```

Recommended initial internal syntax:

```text
f >> g
F.map(f)
eta(adj, X)
eps(adj, Y)
```

The parser can later support nicer notation.

### 15.3 Tactic Syntax

```text
normalize
simp
rw triangle_right
naturality eta at f
naturality eps at g
triangle adj right
try
```

---

## 16. LaTeX Export

The tool should export:

### 16.1 Equation Calculations

Example:

```latex
\[
\begin{aligned}
F(\eta_X \circ Gf) \circ \varepsilon_Y
&= (F\eta_X \circ FGf) \circ \varepsilon_Y \\
&= F\eta_X \circ (FGf \circ \varepsilon_Y) \\
&= F\eta_X \circ (\varepsilon_{FX} \circ f) \\
&= (F\eta_X \circ \varepsilon_{FX}) \circ f \\
&= 1_{FX} \circ f \\
&= f.
\end{aligned}
\]
```

The precise order depends on the display convention. Internally use `≫`; LaTeX output may use either `\circ` or `\mathbin{\gg}`. Pick one display convention and remain consistent.

### 16.2 Commutative Diagrams

Use `CD` environment, not `tikzcd`.

Example:

```latex
\[
\begin{CD}
A @>{f}>> B \\
@V{g}VV @VV{h}V \\
C @>{k}>> D
\end{CD}
\]
```

The user prefers `CD` because `tikzcd` does not render in their environment.

---

## 17. Lean 4 Integration Strategy

Do not use Lean 4 as the main backend in the first version.

Build the custom TypeScript categorical rewriting engine first.

Lean 4 can be added later as:

1. optional verifier;
2. theorem skeleton exporter;
3. naming convention reference;
4. possible tactic-script target.

### 17.1 Phase 1 Lean Export

Generate skeleton:

```lean
import Mathlib.CategoryTheory.Adjunction.Basic

-- generated theorem skeleton
theorem example : ... := by
  sorry
```

### 17.2 Phase 2 Lean Simp Attempt

Generate simple proof attempts:

```lean
by
  simp [Category.assoc]
```

### 17.3 Phase 3 Lean LSP Integration

Optional, later:

- run Lean in a subprocess;
- inspect diagnostics;
- report whether generated Lean code compiles;
- keep this separate from the core engine.

---

## 18. MVP Roadmap

### MVP 0: Project Setup

Goals:

- create Vite + Vue 3 + TypeScript app;
- create `packages/core`;
- set up Vitest;
- set up pnpm workspace;
- ensure tests run.

Deliverable:

```text
pnpm install
pnpm test
pnpm dev
```

### MVP 1: Core Syntax and Typechecker

Implement:

- categories;
- objects;
- functors;
- morphisms;
- identity;
- composition;
- functor map;
- basic type inference.

Tests:

```text
id_X : X -> X
f >> g typechecks when composable
f >> h fails when not composable
F.map(f) has source F X and target F Y
```

### MVP 2: Normalizer

Implement:

- identity laws;
- associativity normalization;
- functor preserves identity;
- functor preserves composition.

Tests:

```text
id_X >> f normalizes to f
f >> id_Y normalizes to f
(f >> g) >> h normalizes to f >> (g >> h)
F.map(id_X) normalizes to id_(F X)
F.map(f >> g) normalizes to F.map(f) >> F.map(g)
```

### MVP 3: Rewrite Engine

Implement:

- rewrite rule representation;
- pattern matching;
- single-step rewrite;
- repeated simplification with loop protection.

Tests:

```text
triangle identity rewrites to identity
user-defined equation can rewrite a target
simp terminates on basic examples
```

### MVP 4: Adjunction Rules

Implement:

- adjunction declaration;
- unit;
- counit;
- triangle identities;
- unit/counit naturality;
- transpose/untranspose definitions.

Test the key equation:

Given:

```text
F : C -> D
G : D -> C
adj : F ⊣ G
f : F X -> Y
```

prove:

```text
F.map(eta(adj, X) >> G.map(f)) >> eps(adj, Y) = f
```

This is the first major proof target.

### MVP 5: Tactic Engine

Implement:

```text
normalize
simp
rw
triangle
naturality
try
```

Goal:

```text
runTactic(proofState, goalId, "simp")
```

returns an updated proof state.

### MVP 6: Textual UI

Before diagram drawing, build panels:

- ContextPanel;
- GoalPanel;
- TacticConsole;
- ProofTrace.

User should be able to:

1. type context;
2. type target equation;
3. run tactics;
4. see proof trace.

### MVP 7: Diagram UI

Add Vue Flow canvas.

User can:

- create object nodes;
- create arrows;
- assign terms to arrows;
- select a path or region;
- see the corresponding equation.

Do not attempt complex automatic region detection at first. Allow manual selection of two paths.

### MVP 8: Auxiliary Arrow + Split

Implement:

- add auxiliary arrow;
- typecheck construction;
- split selected goal by arrow/path;
- generate subgoals;
- mark outer goal proved when subgoals are proved.

### MVP 9: LaTeX Export

Export:

- proof trace as aligned calculation;
- selected diagram as `CD` environment;
- context summary.

### MVP 10: Lean Export

Generate Lean skeletons with `sorry`.

Do not try full Lean automation until the custom engine is useful.

---

## 19. First Codex Task Prompt

Give Codex this prompt first:

```text
Create a pnpm monorepo project called CatRewrite.

Use:
- TypeScript
- Vue 3
- Vite
- Pinia
- Vue Flow
- Vitest

Create packages/core and packages/app.

In packages/core, implement a framework-independent TypeScript library for a small categorical rewriting engine.

First milestone:
1. Define data types for categories, objects, functors, morphisms, terms, hom-types, equations, and contexts.
2. Implement type inference for:
   - identity morphisms
   - composition
   - functor application to morphisms
3. Implement normalization for:
   - identity laws
   - associativity
   - functor preserves identity
   - functor preserves composition
4. Add Vitest tests for all of these.

Do not implement the Vue UI yet except for a placeholder app showing that the project runs.
Keep all mathematical logic out of Vue components.
```

---

## 20. Second Codex Task Prompt

After MVP 1 and MVP 2 pass tests, use:

```text
Extend packages/core with a rewrite engine.

Requirements:
1. Add a RewriteRule type with:
   - id
   - name
   - lhs pattern
   - rhs pattern
   - tags
2. Implement pattern matching for categorical terms.
3. Implement single-step rewrite.
4. Implement repeated simplification using rules tagged "simp".
5. Add loop protection.
6. Add tests showing that simplification terminates and rewrites as expected.
```

---

## 21. Third Codex Task Prompt

After rewrite engine works:

```text
Add adjunction support to packages/core.

Requirements:
1. Add AdjunctionDecl for F ⊣ G.
2. Generate unit and counit term constructors:
   - eta(adj, X) : X -> G(F X)
   - eps(adj, Y) : F(G Y) -> Y
3. Generate triangle identity rewrite rules:
   - eta(adj, G Y) >> G.map(eps(adj, Y)) = id(G Y)
   - F.map(eta(adj, X)) >> eps(adj, F X) = id(F X)
4. Generate naturality rules for eta and eps.
5. Define transpose and untranspose helpers.
6. Add a test proving:
   F.map(eta(adj, X) >> G.map(f)) >> eps(adj, Y) = f
   for f : F X -> Y.
```

---

## 22. Fourth Codex Task Prompt

After the core adjunction example works:

```text
Build the first Vue UI.

Requirements:
1. Use Vue 3, TypeScript, Vite, and Pinia.
2. Add ContextPanel for entering context declarations.
3. Add GoalPanel for entering an equation goal.
4. Add TacticConsole for running tactics.
5. Add ProofTrace panel for showing proof steps.
6. The UI should call packages/core functions.
7. Do not put typechecking or rewriting logic inside Vue components.
```

---

## 23. Fifth Codex Task Prompt

After textual UI works:

```text
Add diagram editing with Vue Flow.

Requirements:
1. Object nodes correspond to typed object expressions.
2. Edges correspond to typed morphism terms.
3. The user can select two paths between the same source and target.
4. The app converts the selected paths into an equation goal.
5. The user can run tactics on that goal.
6. Show type errors clearly when an edge term is illegal.
```

---

## 24. Design Risks

### 24.1 Search Explosion

Do not allow unrestricted bidirectional rewriting.

Mitigation:

- `simp` uses oriented simplifying rules only.
- `rw` is explicit.
- `try` is bounded by depth.
- naturality is not blindly applied everywhere.

### 24.2 Diagram Ambiguity

A picture alone is ambiguous.

Mitigation:

- every arrow must have a formal term;
- every selected region must display its equation;
- paths must be explicitly selected in early versions.

### 24.3 Lean Integration Complexity

Lean is powerful but heavy.

Mitigation:

- postpone Lean backend;
- first export theorem skeletons;
- only later attempt verification.

### 24.4 Bad Internal Composition Convention

Composition direction errors are likely.

Mitigation:

- internally use `f >> g` / `f ≫ g` for first `f`, then `g`;
- write extensive tests;
- keep display convention explicit.

### 24.5 Overbuilding the UI Before the Kernel

A beautiful diagram UI without a proof kernel is not useful.

Mitigation:

- build textual proof engine first;
- add diagram UI only after core examples work.

---

## 25. What Counts as Success?

### First Success

The tool can prove:

```text
F.map(eta(adj, X) >> G.map(f)) >> eps(adj, Y) = f
```

from:

```text
F ⊣ G
f : F X -> Y
```

and output a readable proof trace.

### Second Success

The user can draw or enter a square, select the two paths, and the tool turns it into an equation goal.

### Third Success

The user can add an auxiliary arrow, split a diagram, prove one subgoal, and see the remaining subgoal.

### Fourth Success

The tool exports a LaTeX proof and `CD` diagram.

### Fifth Success

The tool exports a Lean theorem skeleton.

---

## 26. Non-Goals for the First Version

Do not implement initially:

- arbitrary limits/colimits;
- arbitrary universal property reasoning;
- automatic theorem discovery;
- full Lean verification;
- arbitrary LaTeX parsing;
- PDF/OCR extraction;
- theorem dependency graph;
- cloud collaboration;
- account system;
- complete decision procedure for categorical equality.

---

## 27. Long-Term Extensions

After the MVP, possible extensions include:

### 27.1 Pullbacks and Pushouts

Add:

- universal property constructors;
- uniqueness tactics;
- pasting lemmas.

### 27.2 Beck-Chevalley and Frobenius Rules

Support common categorical algebra proof patterns.

### 27.3 Indexed Categories / Fibrations

Useful for more advanced categorical logic.

### 27.4 Monoidal Categories

Add tensor, unit object, associator, unitor, braiding, string-diagram-inspired simplification.

### 27.5 Lean Verification

Export and check generated Lean code.

### 27.6 Personal Rule Library

Allow user to save custom lemmas/rules:

```text
rule my_frobenius_rule : ...
tag simp
```

### 27.7 CD Diagram Library

Save reusable templates:

- adjunction triangles;
- naturality squares;
- mate correspondence diagrams;
- Beck-Chevalley squares;
- pullback/pushout squares.

---

## 28. Final Implementation Principle

The project should be built in this order:

```text
typed terms
→ typechecker
→ normalizer
→ rewrite engine
→ tactics
→ textual proof state UI
→ diagram UI
→ auxiliary arrows/splitting
→ LaTeX export
→ Lean export
```

Do not reverse this order.

The most important architectural invariant is:

```text
Vue is for interaction.
TypeScript core is for mathematics.
Lean is optional verification later.
```

