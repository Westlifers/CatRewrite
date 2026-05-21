<script setup lang="ts">
import MathText from "./MathText.vue";

defineProps<{
  homType: string;
  homTypeLatex: string;
  equation: string;
  equationLatex: string;
  normalizedEquation: string;
  normalizedEquationLatex: string;
  applicableCount: number;
}>();
</script>

<template>
  <section class="panel inspector-panel">
    <div class="panel-header">
      <h2>Inspector</h2>
      <span>{{ applicableCount }} applicable</span>
    </div>
    <dl>
      <div>
        <dt>Type</dt>
        <dd>
          <MathText v-if="homType" :latex="homTypeLatex" :fallback="homType" />
          <span v-else>?</span>
        </dd>
      </div>
      <div>
        <dt>Current</dt>
        <dd>
          <MathText v-if="equation" :latex="equationLatex" :fallback="equation" />
          <span v-else>?</span>
        </dd>
      </div>
      <div>
        <dt>Normalized</dt>
        <dd>
          <MathText v-if="normalizedEquation" :latex="normalizedEquationLatex" :fallback="normalizedEquation" />
          <span v-else>?</span>
        </dd>
      </div>
    </dl>
  </section>
</template>
