<script setup lang="ts">
defineProps<{
  modelValue: string;
}>();

defineEmits<{
  "update:modelValue": [value: string];
  elaborate: [];
}>();
</script>

<template>
  <section class="panel context-panel">
    <div class="panel-header">
      <h2>Context</h2>
      <button type="button" @click="$emit('elaborate')">Check</button>
    </div>
    <textarea
      spellcheck="false"
      :value="modelValue"
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
  </section>
</template>
