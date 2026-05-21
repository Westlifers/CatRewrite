<script setup lang="ts">
import MathText from "./MathText.vue";

defineProps<{
  modelValue: string;
  currentEquation: string;
  currentEquationLatex: string;
  status: string;
}>();

defineEmits<{
  "update:modelValue": [value: string];
  elaborate: [];
}>();
</script>

<template>
  <section class="panel">
    <div class="panel-header">
      <h2>Goal</h2>
      <span class="status" :data-status="status">{{ status }}</span>
    </div>
    <textarea
      class="goal-input"
      spellcheck="false"
      :value="modelValue"
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      @blur="$emit('elaborate')"
    />
    <output>
      <MathText :latex="currentEquationLatex" :fallback="currentEquation" />
    </output>
  </section>
</template>
