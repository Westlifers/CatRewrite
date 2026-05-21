<script setup lang="ts">
import AuxiliaryPanel from "./components/AuxiliaryPanel.vue";
import ContextPanel from "./components/ContextPanel.vue";
import DiagramPanel from "./components/DiagramPanel.vue";
import ExamplePicker from "./components/ExamplePicker.vue";
import ExampleExplainer from "./components/ExampleExplainer.vue";
import GoalPanel from "./components/GoalPanel.vue";
import GoalInspector from "./components/GoalInspector.vue";
import ProofTrace from "./components/ProofTrace.vue";
import RuleBrowser from "./components/RuleBrowser.vue";
import SubgoalPathPanel from "./components/SubgoalPathPanel.vue";
import SubgoalPanel from "./components/SubgoalPanel.vue";
import TacticConsole from "./components/TacticConsole.vue";
import { useProofStore } from "./stores/proofStore";
import { onBeforeUnmount, ref, watch } from "vue";

const proof = useProofStore();
const toastMessage = ref<string>();
let toastTimer: ReturnType<typeof setTimeout> | undefined;

watch(
  () => [proof.error, proof.errorNonce] as const,
  ([message]) => {
    if (!message) {
      toastMessage.value = undefined;
      return;
    }

    toastMessage.value = message;
    if (toastTimer) {
      clearTimeout(toastTimer);
    }
    toastTimer = setTimeout(() => {
      toastMessage.value = undefined;
    }, 4800);
  }
);

onBeforeUnmount(() => {
  if (toastTimer) {
    clearTimeout(toastTimer);
  }
});
</script>

<template>
  <main class="workspace">
    <header>
      <div>
        <p>CatRewrite</p>
        <h1>Workspace</h1>
      </div>
      <strong :data-status="proof.isDirty ? 'dirty' : proof.goalStatus">
        {{ proof.isDirty ? "edited" : proof.goalStatus }}
      </strong>
    </header>

    <Transition name="toast">
      <aside v-if="toastMessage" class="toast" role="alert" aria-live="polite">
        <div>
          <strong>Operation failed</strong>
          <p>{{ toastMessage }}</p>
        </div>
        <button type="button" aria-label="Dismiss warning" @click="toastMessage = undefined">&times;</button>
      </aside>
    </Transition>

    <div class="grid">
      <div class="stack workspace-left">
        <ExamplePicker
          v-model="proof.selectedExampleId"
          :examples="proof.examples"
          @select="proof.loadExample"
        />
        <ExampleExplainer :example="proof.selectedExample" />
        <ContextPanel v-model="proof.contextText" @elaborate="proof.elaborate" />
      </div>
      <div class="stack workspace-center">
        <GoalPanel
          v-model="proof.goalText"
          :current-equation="proof.currentEquation"
          :current-equation-latex="proof.currentEquationLatex"
          :status="proof.goalStatus"
          @elaborate="proof.elaborate"
        />
        <SubgoalPanel
          :subgoals="proof.diagramSubgoals"
          :selected-subgoal-id="proof.selectedSubgoalId"
          :can-complete-by-subgoals="proof.canCompleteBySubgoals"
          @select-target="proof.selectProofTarget"
          @prove-subgoal="proof.proveSubgoal"
          @complete-goal="proof.completeGoalBySubgoals"
        />
        <TacticConsole
          v-model="proof.tacticText"
          :options="proof.tacticOptions"
          :target-title="proof.activeProofTargetTitle"
          :target-status="proof.activeProofStatus"
          :target-equation="proof.activeProofEquation"
          :target-equation-latex="proof.activeProofEquationLatex"
          @run="proof.runCurrentTactic"
        />
        <ProofTrace :steps="proof.activeProofSteps" />
        <GoalInspector
          :hom-type="proof.homType"
          :hom-type-latex="proof.homTypeLatex"
          :equation="proof.activeProofEquation"
          :equation-latex="proof.activeProofEquationLatex"
          :normalized-equation="proof.normalizedEquation"
          :normalized-equation-latex="proof.normalizedEquationLatex"
          :applicable-count="proof.inspection?.applicableRules.length ?? 0"
        />
      </div>
      <div class="stack workspace-right">
        <DiagramPanel
          :is-path-selection-mode="proof.isPathSelectionMode"
          :left-path="proof.leftPath"
          :right-path="proof.rightPath"
          v-model:is-auxiliary-mode="proof.isAuxiliaryMode"
          :diagram="proof.diagram"
          :auxiliary-from="proof.auxiliaryFrom"
          :auxiliary-to="proof.auxiliaryTo"
          :proved-region-ids="proof.provedRegionIds"
          :selected-region-id="proof.selectedRegionId"
          :selected-auxiliary-arrow-id="proof.selectedAuxiliaryArrowId"
          :selected-auxiliary-node-id="proof.selectedAuxiliaryNodeId"
          @select-arrow="proof.selectDiagramArrow"
          @select-node="proof.selectDiagramNode"
          @remove-auxiliary-arrow="proof.removeAuxiliaryArrowFromDiagram"
          @remove-auxiliary-node="proof.removeAuxiliaryNodeFromDiagram"
        />
        <SubgoalPathPanel
          v-model:active-side="proof.activePathSide"
          v-model:is-path-selection-mode="proof.isPathSelectionMode"
          :left-path="proof.leftPath"
          :right-path="proof.rightPath"
          :regions="proof.diagramRegions"
          :selected-region-id="proof.selectedDiagramRegionId"
          :has-diagram="!!proof.diagram"
          :can-split-goal="proof.canSplitGoal"
          @select-region="proof.selectDiagramRegion"
          @add-region-subgoal="proof.addSelectedRegionSubgoal"
          @split-goal="proof.splitCurrentDiagramGoal"
          @add-subgoal="proof.addDiagramSubgoal"
          @clear-path="proof.clearPath"
        />
        <RuleBrowser
          :available-rules="proof.inspection?.availableRules ?? []"
          :applicable-rules="proof.inspection?.applicableRules ?? []"
        />
      </div>
      <div class="stack workspace-aux">
        <AuxiliaryPanel
          v-model:auxiliary-arrow-id="proof.auxiliaryArrowId"
          v-model:auxiliary-from="proof.auxiliaryFrom"
          v-model:auxiliary-to="proof.auxiliaryTo"
          v-model:auxiliary-term="proof.auxiliaryTermText"
          v-model:auxiliary-node-id="proof.auxiliaryNodeId"
          v-model:auxiliary-node-label="proof.auxiliaryNodeLabel"
          v-model:auxiliary-node-object="proof.auxiliaryNodeObjectText"
          v-model:is-auxiliary-mode="proof.isAuxiliaryMode"
          v-model:active-auxiliary-endpoint="proof.activeAuxiliaryEndpoint"
          :nodes="proof.auxiliaryNodes"
          :arrows="proof.auxiliaryArrows"
          :selected-auxiliary-arrow-id="proof.selectedAuxiliaryArrowId"
          :selected-auxiliary-node-id="proof.selectedAuxiliaryNodeId"
          :has-diagram="!!proof.diagram"
          @add-auxiliary-node="proof.addAuxiliaryNodeToDiagram"
          @add-auxiliary="proof.addAuxiliary"
          @select-auxiliary-arrow="proof.selectAuxiliaryArrow"
          @select-auxiliary-node="proof.selectAuxiliaryNode"
          @remove-selected-auxiliary="proof.removeSelectedAuxiliary"
          @remove-auxiliary-arrow="proof.removeAuxiliaryArrowFromDiagram"
          @remove-auxiliary-node="proof.removeAuxiliaryNodeFromDiagram"
        />
      </div>
    </div>

  </main>
</template>
