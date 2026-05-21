<script setup lang="ts">
import { latexTerm, prettyTerm, type ApplicableRuleSummary, type RuleSummary } from "@catrewrite/core";
import MathText from "./MathText.vue";

defineProps<{
  availableRules: RuleSummary[];
  applicableRules: ApplicableRuleSummary[];
}>();
</script>

<template>
  <section class="panel rule-panel">
    <div class="panel-header">
      <h2>Rules</h2>
      <span>{{ availableRules.length }}</span>
    </div>

    <h3>Applicable</h3>
    <ol v-if="applicableRules.length" class="rule-list">
      <li v-for="rule in applicableRules" :key="`${rule.id}-${rule.side}`">
        <strong>{{ rule.id }}</strong>
        <span class="rule-result">
          {{ rule.side }}
          <span aria-hidden="true">-></span>
          <MathText :latex="latexTerm(rule.result)" :fallback="prettyTerm(rule.result)" />
        </span>
      </li>
    </ol>
    <p v-else>No rewrite applies to the normalized goal.</p>

    <h3>Generated</h3>
    <ol class="rule-list">
      <li v-for="rule in availableRules" :key="rule.id">
        <strong>{{ rule.id }}</strong>
        <span>{{ rule.tags.join(", ") }}</span>
      </li>
    </ol>
  </section>
</template>
