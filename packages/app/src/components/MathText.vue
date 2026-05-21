<script setup lang="ts">
import katex from "katex";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    latex?: string;
    display?: boolean;
    fallback?: string;
  }>(),
  {
    latex: "",
    display: false,
    fallback: ""
  }
);

const rendered = computed(() => {
  if (!props.latex) {
    return "";
  }

  try {
    return katex.renderToString(props.latex, {
      displayMode: props.display,
      throwOnError: false,
      strict: false
    });
  } catch {
    return "";
  }
});
</script>

<template>
  <span v-if="rendered" class="math-text" :class="{ 'math-display': display }" v-html="rendered"></span>
  <span v-else class="math-fallback">{{ fallback || latex }}</span>
</template>
