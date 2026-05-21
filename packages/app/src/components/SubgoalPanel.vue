<script setup lang="ts">
import { latexEquation, prettyEquation, type Equation, type ProofStep } from "@catrewrite/core";
import { computed } from "vue";
import MathText from "./MathText.vue";

export interface ProofSubgoalView {
  id: string;
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
  completeGoal: [];
}>();

const provedCount = computed(() => props.subgoals.filter((subgoal) => subgoal.status === "proved").length);

function proofSummary(steps: ProofStep[]): string {
  const step = steps.at(-1);
  return step ? step.message : "No proof step yet";
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
          Complete Goal
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
        v-for="subgoal in subgoals"
        :key="subgoal.id"
        :class="{ active: selectedSubgoalId === subgoal.id }"
        @click="$emit('selectTarget', subgoal.id)"
      >
        <div class="subgoal-header">
          <strong>{{ subgoal.id }}</strong>
          <span :data-status="subgoal.status">{{ subgoal.status }}</span>
        </div>
        <div class="math-block">
          <MathText :latex="latexEquation(subgoal.equation)" :fallback="prettyEquation(subgoal.equation)" />
        </div>
        <p class="proof-summary">{{ proofSummary(subgoal.proofSteps) }}</p>
        <button type="button" :disabled="subgoal.status === 'proved'" @click.stop="$emit('proveSubgoal', subgoal.id)">
          Prove
        </button>
      </li>
    </ol>
  </section>
</template>
