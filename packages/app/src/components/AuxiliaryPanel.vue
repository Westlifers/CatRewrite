<script setup lang="ts">
import { latexObject, latexTerm, prettyObject, prettyTerm, type DiagramArrow, type DiagramNode } from "@catrewrite/core";
import MathText from "./MathText.vue";

defineProps<{
  nodes: DiagramNode[];
  arrows: DiagramArrow[];
  auxiliaryArrowId: string;
  auxiliaryFrom: string;
  auxiliaryTo: string;
  auxiliaryTerm: string;
  auxiliaryNodeId: string;
  auxiliaryNodeLabel: string;
  auxiliaryNodeObject: string;
  isAuxiliaryMode: boolean;
  activeAuxiliaryEndpoint: "from" | "to";
  selectedAuxiliaryArrowId?: string;
  selectedAuxiliaryNodeId?: string;
  hasDiagram: boolean;
}>();

defineEmits<{
  "update:auxiliaryArrowId": [value: string];
  "update:auxiliaryFrom": [value: string];
  "update:auxiliaryTo": [value: string];
  "update:auxiliaryTerm": [value: string];
  "update:auxiliaryNodeId": [value: string];
  "update:auxiliaryNodeLabel": [value: string];
  "update:auxiliaryNodeObject": [value: string];
  "update:isAuxiliaryMode": [value: boolean];
  "update:activeAuxiliaryEndpoint": [value: "from" | "to"];
  addAuxiliaryNode: [];
  addAuxiliary: [];
  selectAuxiliaryArrow: [arrowId?: string];
  selectAuxiliaryNode: [nodeId?: string];
  removeAuxiliaryArrow: [arrowId: string];
  removeAuxiliaryNode: [nodeId: string];
  removeSelectedAuxiliary: [];
}>();
</script>

<template>
  <section class="panel auxiliary-panel">
    <div class="panel-header">
      <div>
        <h2>Auxiliary Tools</h2>
        <p class="target-line">{{ nodes.length }} nodes, {{ arrows.length }} arrows</p>
      </div>
      <button
        type="button"
        :disabled="!selectedAuxiliaryArrowId && !selectedAuxiliaryNodeId"
        @click="$emit('removeSelectedAuxiliary')"
      >
        Delete
      </button>
    </div>

    <div class="auxiliary-editor">
      <div class="panel-header compact-header">
        <h3>Node</h3>
        <button type="button" :disabled="!hasDiagram" @click="$emit('addAuxiliaryNode')">Add</button>
      </div>
      <div class="path-grid">
        <label>
          Id
          <input
            :value="auxiliaryNodeId"
            spellcheck="false"
            @input="$emit('update:auxiliaryNodeId', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label>
          Label
          <input
            :value="auxiliaryNodeLabel"
            placeholder="defaults to object"
            spellcheck="false"
            @input="$emit('update:auxiliaryNodeLabel', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label>
          Object
          <input
            :value="auxiliaryNodeObject"
            spellcheck="false"
            @input="$emit('update:auxiliaryNodeObject', ($event.target as HTMLInputElement).value)"
          />
        </label>
      </div>
    </div>

    <div class="auxiliary-editor">
      <div class="panel-header compact-header">
        <h3>Arrow</h3>
        <div class="button-row">
          <button type="button" :disabled="!hasDiagram" @click="$emit('addAuxiliary')">Add</button>
        </div>
      </div>
      <div class="endpoint-picker" aria-label="Auxiliary arrow endpoints">
        <button
          type="button"
          :disabled="!hasDiagram"
          :class="{ active: isAuxiliaryMode && activeAuxiliaryEndpoint === 'from' }"
          @click="
            $emit('update:activeAuxiliaryEndpoint', 'from');
            $emit('update:isAuxiliaryMode', !(isAuxiliaryMode && activeAuxiliaryEndpoint === 'from'));
          "
        >
          Domain
        </button>
        <span aria-hidden="true">-></span>
        <button
          type="button"
          :disabled="!hasDiagram"
          :class="{ active: isAuxiliaryMode && activeAuxiliaryEndpoint === 'to' }"
          @click="
            $emit('update:activeAuxiliaryEndpoint', 'to');
            $emit('update:isAuxiliaryMode', !(isAuxiliaryMode && activeAuxiliaryEndpoint === 'to'));
          "
        >
          Codomain
        </button>
      </div>
      <div class="path-grid">
        <label>
          Id
          <input
            :value="auxiliaryArrowId"
            spellcheck="false"
            @input="$emit('update:auxiliaryArrowId', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label>
          From
          <input
            :value="auxiliaryFrom"
            spellcheck="false"
            @input="$emit('update:auxiliaryFrom', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label>
          To
          <input
            :value="auxiliaryTo"
            spellcheck="false"
            @input="$emit('update:auxiliaryTo', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label>
          Term
          <input
            :value="auxiliaryTerm"
            spellcheck="false"
            @input="$emit('update:auxiliaryTerm', ($event.target as HTMLInputElement).value)"
          />
        </label>
      </div>
    </div>

    <div class="auxiliary-list-block">
      <h3>Nodes</h3>
      <ol v-if="nodes.length" class="auxiliary-list">
        <li
          v-for="node in nodes"
          :key="node.id"
          :class="{ active: selectedAuxiliaryNodeId === node.id }"
          @click="$emit('selectAuxiliaryNode', node.id)"
        >
          <div class="subgoal-header">
            <strong>{{ node.id }}</strong>
            <button type="button" @click.stop="$emit('removeAuxiliaryNode', node.id)">Delete</button>
          </div>
          <div class="math-block">
            {{ node.label }} :
            <MathText :latex="latexObject(node.object)" :fallback="prettyObject(node.object)" />
          </div>
        </li>
      </ol>
      <p v-else class="muted">No auxiliary nodes.</p>
    </div>

    <div class="auxiliary-list-block">
      <h3>Arrows</h3>
      <ol v-if="arrows.length" class="auxiliary-list">
        <li
          v-for="arrow in arrows"
          :key="arrow.id"
          :class="{ active: selectedAuxiliaryArrowId === arrow.id }"
          @click="$emit('selectAuxiliaryArrow', arrow.id)"
        >
          <div class="subgoal-header">
            <strong>{{ arrow.id }}</strong>
            <button type="button" @click.stop="$emit('removeAuxiliaryArrow', arrow.id)">Delete</button>
          </div>
          <code>{{ arrow.from }} -> {{ arrow.to }}</code>
          <div class="math-block">
            <MathText :latex="latexTerm(arrow.term)" :fallback="prettyTerm(arrow.term)" />
          </div>
        </li>
      </ol>
      <p v-else class="muted">No auxiliary arrows.</p>
    </div>
  </section>
</template>
