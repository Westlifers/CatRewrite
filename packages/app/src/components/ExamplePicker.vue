<script setup lang="ts">
import type { ProofExample } from "@catrewrite/core";

defineProps<{
  examples: ProofExample[];
  modelValue: string;
}>();

defineEmits<{
  "update:modelValue": [value: string];
  select: [value: string];
}>();
</script>

<template>
  <section class="panel example-panel">
    <div class="panel-header">
      <h2>Examples</h2>
    </div>
    <select
      :value="modelValue"
      @change="
        $emit('update:modelValue', ($event.target as HTMLSelectElement).value);
        $emit('select', ($event.target as HTMLSelectElement).value);
      "
    >
      <option v-for="example in examples" :key="example.id" :value="example.id">
        {{ example.title }}
      </option>
    </select>
  </section>
</template>
