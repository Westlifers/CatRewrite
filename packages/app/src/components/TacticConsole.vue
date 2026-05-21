<script setup lang="ts">
import type { TacticOption } from "@catrewrite/core";
import MathText from "./MathText.vue";

defineProps<{
  modelValue: string;
  options: TacticOption[];
  targetTitle: string;
  targetStatus: string;
  targetEquation: string;
  targetEquationLatex: string;
}>();

defineEmits<{
  "update:modelValue": [value: string];
  run: [];
}>();
</script>

<template>
  <section class="panel tactic-panel">
    <div class="panel-header">
      <div>
        <h2>Tactic</h2>
        <p class="target-line">{{ targetTitle }} / {{ targetStatus }}</p>
      </div>
      <button type="button" @click="$emit('run')">Prove</button>
    </div>
    <div v-if="targetEquation" class="target-equation">
      <MathText :latex="targetEquationLatex" :fallback="targetEquation" />
    </div>
    <div class="tactic-bar">
      <button
        v-for="option in options"
        :key="option.id"
        type="button"
        :title="option.description"
        :class="{ active: option.command === modelValue }"
        @click="$emit('update:modelValue', option.command)"
      >
        {{ option.label }}
      </button>
    </div>
    <input
      :value="modelValue"
      spellcheck="false"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @keydown.enter="$emit('run')"
    />
  </section>
</template>
