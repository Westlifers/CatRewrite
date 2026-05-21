<script setup lang="ts">
import { latexEquation, prettyEquation, type DiagramSubgoal } from "@catrewrite/core";
import { computed } from "vue";
import MathText from "./MathText.vue";

const props = defineProps<{
  subgoals: DiagramSubgoal[];
  selectedSubgoalId?: string;
  canCompleteBySubgoals: boolean;
}>();

defineEmits<{
  selectTarget: [subgoalId?: string];
  proveSubgoal: [subgoalId: string];
  completeGoal: [];
}>();

const provedCount = computed(() => props.subgoals.filter((subgoal) => subgoal.status === "proved").length);
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
        <button type="button" :class="{ active: !selectedSubgoalId }" @click="$emit('selectTarget', undefined)">
          Main Goal
        </button>
        <button type="button" :disabled="!canCompleteBySubgoals" @click="$emit('completeGoal')">
          Complete Goal
        </button>
      </div>
    </div>

    <ol v-if="subgoals.length" class="subgoal-list">
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
        <button type="button" :disabled="subgoal.status === 'proved'" @click.stop="$emit('proveSubgoal', subgoal.id)">
          Prove
        </button>
      </li>
    </ol>
    <p v-else class="muted">No subgoals.</p>
  </section>
</template>
