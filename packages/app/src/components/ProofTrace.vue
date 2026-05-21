<script setup lang="ts">
import { latexEquation, prettyEquation, type ProofStep } from "@catrewrite/core";
import MathText from "./MathText.vue";

defineProps<{
  steps: ProofStep[];
  title: string;
}>();
</script>

<template>
  <section class="panel trace-panel">
    <div class="panel-header">
      <h2>Trace: {{ title }}</h2>
      <span>{{ steps.length }}</span>
    </div>
    <ol v-if="steps.length">
      <li v-for="step in steps" :key="step.id">
        <strong>{{ step.tactic }}</strong>
        <span>{{ step.message }}</span>
        <div class="math-block">
          <MathText :latex="latexEquation(step.before)" :fallback="prettyEquation(step.before)" />
        </div>
        <div v-if="step.after" class="math-block">
          <MathText :latex="latexEquation(step.after)" :fallback="prettyEquation(step.after)" />
        </div>
      </li>
    </ol>
    <p v-else>No steps yet.</p>
  </section>
</template>
