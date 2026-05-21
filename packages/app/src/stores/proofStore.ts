import {
  createGoal,
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
  latexHom,
  parseContext,
  parseEquation,
  parseObjectExpr,
  parseTerm,
  prettyEquation,
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
  type Diagram,
  type DiagramArrow,
  type DiagramNode,
  type DiagramRegion,
  type DiagramProofState,
  type GoalInspection,
  type ProofExample,
  type ProofState,
  type RewriteRule
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
  const auxiliaryArrowId = ref("g-mid");
  const auxiliaryFrom = ref("rhs-node-1");
  const auxiliaryTo = ref("lhs-node-2");
  const auxiliaryTermText = ref("G.map(f)");
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
  const currentEquation = computed(() => (activeGoal.value ? prettyEquation(activeGoal.value.equation) : ""));
  const currentEquationLatex = computed(() => (activeGoal.value ? latexEquation(activeGoal.value.equation) : ""));
  const activeProofEquation = computed(() =>
    activeProofTarget.value ? prettyEquation(activeProofTarget.value.equation) : ""
  );
  const activeProofEquationLatex = computed(() =>
    activeProofTarget.value ? latexEquation(activeProofTarget.value.equation) : ""
  );
  const activeProofStatus = computed(() => activeProofTarget.value?.status ?? "open");
  const canRunTactic = computed(() => Boolean(activeProofTarget.value) && activeProofStatus.value !== "proved");
  const activeProofSteps = computed(() => activeProofTarget.value?.proofSteps ?? proofState.value?.proofLog ?? []);
  const localDiagramRules = computed<RewriteRule[]>(() =>
    diagramProofState.value ? diagramSubgoalRules(diagramProofState.value) : []
  );
  const inspection = computed<GoalInspection | undefined>(() =>
    proofState.value && activeProofTarget.value
      ? inspectEquation(proofState.value.context, activeProofTarget.value.equation, localDiagramRules.value)
      : undefined
  );
  const homType = computed(() => (inspection.value ? prettyHom(inspection.value.hom) : ""));
  const homTypeLatex = computed(() => (inspection.value ? latexHom(inspection.value.hom) : ""));
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

    return [...baseTacticOptions, ...naturalityOptions, ...rewriteOptions];
  });
  const diagram = computed<Diagram | undefined>(() => {
    if (diagramProofState.value) {
      return diagramProofState.value.diagram;
    }

    if (auxiliaryDiagram.value) {
      return auxiliaryDiagram.value;
    }

    try {
      const context = parseContext(contextText.value);
      const equation = activeGoal.value?.equation ?? parseEquation(goalText.value, context);
      return baseDiagram(context, equation);
    } catch {
      return undefined;
    }
  });
  const proofSubgoals = computed(() => proofState.value?.goals.filter((goal) => goal.parentGoalId) ?? []);
  const diagramSubgoals = computed(() => diagramProofState.value?.subgoals ?? []);
  const proofPanelSubgoals = computed(() => [...proofSubgoals.value, ...diagramSubgoals.value]);
  const diagramRegions = computed<DiagramRegionView[]>(() => {
    const currentDiagram = diagram.value;
    if (!currentDiagram) {
      return [];
    }

    if (!diagramProofState.value) {
      return describeRegions(currentDiagram.regions, currentDiagram);
    }

    const regions = [...diagramProofState.value.diagram.regions];
    const regionIds = new Set(regions.map((region) => region.id));
    for (const region of splittableRegions(diagramProofState.value)) {
      if (!regionIds.has(region.id)) {
        regions.push(region);
        regionIds.add(region.id);
      }
    }

    return describeRegions(regions, diagramProofState.value.diagram);
  });
  const auxiliaryNodes = computed<DiagramNode[]>(() =>
    (diagram.value?.nodes ?? []).filter((node) => node.status === "auxiliary")
  );
  const auxiliaryArrows = computed<DiagramArrow[]>(() =>
    (diagram.value?.arrows ?? []).filter((arrow) => arrow.status === "auxiliary")
  );
  const provedRegionIds = computed(() => diagramProofState.value?.provedRegionIds ?? []);
  const selectedRegionId = computed(() => selectedDiagramSubgoal.value?.regionId ?? selectedDiagramRegionId.value);
  const canCompleteByProductExt = computed(() =>
    activeGoal.value?.status === "open" &&
    proofSubgoals.value.some((subgoal) => subgoal.completion?.kind === "productExt") &&
    proofSubgoals.value.every((subgoal) => subgoal.status === "proved")
  );
  const canCompleteByDiagramSubgoals = computed(() =>
    activeGoal.value?.status === "open" &&
    diagramSubgoals.value.length > 0 &&
    diagramSubgoals.value.every((subgoal) => subgoal.status === "proved")
  );
  const canCompleteBySubgoals = computed(() => canCompleteByProductExt.value || canCompleteByDiagramSubgoals.value);
  const canSplitGoal = computed(() => (diagramProofState.value ? splittableRegions(diagramProofState.value).length > 0 : false));
  const canAddAllRegionSubgoals = computed(() =>
    diagramRegions.value.some((region) => !region.isOuterGoal && !region.isSubgoal)
  );

  function elaborate(): void {
    try {
      const context = parseContext(contextText.value);
      const equation = parseEquation(goalText.value, context);
      const goalDiagram = baseDiagram(context, equation);
      proofState.value = createProofState(context, [createGoal("goal-1", equation)]);
      auxiliaryDiagram.value = undefined;
      diagramProofState.value = createDiagramProofState(goalDiagram);
      selectedSubgoalId.value = undefined;
      selectedDiagramRegionId.value = undefined;
      resetSelectedPaths(goalDiagram);
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
        selectedSubgoalId.value =
          proofState.value.goals.find((goal) => goal.parentGoalId && goal.status !== "proved")?.id ?? selectedProofSubgoal.value.id;
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
    resetAuxiliaryDefaultsForExample(example.id);
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

  function completeGoalBySubgoals(): void {
    if (!proofState.value || !activeGoal.value) {
      return;
    }

    if (!canCompleteBySubgoals.value) {
      reportError("Complete the subgoals before completing the main goal.");
      return;
    }

    try {
      const context = parseContext(contextText.value);
      if (canCompleteByProductExt.value) {
        const result = completeGoalByProductExt(proofState.value, activeGoal.value.id);
        proofState.value = result.state;
        selectedSubgoalId.value = undefined;
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

  function resetAuxiliaryDefaultsForExample(exampleId: string): void {
    if (exampleId === "vertical-composite-naturality") {
      auxiliaryArrowId.value = "g-mid";
      auxiliaryFrom.value = "rhs-node-1";
      auxiliaryTo.value = "lhs-node-2";
      auxiliaryTermText.value = "G.map(f)";
      activeAuxiliaryEndpoint.value = "from";
    }
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
