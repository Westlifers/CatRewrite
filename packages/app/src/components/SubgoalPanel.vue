<script setup lang="ts">
import { latexEquation, latexGoalTarget, prettyEquation, prettyGoalTarget, type Equation, type GoalTarget, type ProofStep } from "@catrewrite/core";
import { computed, ref } from "vue";
import MathText from "./MathText.vue";

export interface ProofSubgoalView {
  id: string;
  parentGoalId?: string;
  depth?: number;
  childCount?: number;
  canComplete?: boolean;
  target?: GoalTarget;
  equation: Equation;
  status: "open" | "proved" | "failed";
  proofSteps: ProofStep[];
}

const props = defineProps<{
  mainEquation: string;
  mainEquationLatex: string;
  mainStatus: string;
  mainProofSteps: ProofStep[];
  subgoals: ProofSubgoalView[];
  selectedSubgoalId?: string;
  canCompleteBySubgoals: boolean;
}>();

defineEmits<{
  selectTarget: [subgoalId?: string];
  proveSubgoal: [subgoalId: string];
  completeGoal: [subgoalId?: string];
}>();

const provedCount = computed(() => props.subgoals.filter((subgoal) => subgoal.status === "proved").length);
const collapsedIds = ref(new Set<string>());
const visibleSubgoals = computed(() =>
  props.subgoals.filter((subgoal) => {
    let parentId = subgoal.parentGoalId;
    while (parentId) {
      if (collapsedIds.value.has(parentId)) {
        return false;
      }
      parentId = props.subgoals.find((candidate) => candidate.id === parentId)?.parentGoalId;
    }
    return true;
  })
);

function proofSummary(steps: ProofStep[]): string {
  const step = steps.at(-1);
  return step ? step.message : "No proof step yet";
}

function targetText(subgoal: ProofSubgoalView): string {
  return subgoal.target ? prettyGoalTarget(subgoal.target) : prettyEquation(subgoal.equation);
}

function targetLatex(subgoal: ProofSubgoalView): string {
  return subgoal.target ? latexGoalTarget(subgoal.target) : latexEquation(subgoal.equation);
}

function toggleCollapsed(subgoalId: string): void {
  const next = new Set(collapsedIds.value);
  if (next.has(subgoalId)) {
    next.delete(subgoalId);
  } else {
    next.add(subgoalId);
  }
  collapsedIds.value = next;
}
</script>

<template>
  <section class="panel subgoal-panel">
    <div class="panel-header">
      <div>
        <h2>Proof State</h2>
        <p class="target-line">
          {{ subgoals.length ? `${provedCount}/${subgoals.length} subgoals proved` : "Main goal and subgoals" }}
        </p>
      </div>
      <div class="button-row">
        <button type="button" :disabled="!canCompleteBySubgoals" @click="$emit('completeGoal')">
          Complete Main
        </button>
      </div>
    </div>

    <ol class="subgoal-list">
      <li class="main-proof-target" :class="{ active: !selectedSubgoalId }" @click="$emit('selectTarget', undefined)">
        <div class="subgoal-header">
          <strong>Main Goal</strong>
          <span :data-status="mainStatus">{{ mainStatus }}</span>
        </div>
        <div class="math-block">
          <MathText :latex="mainEquationLatex" :fallback="mainEquation" />
        </div>
        <p class="proof-summary">{{ proofSummary(mainProofSteps) }}</p>
      </li>
      <li
        v-for="subgoal in visibleSubgoals"
        :key="subgoal.id"
        :class="{ active: selectedSubgoalId === subgoal.id }"
        :style="{ marginLeft: `${(subgoal.depth ?? 0) * 18}px` }"
        @click="$emit('selectTarget', subgoal.id)"
      >
        <div class="subgoal-header">
          <strong>
            <button
              v-if="subgoal.childCount"
              type="button"
              class="collapse-button"
              @click.stop="toggleCollapsed(subgoal.id)"
            >
              {{ collapsedIds.has(subgoal.id) ? "+" : "-" }}
            </button>
            {{ subgoal.id }}
          </strong>
          <span :data-status="subgoal.status">{{ subgoal.status }}</span>
        </div>
        <div class="math-block">
          <MathText :latex="targetLatex(subgoal)" :fallback="targetText(subgoal)" />
        </div>
        <p class="proof-summary">{{ proofSummary(subgoal.proofSteps) }}</p>
        <div class="button-row subgoal-actions">
          <button type="button" :disabled="subgoal.status === 'proved'" @click.stop="$emit('proveSubgoal', subgoal.id)">
            Prove
          </button>
          <button
            v-if="subgoal.childCount"
            type="button"
            :disabled="!subgoal.canComplete"
            @click.stop="$emit('completeGoal', subgoal.id)"
          >
            Complete
          </button>
        </div>
      </li>
    </ol>
  </section>
</template>
