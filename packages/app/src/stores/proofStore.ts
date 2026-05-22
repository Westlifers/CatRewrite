import {
  createGoal,
  createIsoGoal,
  completeGoalByIso,
  completeGoalByProductExt,
  completeDiagramGoalBySubgoals as completeDiagramGoalBySubgoalsCore,
  createDiagramProofState,
  createProofState,
  addAuxiliaryArrow,
  addAuxiliaryNode,
  createSubgoalFromRegion,
  createSubgoalFromPaths,
  diagramSubgoalRules,
  equationDiagram,
  inspectEquation,
  latexEquation,
  latexGoalTarget,
  latexHom,
  parseContext,
  parseEquation,
  parseIsoGoal,
  parseObjectExpr,
  parseTerm,
  prettyEquation,
  prettyGoalTarget,
  prettyHom,
  proofExamples,
  baseTacticOptions,
  proveDiagramSubgoal,
  regionEquation,
  removeAuxiliaryArrow,
  removeAuxiliaryNode,
  runTactic,
  splitDiagramGoal,
  splitDiagramGoalByProductExt,
  splittableRegions,
  equalObject,
  isIsoGoalText,
  type Diagram,
  type DiagramArrow,
  type DiagramNode,
  type DiagramRegion,
  type DiagramProofState,
  type Goal,
  type GoalInspection,
  type GoalTarget,
  type ProofExample,
  type ProductDecl,
  type ProofState,
  type RewriteRule,
  type TerminalDecl,
  typecheckEquation
} from "@catrewrite/core";
import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";

const defaultExample = proofExamples[0];

export interface DiagramRegionView extends DiagramRegion {
  equationText?: string;
  equationLatex?: string;
  errorText?: string;
  isOuterGoal?: boolean;
  isSubgoal?: boolean;
}

export const useProofStore = defineStore("proof", () => {
  const selectedExampleId = ref(defaultExample.id);
  const contextText = ref(defaultExample.contextText);
  const goalText = ref(defaultExample.goalText);
  const tacticText = ref(defaultExample.tacticText);
  const proofState = ref<ProofState>();
  const error = ref<string>();
  const errorNonce = ref(0);
  const isDirty = ref(false);
  const isPathSelectionMode = ref(false);
  const activePathSide = ref<"left" | "right">("left");
  const leftPath = ref<string[]>(["top", "right"]);
  const rightPath = ref<string[]>(["left", "bottom"]);
  const auxiliaryArrowId = ref("aux-1");
  const auxiliaryFrom = ref("rhs-node-1");
  const auxiliaryTo = ref("lhs-node-2");
  const auxiliaryTermText = ref("");
  const auxiliaryNodeId = ref("aux-node");
  const auxiliaryNodeLabel = ref("");
  const auxiliaryNodeObjectText = ref("G Y");
  const isAuxiliaryMode = ref(false);
  const activeAuxiliaryEndpoint = ref<"from" | "to">("from");
  const selectedAuxiliaryArrowId = ref<string>();
  const selectedAuxiliaryNodeId = ref<string>();
  const auxiliaryDiagram = ref<Diagram>();
  const diagramProofState = ref<DiagramProofState>();
  const selectedSubgoalId = ref<string>();
  const selectedDiagramRegionId = ref<string>();

  const activeGoal = computed(() => proofState.value?.goals.find((goal) => !goal.parentGoalId));
  const selectedProofSubgoal = computed(() =>
    proofState.value?.goals.find((goal) => goal.parentGoalId && goal.id === selectedSubgoalId.value)
  );
  const selectedDiagramSubgoal = computed(() =>
    diagramProofState.value?.subgoals.find((subgoal) => subgoal.id === selectedSubgoalId.value)
  );
  const activeProofTarget = computed(() => selectedProofSubgoal.value ?? selectedDiagramSubgoal.value ?? activeGoal.value);
  const activeProofTargetTitle = computed(() =>
    selectedProofSubgoal.value || selectedDiagramSubgoal.value
      ? `Subgoal ${(selectedProofSubgoal.value ?? selectedDiagramSubgoal.value)?.id}`
      : "Main goal"
  );
  const goalStatus = computed(() => activeGoal.value?.status ?? "open");
  const currentEquation = computed(() => (activeGoal.value ? prettyGoalTarget(activeGoal.value.target) : ""));
  const currentEquationLatex = computed(() => (activeGoal.value ? latexGoalTarget(activeGoal.value.target) : ""));
  const activeProofEquation = computed(() => proofTargetText(activeProofTarget.value));
  const activeProofEquationLatex = computed(() => proofTargetLatex(activeProofTarget.value));
  const activeProofStatus = computed(() => activeProofTarget.value?.status ?? "open");
  const canRunTactic = computed(() => Boolean(activeProofTarget.value) && activeProofStatus.value !== "proved");
  const activeProofSteps = computed(() => activeProofTarget.value?.proofSteps ?? proofState.value?.proofLog ?? []);
  const localDiagramRules = computed<RewriteRule[]>(() =>
    diagramProofState.value ? diagramSubgoalRules(diagramProofState.value) : []
  );
  const inspection = computed<GoalInspection | undefined>(() =>
    proofState.value && activeProofTarget.value && proofTargetGoalTarget(activeProofTarget.value)?.kind !== "iso"
      ? inspectEquation(proofState.value.context, activeProofTarget.value.equation, localDiagramRules.value)
      : undefined
  );
  const activeIsoTarget = computed(() => {
    const target = proofTargetGoalTarget(activeProofTarget.value);
    return target?.kind === "iso" ? target : undefined;
  });
  const homType = computed(() =>
    activeIsoTarget.value
      ? prettyHom(activeIsoTarget.value.hom)
      : inspection.value
        ? prettyHom(inspection.value.hom)
        : ""
  );
  const homTypeLatex = computed(() =>
    activeIsoTarget.value
      ? latexHom(activeIsoTarget.value.hom)
      : inspection.value
        ? latexHom(inspection.value.hom)
        : ""
  );
  const normalizedEquation = computed(() =>
    inspection.value ? prettyEquation(inspection.value.normalizedEquation) : ""
  );
  const normalizedEquationLatex = computed(() =>
    inspection.value ? latexEquation(inspection.value.normalizedEquation) : ""
  );
  const selectedExample = computed(
    () => proofExamples.find((example) => example.id === selectedExampleId.value) ?? defaultExample
  );
  const tacticOptions = computed(() => {
    const isoOptions = isoTacticOptions();
    const productExtOptions = productExtTacticOptions();
    const terminalExtOptions = terminalExtTacticOptions();
    const naturalityOptions =
      inspection.value?.availableRules
        .filter((rule) => rule.tags.includes("naturality") && /\.naturality\./.test(rule.id))
        .map((rule) => {
          const [name, , morphism] = rule.id.split(".");
          return {
            id: `naturality:${rule.id}`,
            label: `naturality ${name} at ${morphism}`,
            command: `naturality ${name} at ${morphism}`,
            description: `Apply ${rule.name}.`
          };
        }) ?? [];
    const rewriteOptions =
      inspection.value?.availableRules.map((rule) => ({
        id: `rw:${rule.id}`,
        label: `rw ${rule.id}`,
        command: `rw ${rule.id}`,
        description: `Rewrite once using ${rule.name}.`
      })) ?? [];

    return [...baseTacticOptions, ...isoOptions, ...productExtOptions, ...terminalExtOptions, ...naturalityOptions, ...rewriteOptions];
  });
  const diagram = computed<Diagram | undefined>(() => {
    try {
      const context = parseContext(contextText.value);

      if (selectedDiagramSubgoal.value && diagramProofState.value) {
        return diagramProofState.value.diagram;
      }

      if (selectedProofSubgoal.value) {
        return baseDiagram(context, selectedProofSubgoal.value.equation);
      }

      if (activeGoal.value?.target.kind === "iso") {
        return undefined;
      }

      if (diagramProofState.value) {
        return diagramProofState.value.diagram;
      }

      if (auxiliaryDiagram.value) {
        return auxiliaryDiagram.value;
      }

      const equation = activeGoal.value?.equation ?? parseEquation(goalText.value, context);
      return baseDiagram(context, equation);
    } catch {
      return undefined;
    }
  });
  const diagramRegions = computed<DiagramRegionView[]>(() => {
    const currentDiagram = diagram.value;
    if (!currentDiagram) {
      return [];
    }

    if (selectedProofSubgoal.value) {
      return describeRegions(currentDiagram.regions, currentDiagram);
    }

    if (diagramProofState.value) {
      const regions = [...diagramProofState.value.diagram.regions];
      const regionIds = new Set(regions.map((region) => region.id));
      for (const region of splittableRegions(diagramProofState.value)) {
        if (!regionIds.has(region.id)) {
          regions.push(region);
          regionIds.add(region.id);
        }
      }

      return describeRegions(regions, diagramProofState.value.diagram);
    }

    return describeRegions(currentDiagram.regions, currentDiagram);
  });
  const diagramSubgoals = computed(() => diagramProofState.value?.subgoals ?? []);
  const proofPanelSubgoals = computed(() => [
    ...proofSubgoalRows(),
    ...diagramSubgoals.value.map((subgoal) => ({
      ...subgoal,
      depth: 0,
      childCount: 0,
      canComplete: false
    }))
  ]);
  const auxiliaryNodes = computed<DiagramNode[]>(() =>
    (diagram.value?.nodes ?? []).filter((node) => node.status === "auxiliary")
  );
  const auxiliaryArrows = computed<DiagramArrow[]>(() =>
    (diagram.value?.arrows ?? []).filter((arrow) => arrow.status === "auxiliary")
  );
  const provedRegionIds = computed(() => (selectedProofSubgoal.value ? [] : diagramProofState.value?.provedRegionIds ?? []));
  const selectedRegionId = computed(() => (selectedProofSubgoal.value ? undefined : selectedDiagramSubgoal.value?.regionId ?? selectedDiagramRegionId.value));
  const completableProofTarget = computed(() => nearestCompletableProofTarget(selectedProofSubgoal.value) ?? activeGoal.value);
  const proofChildrenForCompletableTarget = computed(() =>
    proofState.value && completableProofTarget.value
      ? proofState.value.goals.filter((goal) => goal.parentGoalId === completableProofTarget.value?.id)
      : []
  );
  const canCompleteByProductExt = computed(() =>
    completableProofTarget.value?.status === "open" &&
    proofChildrenForCompletableTarget.value.some((subgoal) => subgoal.completion?.kind === "productExt") &&
    proofChildrenForCompletableTarget.value.every((subgoal) => subgoal.status === "proved")
  );
  const canCompleteByIso = computed(() =>
    completableProofTarget.value?.status === "open" &&
    proofChildrenForCompletableTarget.value.some((subgoal) => subgoal.completion?.kind === "iso") &&
    proofChildrenForCompletableTarget.value.every((subgoal) => subgoal.status === "proved")
  );
  const canCompleteByDiagramSubgoals = computed(() =>
    activeGoal.value?.status === "open" &&
    diagramSubgoals.value.length > 0 &&
    diagramSubgoals.value.every((subgoal) => subgoal.status === "proved")
  );
  const canCompleteBySubgoals = computed(
    () => canCompleteByProductExt.value || canCompleteByIso.value || canCompleteByDiagramSubgoals.value
  );
  const canSplitGoal = computed(() => (diagramProofState.value ? splittableRegions(diagramProofState.value).length > 0 : false));
  const canAddAllRegionSubgoals = computed(() =>
    diagramRegions.value.some((region) => !region.isOuterGoal && !region.isSubgoal)
  );

  function elaborate(): void {
    try {
      const context = parseContext(contextText.value);
      const isoTarget = isIsoGoalText(goalText.value) ? parseIsoGoal(goalText.value, context) : undefined;
      const equation = isoTarget
        ? typecheckEquation(context, isoTarget.forward, isoTarget.forward)
        : parseEquation(goalText.value, context);
      const goalDiagram = isoTarget ? undefined : baseDiagram(context, equation);
      proofState.value = createProofState(context, [
        isoTarget ? createIsoGoal("goal-1", isoTarget, equation) : createGoal("goal-1", equation)
      ]);
      auxiliaryDiagram.value = undefined;
      diagramProofState.value = goalDiagram ? createDiagramProofState(goalDiagram) : undefined;
      selectedSubgoalId.value = undefined;
      selectedDiagramRegionId.value = undefined;
      if (goalDiagram) {
        resetSelectedPaths(goalDiagram);
      } else {
        clearSelectedPaths();
      }
      isDirty.value = false;
      error.value = undefined;
    } catch (caught) {
      proofState.value = undefined;
      reportError(caught);
    }
  }

  function runCurrentTactic(): void {
    if (isDirty.value || !proofState.value || (!activeGoal.value && !selectedProofSubgoal.value && !selectedDiagramSubgoal.value)) {
      elaborate();
    }

    if (!proofState.value) {
      return;
    }

    try {
      if (!canRunTactic.value) {
        reportError("The selected proof target is already proved.");
        return;
      }

      if (selectedProofSubgoal.value) {
        proofState.value = runTactic(proofState.value, selectedProofSubgoal.value.id, tacticText.value, localDiagramRules.value).state;
        const activeProofSubgoal = proofState.value.goals.find(
          (goal) => goal.parentGoalId && goal.id === proofState.value?.activeGoalId
        );
        selectedSubgoalId.value =
          activeProofSubgoal?.id ??
          proofState.value.goals.find((goal) => goal.parentGoalId && goal.status !== "proved")?.id ??
          selectedProofSubgoal.value.id;
      } else if (selectedDiagramSubgoal.value) {
        proveSubgoal(selectedDiagramSubgoal.value.id);
      } else if (activeGoal.value) {
        const productExtMatch = /^product_ext\s+([A-Za-z][A-Za-z0-9_]*)$/.exec(tacticText.value.trim());
        if (productExtMatch) {
          const context = parseContext(contextText.value);
          const currentDiagram = diagram.value ?? baseDiagram(context, activeGoal.value.equation);
          const currentDiagramProofState = diagramProofState.value ?? createDiagramProofState(currentDiagram);
          diagramProofState.value = splitDiagramGoalByProductExt(
            context,
            currentDiagramProofState,
            productExtMatch[1],
            activeGoal.value.id
          );
          auxiliaryDiagram.value = diagramProofState.value.diagram;
          const step = {
            id: `step-${proofState.value.proofLog.length + 1}`,
            goalId: activeGoal.value.id,
            tactic: tacticText.value.trim(),
            before: activeGoal.value.equation,
            after: activeGoal.value.equation,
            message: `split by product extensionality for ${productExtMatch[1]}`
          };
          proofState.value = {
            ...proofState.value,
            goals: proofState.value.goals.map((goal) =>
              goal.id === activeGoal.value?.id ? { ...goal, proofSteps: [...goal.proofSteps, step] } : goal
            ),
            proofLog: [...proofState.value.proofLog, step]
          };
          selectedSubgoalId.value = diagramProofState.value.subgoals[0]?.id;
          error.value = undefined;
          return;
        }
        const result = runTactic(proofState.value, activeGoal.value.id, tacticText.value, localDiagramRules.value);
        proofState.value = result.state;
        const activeProofSubgoal = proofState.value.goals.find(
          (goal) => goal.parentGoalId && goal.id === proofState.value?.activeGoalId
        );
        selectedSubgoalId.value = activeProofSubgoal?.id;
      }
      error.value = undefined;
    } catch (caught) {
      reportError(caught);
    }
  }

  function loadExample(exampleId: string): void {
    const example = proofExamples.find((candidate) => candidate.id === exampleId) ?? defaultExample;
    selectedExampleId.value = example.id;
    contextText.value = example.contextText;
    goalText.value = example.goalText;
    tacticText.value = example.tacticText;
    elaborate();
  }

  function selectDiagramArrow(arrowId: string): void {
    const arrow = diagram.value?.arrows.find((candidate) => candidate.id === arrowId);
    selectedAuxiliaryArrowId.value = arrow?.status === "auxiliary" ? arrow.id : undefined;
    selectedAuxiliaryNodeId.value = undefined;
    if (!isPathSelectionMode.value) {
      return;
    }
    const target = activePathSide.value === "left" ? leftPath : rightPath;
    target.value = [...target.value, arrowId];
  }

  function selectDiagramNode(nodeId: string): void {
    if (!isAuxiliaryMode.value) {
      return;
    }

    if (activeAuxiliaryEndpoint.value === "from") {
      auxiliaryFrom.value = nodeId;
    } else {
      auxiliaryTo.value = nodeId;
    }
    const node = diagram.value?.nodes.find((candidate) => candidate.id === nodeId);
    selectedAuxiliaryNodeId.value = node?.status === "auxiliary" ? node.id : undefined;
    selectedAuxiliaryArrowId.value = undefined;
  }

  function selectAuxiliaryArrow(arrowId?: string): void {
    selectedAuxiliaryArrowId.value = arrowId;
    selectedAuxiliaryNodeId.value = undefined;
  }

  function selectAuxiliaryNode(nodeId?: string): void {
    selectedAuxiliaryNodeId.value = nodeId;
    selectedAuxiliaryArrowId.value = undefined;
  }

  function clearPath(side: "left" | "right"): void {
    if (side === "left") {
      leftPath.value = [];
    } else {
      rightPath.value = [];
    }
  }

  function resetSelectedPaths(currentDiagram: Diagram): void {
    const region = currentDiagram.regions[0];
    if (region) {
      leftPath.value = region.leftPath;
      rightPath.value = region.rightPath;
    }
  }

  function clearSelectedPaths(): void {
    leftPath.value = [];
    rightPath.value = [];
  }

  function addAuxiliary(): void {
    try {
      const context = parseContext(contextText.value);
      const currentDiagram = diagram.value ?? baseDiagram(context, parseEquation(goalText.value, context));
      auxiliaryDiagram.value = addAuxiliaryArrow(context, currentDiagram, {
        id: auxiliaryArrowId.value.trim(),
        from: auxiliaryFrom.value.trim(),
        to: auxiliaryTo.value.trim(),
        label: auxiliaryTermText.value.trim(),
        term: parseTerm(auxiliaryTermText.value, context)
      });
      diagramProofState.value = diagramProofState.value
        ? { ...diagramProofState.value, diagram: auxiliaryDiagram.value }
        : createDiagramProofState(auxiliaryDiagram.value);
      auxiliaryArrowId.value = nextAuxiliaryArrowId(auxiliaryDiagram.value);
      isAuxiliaryMode.value = false;
      selectedAuxiliaryArrowId.value = auxiliaryDiagram.value.arrows.at(-1)?.id;
      selectedAuxiliaryNodeId.value = undefined;
      error.value = undefined;
    } catch (caught) {
      reportError(caught);
    }
  }

  function addAuxiliaryNodeToDiagram(): void {
    try {
      const context = parseContext(contextText.value);
      const currentDiagram = diagram.value ?? baseDiagram(context, parseEquation(goalText.value, context));
      auxiliaryDiagram.value = addAuxiliaryNode(currentDiagram, {
        id: auxiliaryNodeId.value.trim(),
        label: auxiliaryNodeLabel.value.trim(),
        object: parseObjectExpr(auxiliaryNodeObjectText.value.trim(), context)
      });
      diagramProofState.value = diagramProofState.value
        ? { ...diagramProofState.value, diagram: auxiliaryDiagram.value }
        : createDiagramProofState(auxiliaryDiagram.value);
      selectedAuxiliaryNodeId.value = auxiliaryNodeId.value.trim();
      selectedAuxiliaryArrowId.value = undefined;
      auxiliaryNodeId.value = nextAuxiliaryNodeId(auxiliaryDiagram.value);
      error.value = undefined;
    } catch (caught) {
      reportError(caught);
    }
  }

  function addDiagramSubgoal(): void {
    try {
      const context = parseContext(contextText.value);
      const currentDiagram = diagram.value ?? baseDiagram(context, parseEquation(goalText.value, context));
      const currentDiagramProofState = diagramProofState.value ?? createDiagramProofState(currentDiagram);
      diagramProofState.value = createSubgoalFromPaths(context, currentDiagramProofState, {
        leftPath: leftPath.value,
        rightPath: rightPath.value
      });
      selectedSubgoalId.value = diagramProofState.value.subgoals.at(-1)?.id;
      isPathSelectionMode.value = false;
      error.value = undefined;
    } catch (caught) {
      reportError(caught);
    }
  }

  function splitCurrentDiagramGoal(): void {
    if (!diagramProofState.value) {
      return;
    }

    try {
      const context = parseContext(contextText.value);
      const beforeCount = diagramProofState.value.subgoals.length;
      diagramProofState.value = splitDiagramGoal(context, diagramProofState.value);
      selectedSubgoalId.value = diagramProofState.value.subgoals[beforeCount]?.id ?? diagramProofState.value.subgoals.at(-1)?.id;
      error.value = undefined;
    } catch (caught) {
      reportError(caught);
    }
  }

  function proveSubgoal(subgoalId: string): void {
    const proofSubgoal = proofState.value?.goals.find((goal) => goal.parentGoalId && goal.id === subgoalId);
    if (proofSubgoal && proofState.value) {
      try {
        if (proofSubgoal.status === "proved") {
          reportError("The selected subgoal is already proved.");
          return;
        }
        proofState.value = runTactic(proofState.value, subgoalId, tacticText.value, localDiagramRules.value).state;
        selectedSubgoalId.value =
          proofState.value.goals.find((goal) => goal.parentGoalId && goal.status !== "proved")?.id ?? subgoalId;
        error.value = undefined;
      } catch (caught) {
        reportError(caught);
      }
      return;
    }

    if (!diagramProofState.value) {
      return;
    }

    try {
      const subgoal = diagramProofState.value.subgoals.find((candidate) => candidate.id === subgoalId);
      if (subgoal?.status === "proved") {
        reportError("The selected diagram subgoal is already proved.");
        return;
      }

      const context = parseContext(contextText.value);
      diagramProofState.value = proveDiagramSubgoal(
        context,
        diagramProofState.value,
        subgoalId,
        tacticText.value,
        localDiagramRules.value
      );
      selectedSubgoalId.value =
        diagramProofState.value.subgoals.find((subgoal) => subgoal.status !== "proved")?.id ?? subgoalId;
      error.value = undefined;
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : String(caught);
    }
  }

  function selectProofTarget(targetId?: string): void {
    selectedSubgoalId.value = targetId;
    selectedDiagramRegionId.value = undefined;
  }

  function selectDiagramRegion(regionId?: string): void {
    selectedDiagramRegionId.value = selectedDiagramRegionId.value === regionId ? undefined : regionId;
    selectedSubgoalId.value = undefined;
  }

  function nearestCompletableProofTarget(start?: Goal): Goal | undefined {
    if (!proofState.value) {
      return undefined;
    }

    let current = start;
    while (current) {
      const children = proofState.value.goals.filter((goal) => goal.parentGoalId === current?.id);
      if (children.length > 0 && children.every((child) => child.status === "proved")) {
        return current;
      }
      current = current.parentGoalId
        ? proofState.value.goals.find((goal) => goal.id === current?.parentGoalId)
        : undefined;
    }

    return undefined;
  }

  function selectAfterCompletingProofTarget(completed: Goal): void {
    if (!proofState.value) {
      selectedSubgoalId.value = completed.parentGoalId ? completed.id : undefined;
      return;
    }

    const nextOpenSibling = completed.parentGoalId
      ? proofState.value.goals.find(
          (goal) => goal.parentGoalId === completed.parentGoalId && goal.status !== "proved"
        )
      : undefined;
    const nextOpenTopLevelSubgoal = proofState.value.goals.find(
      (goal) => goal.parentGoalId === activeGoal.value?.id && goal.status !== "proved"
    );

    selectedSubgoalId.value =
      nextOpenSibling?.id ??
      nextOpenTopLevelSubgoal?.id ??
      (completed.parentGoalId ? completed.parentGoalId : undefined);
  }

  function proofSubgoalRows(): Array<Goal & { depth: number; childCount: number; canComplete: boolean }> {
    if (!proofState.value || !activeGoal.value) {
      return [];
    }

    const rows: Array<Goal & { depth: number; childCount: number; canComplete: boolean }> = [];
    const appendChildren = (parentId: string, depth: number): void => {
      const children = proofState.value?.goals.filter((goal) => goal.parentGoalId === parentId) ?? [];
      for (const child of children) {
        const grandchildren = proofState.value?.goals.filter((goal) => goal.parentGoalId === child.id) ?? [];
        rows.push({
          ...child,
          depth,
          childCount: grandchildren.length,
          canComplete: canCompleteProofTarget(child)
        });
        appendChildren(child.id, depth + 1);
      }
    };

    appendChildren(activeGoal.value.id, 0);
    return rows;
  }

  function canCompleteProofTarget(target: Goal): boolean {
    if (!proofState.value || target.status !== "open") {
      return false;
    }

    const children = proofState.value.goals.filter((goal) => goal.parentGoalId === target.id);
    return (
      children.length > 0 &&
      children.every((child) => child.status === "proved") &&
      children.some((child) => child.completion?.kind === "productExt" || child.completion?.kind === "iso")
    );
  }

  function addSelectedRegionSubgoal(): void {
    if (!selectedDiagramRegionId.value) {
      reportError("Select a diagram region first.");
      return;
    }

    try {
      const context = parseContext(contextText.value);
      const currentDiagram = diagram.value ?? baseDiagram(context, parseEquation(goalText.value, context));
      const currentDiagramProofState = diagramProofState.value ?? createDiagramProofState(currentDiagram);
      diagramProofState.value = createSubgoalFromRegion(context, currentDiagramProofState, selectedDiagramRegionId.value);
      selectedSubgoalId.value =
        diagramProofState.value.subgoals.find((subgoal) => subgoal.regionId === selectedDiagramRegionId.value)?.id ??
        diagramProofState.value.subgoals.at(-1)?.id;
      selectedDiagramRegionId.value = undefined;
      error.value = undefined;
    } catch (caught) {
      reportError(caught);
    }
  }

  function addAllRegionSubgoals(): void {
    try {
      const context = parseContext(contextText.value);
      const currentDiagram = diagram.value ?? baseDiagram(context, parseEquation(goalText.value, context));
      let currentDiagramProofState = diagramProofState.value ?? createDiagramProofState(currentDiagram);
      const candidateRegionIds = diagramRegions.value
        .filter((region) => !region.isOuterGoal && !region.isSubgoal)
        .map((region) => region.id);

      if (candidateRegionIds.length === 0) {
        reportError("No available regions to add as subgoals.");
        return;
      }

      for (const regionId of candidateRegionIds) {
        currentDiagramProofState = createSubgoalFromRegion(context, currentDiagramProofState, regionId);
      }

      diagramProofState.value = currentDiagramProofState;
      selectedSubgoalId.value =
        diagramProofState.value.subgoals.find((subgoal) => subgoal.status !== "proved")?.id ??
        diagramProofState.value.subgoals.at(-1)?.id;
      selectedDiagramRegionId.value = undefined;
      error.value = undefined;
    } catch (caught) {
      reportError(caught);
    }
  }

  function completeGoalBySubgoals(targetId?: string): void {
    if (!proofState.value || !activeGoal.value || !completableProofTarget.value) {
      return;
    }
    const requestedTarget = targetId
      ? proofState.value.goals.find((goal) => goal.id === targetId)
      : undefined;
    const targetToComplete = requestedTarget ?? completableProofTarget.value;
    const targetChildren = proofState.value.goals.filter((goal) => goal.parentGoalId === targetToComplete.id);
    const canCompleteRequestedByProductExt =
      targetToComplete.status === "open" &&
      targetChildren.some((subgoal) => subgoal.completion?.kind === "productExt") &&
      targetChildren.every((subgoal) => subgoal.status === "proved");
    const canCompleteRequestedByIso =
      targetToComplete.status === "open" &&
      targetChildren.some((subgoal) => subgoal.completion?.kind === "iso") &&
      targetChildren.every((subgoal) => subgoal.status === "proved");

    if (!targetId && !canCompleteBySubgoals.value) {
      reportError("Complete the subgoals before completing the main goal.");
      return;
    }
    if (targetId && !canCompleteRequestedByProductExt && !canCompleteRequestedByIso) {
      reportError("Complete the subgoals before completing the main goal.");
      return;
    }

    try {
      const context = parseContext(contextText.value);
      if (canCompleteRequestedByProductExt || (!targetId && canCompleteByProductExt.value)) {
        const result = completeGoalByProductExt(proofState.value, targetToComplete.id);
        proofState.value = result.state;
        selectAfterCompletingProofTarget(result.goal);
        error.value = undefined;
        return;
      }
      if (canCompleteRequestedByIso || (!targetId && canCompleteByIso.value)) {
        const result = completeGoalByIso(proofState.value, targetToComplete.id);
        proofState.value = result.state;
        selectAfterCompletingProofTarget(result.goal);
        error.value = undefined;
        return;
      }
      if (!diagramProofState.value) {
        reportError("No diagram subgoals are available.");
        return;
      }
      const result = completeDiagramGoalBySubgoalsCore(
        context,
        diagramProofState.value,
        proofState.value,
        activeGoal.value.id
      );
      proofState.value = result.proofState;
      diagramProofState.value = result.diagramProofState;
      selectedSubgoalId.value = undefined;
      error.value = undefined;
    } catch (caught) {
      reportError(caught);
    }
  }

  function removeSelectedAuxiliary(): void {
    if (selectedAuxiliaryArrowId.value) {
      removeAuxiliaryArrowFromDiagram(selectedAuxiliaryArrowId.value);
    } else if (selectedAuxiliaryNodeId.value) {
      removeAuxiliaryNodeFromDiagram(selectedAuxiliaryNodeId.value);
    }
  }

  function removeAuxiliaryArrowFromDiagram(arrowId: string): void {
    try {
      const currentDiagram = requireCurrentDiagram();
      const nextDiagram = removeAuxiliaryArrow(currentDiagram, arrowId);
      replaceDiagram(nextDiagram);
      selectedAuxiliaryArrowId.value = undefined;
      error.value = undefined;
    } catch (caught) {
      reportError(caught);
    }
  }

  function removeAuxiliaryNodeFromDiagram(nodeId: string): void {
    try {
      const currentDiagram = requireCurrentDiagram();
      const nextDiagram = removeAuxiliaryNode(currentDiagram, nodeId);
      replaceDiagram(nextDiagram);
      selectedAuxiliaryNodeId.value = undefined;
      selectedAuxiliaryArrowId.value = undefined;
      error.value = undefined;
    } catch (caught) {
      reportError(caught);
    }
  }

  watch([contextText, goalText], () => {
    isDirty.value = true;
  });

  watch(contextText, () => {
    auxiliaryDiagram.value = undefined;
    diagramProofState.value = undefined;
    selectedSubgoalId.value = undefined;
    selectedDiagramRegionId.value = undefined;
  });

  elaborate();

  function baseDiagram(context: ReturnType<typeof parseContext>, equation: ReturnType<typeof parseEquation>): Diagram {
    return equationDiagram(context, equation);
  }

  function requireCurrentDiagram(): Diagram {
    const currentDiagram = diagram.value;
    if (!currentDiagram) {
      throw new Error("No diagram is available.");
    }
    return currentDiagram;
  }

  function replaceDiagram(nextDiagram: Diagram): void {
    auxiliaryDiagram.value = nextDiagram;
    diagramProofState.value = diagramProofState.value
      ? {
          ...diagramProofState.value,
          diagram: nextDiagram,
          subgoals: diagramProofState.value.subgoals.filter((subgoal) =>
            nextDiagram.regions.some((region) => region.id === subgoal.regionId)
          ),
          provedRegionIds: diagramProofState.value.provedRegionIds.filter((regionId) =>
            nextDiagram.regions.some((region) => region.id === regionId)
          )
        }
      : createDiagramProofState(nextDiagram);
  }

  function nextAuxiliaryNodeId(currentDiagram: Diagram): string {
    let index = 1;
    while (currentDiagram.nodes.some((node) => node.id === `aux-node-${index}`)) {
      index += 1;
    }
    return `aux-node-${index}`;
  }

  function nextAuxiliaryArrowId(currentDiagram: Diagram): string {
    let index = 1;
    while (currentDiagram.arrows.some((arrow) => arrow.id === `aux-${index}`)) {
      index += 1;
    }
    return `aux-${index}`;
  }

  function proofTargetText(target: (Pick<Goal, "target" | "equation"> | { target?: GoalTarget; equation: ReturnType<typeof parseEquation> }) | undefined): string {
    if (!target) {
      return "";
    }
    const goalTarget = proofTargetGoalTarget(target);
    return goalTarget ? prettyGoalTarget(goalTarget) : prettyEquation(target.equation);
  }

  function proofTargetLatex(target: (Pick<Goal, "target" | "equation"> | { target?: GoalTarget; equation: ReturnType<typeof parseEquation> }) | undefined): string {
    if (!target) {
      return "";
    }
    const goalTarget = proofTargetGoalTarget(target);
    return goalTarget ? latexGoalTarget(goalTarget) : latexEquation(target.equation);
  }

  function proofTargetGoalTarget(target: { equation: ReturnType<typeof parseEquation>; target?: GoalTarget } | undefined): GoalTarget | undefined {
    return target && "target" in target ? target.target : undefined;
  }

  function productExtTacticOptions() {
    if (
      !proofState.value ||
      !activeProofTarget.value ||
      proofTargetGoalTarget(activeProofTarget.value)?.kind === "iso" ||
      activeProofTarget.value.status !== "open"
    ) {
      return [];
    }

    const target = activeProofTarget.value.equation.hom.target;
    return proofState.value.context.decls
      .filter((decl): decl is ProductDecl => decl.kind === "productDecl" && equalObject(decl.product, target))
      .map((decl) => ({
        id: `product_ext:${decl.product.name}`,
        label: `product_ext ${decl.product.name}`,
        command: `product_ext ${decl.product.name}`,
        description: `Split this goal into the two projection subgoals for ${decl.product.name}.`
      }));
  }

  function isoTacticOptions() {
    if (!activeProofTarget.value || activeProofTarget.value.status !== "open" || proofTargetGoalTarget(activeProofTarget.value)?.kind !== "iso") {
      return [];
    }

    return [
      {
        id: "iso",
        label: "iso",
        command: "iso",
        description: "Split this isomorphism goal into the two inverse-law subgoals."
      }
    ];
  }

  function terminalExtTacticOptions() {
    if (!proofState.value || !activeProofTarget.value || activeProofTarget.value.status !== "open") {
      return [];
    }

    const target = activeProofTarget.value.equation.hom.target;
    return proofState.value.context.decls
      .filter((decl): decl is TerminalDecl => decl.kind === "terminalDecl" && equalObject(decl.terminal, target))
      .map((decl) => ({
        id: `terminal_ext:${decl.terminal.name}`,
        label: `terminal_ext ${decl.terminal.name}`,
        command: `terminal_ext ${decl.terminal.name}`,
        description: `Close this goal by uniqueness of maps into ${decl.terminal.name}.`
      }));
  }

  function describeRegions(regions: DiagramRegion[], currentDiagram: Diagram): DiagramRegionView[] {
    const outerGoalRegionId = diagramProofState.value?.outerGoalRegionId ?? currentDiagram.regions[0]?.id;
    const subgoalRegionIds = new Set(diagramProofState.value?.subgoals.map((subgoal) => subgoal.regionId) ?? []);

    let context: ReturnType<typeof parseContext>;
    try {
      context = parseContext(contextText.value);
    } catch (caught) {
      return regions.map((region) => ({
        ...region,
        isOuterGoal: region.id === outerGoalRegionId,
        isSubgoal: subgoalRegionIds.has(region.id),
        errorText: caught instanceof Error ? caught.message : String(caught)
      }));
    }

    return regions.map((region) => {
      try {
        return {
          ...region,
          isOuterGoal: region.id === outerGoalRegionId,
          isSubgoal: subgoalRegionIds.has(region.id),
          equationText: prettyEquation(regionEquation(context, currentDiagram, region.leftPath, region.rightPath)),
          equationLatex: latexEquation(regionEquation(context, currentDiagram, region.leftPath, region.rightPath))
        };
      } catch (caught) {
        return {
          ...region,
          isOuterGoal: region.id === outerGoalRegionId,
          isSubgoal: subgoalRegionIds.has(region.id),
          errorText: caught instanceof Error ? caught.message : String(caught)
        };
      }
    });
  }

  function reportError(caught: unknown): void {
    error.value = caught instanceof Error ? caught.message : String(caught);
    errorNonce.value += 1;
  }

  return {
    examples: proofExamples as ProofExample[],
    selectedExampleId,
    contextText,
    goalText,
    tacticText,
    proofState,
    isDirty,
    activeGoal,
    goalStatus,
    currentEquation,
    currentEquationLatex,
    activeProofTargetTitle,
    activeProofEquation,
    activeProofEquationLatex,
    activeProofStatus,
    canRunTactic,
    activeProofSteps,
    inspection,
    homType,
    homTypeLatex,
    normalizedEquation,
    normalizedEquationLatex,
    selectedExample,
    tacticOptions,
    diagram,
    proofPanelSubgoals,
    diagramSubgoals,
    diagramRegions,
    auxiliaryNodes,
    auxiliaryArrows,
    selectedSubgoalId,
    selectedDiagramRegionId,
    selectedRegionId,
    selectedAuxiliaryArrowId,
    selectedAuxiliaryNodeId,
    provedRegionIds,
    canCompleteBySubgoals,
    canSplitGoal,
    canAddAllRegionSubgoals,
    activePathSide,
    isPathSelectionMode,
    leftPath,
    rightPath,
    auxiliaryArrowId,
    auxiliaryFrom,
    auxiliaryTo,
    auxiliaryTermText,
    auxiliaryNodeId,
    auxiliaryNodeLabel,
    auxiliaryNodeObjectText,
    isAuxiliaryMode,
    activeAuxiliaryEndpoint,
    error,
    errorNonce,
    elaborate,
    runCurrentTactic,
    loadExample,
    addAuxiliaryNodeToDiagram,
    addAuxiliary,
    addDiagramSubgoal,
    splitCurrentDiagramGoal,
    proveSubgoal,
    selectProofTarget,
    selectDiagramRegion,
    addSelectedRegionSubgoal,
    addAllRegionSubgoals,
    completeGoalBySubgoals,
    selectDiagramArrow,
    selectDiagramNode,
    selectAuxiliaryArrow,
    selectAuxiliaryNode,
    removeSelectedAuxiliary,
    removeAuxiliaryArrowFromDiagram,
    removeAuxiliaryNodeFromDiagram,
    clearPath
  };
});
