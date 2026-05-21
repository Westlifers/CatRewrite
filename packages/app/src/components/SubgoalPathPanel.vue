<script setup lang="ts">
import type { DiagramRegionView } from "../stores/proofStore";
import { ref } from "vue";
import MathText from "./MathText.vue";

defineProps<{
  activeSide: "left" | "right";
  isPathSelectionMode: boolean;
  leftPath: string[];
  rightPath: string[];
  regions: DiagramRegionView[];
  selectedRegionId?: string;
  hasDiagram: boolean;
  canSplitGoal: boolean;
}>();

defineEmits<{
  "update:activeSide": [value: "left" | "right"];
  "update:isPathSelectionMode": [value: boolean];
  selectRegion: [regionId?: string];
  addRegionSubgoal: [];
  splitGoal: [];
  addSubgoal: [];
  clearPath: [side: "left" | "right"];
}>();

const showManualPaths = ref(false);
</script>

<template>
  <section class="panel subgoal-path-panel">
    <div class="panel-header">
      <div>
        <h2>Regions</h2>
        <p class="target-line">{{ regions.length ? `${regions.length} available regions` : "No regions available" }}</p>
      </div>
      <div class="button-row">
        <button type="button" :disabled="!selectedRegionId" @click="$emit('selectRegion', undefined)">
          Clear
        </button>
        <button type="button" :disabled="!selectedRegionId" @click="$emit('addRegionSubgoal')">
          Add Subgoal
        </button>
      </div>
    </div>

    <ol v-if="regions.length" class="region-list">
      <li
        v-for="region in regions"
        :key="region.id"
        :class="{ active: selectedRegionId === region.id }"
        @click="$emit('selectRegion', selectedRegionId === region.id ? undefined : region.id)"
      >
        <div class="subgoal-header">
          <strong>{{ region.id }}</strong>
          <span>{{ region.label ?? "region" }}</span>
        </div>
        <div v-if="region.equationText" class="region-equation">
          <MathText :latex="region.equationLatex" :fallback="region.equationText" />
        </div>
        <p v-else class="region-error">{{ region.errorText ?? "Cannot compute region equation." }}</p>
        <div class="region-paths">
          <code>{{ region.leftPath.join(" >> ") }}</code>
          <code>{{ region.rightPath.join(" >> ") }}</code>
        </div>
      </li>
    </ol>
    <p v-else class="muted">No selectable regions.</p>

    <div class="manual-paths">
      <button
        type="button"
        class="disclosure-header"
        :aria-expanded="showManualPaths"
        aria-controls="manual-path-controls"
        @click="showManualPaths = !showManualPaths"
      >
        <div>
          <h3>Manual Paths</h3>
          <p class="target-line">{{ isPathSelectionMode ? "Click arrows to build paths" : "Advanced fallback" }}</p>
        </div>
        <span class="disclosure-icon" aria-hidden="true"></span>
      </button>

      <Transition name="manual-paths">
        <div v-show="showManualPaths" id="manual-path-controls" class="manual-path-controls">
          <div class="button-row subgoal-actions">
            <button
              type="button"
              :disabled="!hasDiagram"
              :class="{ active: isPathSelectionMode }"
              @click="$emit('update:isPathSelectionMode', !isPathSelectionMode)"
            >
              {{ isPathSelectionMode ? "Done" : "Enter" }}
            </button>
            <button type="button" :disabled="!canSplitGoal" @click="$emit('splitGoal')">Split Goal</button>
            <button type="button" :disabled="!hasDiagram || !isPathSelectionMode" @click="$emit('addSubgoal')">
              Add Subgoal
            </button>
          </div>

          <div class="path-selector">
            <div class="mode-row">
              <button
                type="button"
                :disabled="!isPathSelectionMode"
                :class="{ active: activeSide === 'left' }"
                @click="$emit('update:activeSide', 'left')"
              >
                Select Left
              </button>
              <button
                type="button"
                :disabled="!isPathSelectionMode"
                :class="{ active: activeSide === 'right' }"
                @click="$emit('update:activeSide', 'right')"
              >
                Select Right
              </button>
            </div>
            <div class="selected-paths">
              <div>
                <div class="path-title">
                  <strong>Left</strong>
                  <button type="button" :disabled="!isPathSelectionMode" @click="$emit('clearPath', 'left')">Clear</button>
                </div>
                <p>
                  <span v-for="arrow in leftPath" :key="`left-${arrow}`">{{ arrow }}</span>
                </p>
              </div>
              <div>
                <div class="path-title">
                  <strong>Right</strong>
                  <button type="button" :disabled="!isPathSelectionMode" @click="$emit('clearPath', 'right')">Clear</button>
                </div>
                <p>
                  <span v-for="arrow in rightPath" :key="`right-${arrow}`">{{ arrow }}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </section>
</template>
