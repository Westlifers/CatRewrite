<script setup lang="ts">
import type { ProofExample } from "@catrewrite/core";

defineProps<{
  example: ProofExample;
}>();
</script>

<template>
  <section class="panel explainer-panel">
    <div class="panel-header">
      <h2>{{ example.title }}</h2>
    </div>
    <p>{{ example.summary }}</p>
    <p>{{ example.explanation }}</p>
  </section>
</template>
