<script setup lang="ts">
import { latexObject, latexTerm, type Diagram, type DiagramRegion } from "@catrewrite/core";
import { computed } from "vue";
import { ref } from "vue";
import MathText from "./MathText.vue";

const props = defineProps<{
  diagram?: Diagram;
  regions?: DiagramRegion[];
  isPathSelectionMode: boolean;
  leftPath: string[];
  rightPath: string[];
  isAuxiliaryMode: boolean;
  auxiliaryFrom: string;
  auxiliaryTo: string;
  selectedAuxiliaryArrowId?: string;
  selectedAuxiliaryNodeId?: string;
  provedRegionIds: string[];
  selectedRegionId?: string;
}>();

const emit = defineEmits<{
  "update:isAuxiliaryMode": [value: boolean];
  selectArrow: [arrowId: string];
  selectNode: [nodeId: string];
  removeAuxiliaryArrow: [arrowId: string];
  removeAuxiliaryNode: [nodeId: string];
}>();

const zoom = ref(1);
const pan = ref({ x: 0, y: 0 });
const isPanning = ref(false);
const lastPointer = ref({ x: 0, y: 0 });
const contextMenu = ref<{ x: number; y: number; kind: "arrow" | "node"; id: string }>();
const canvasCenter = { x: 235, y: 155 };
const zoomTransform = computed(
  () =>
    `translate(${pan.value.x} ${pan.value.y}) translate(${canvasCenter.x} ${canvasCenter.y}) scale(${zoom.value}) translate(${-canvasCenter.x} ${-canvasCenter.y})`
);
const inverseZoom = computed(() => 1 / zoom.value);

const nodeMap = computed(() => new Map((props.diagram?.nodes ?? []).map((node) => [node.id, node])));
const visibleRegions = computed(() => props.regions ?? props.diagram?.regions ?? []);
const selectedRegion = computed(() =>
  visibleRegions.value.find((region) => region.id === props.selectedRegionId)
);
const selectedRegionArrowIds = computed(() => new Set([...(selectedRegion.value?.leftPath ?? []), ...(selectedRegion.value?.rightPath ?? [])]));

const renderedArrows = computed(() =>
  (props.diagram?.arrows ?? []).flatMap((arrow) => {
    const source = nodeMap.value.get(arrow.from);
    const target = nodeMap.value.get(arrow.to);
    if (!source || !target) {
      return [];
    }

    const dx = target.position.x - source.position.x;
    const dy = target.position.y - source.position.y;
    const length = Math.max(Math.hypot(dx, dy), 1);
    const ux = dx / length;
    const uy = dy / length;
    const start = {
      x: source.position.x + ux * 34,
      y: source.position.y + uy * 22
    };
    const end = {
      x: target.position.x - ux * 34,
      y: target.position.y - uy * 22
    };
    const selectedSide = props.isPathSelectionMode
      ? props.leftPath.includes(arrow.id)
        ? "left"
        : props.rightPath.includes(arrow.id)
          ? "right"
          : undefined
      : undefined;
    const selectedRegionMember = selectedRegionArrowIds.value.has(arrow.id);
    const midpoint = {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2
    };
    const labelOffset = labelOffsetForArrow(ux, uy, midpoint);

    return [
      {
        ...arrow,
        start,
        end,
        labelPosition: {
          x: clamp(midpoint.x + labelOffset.x, 72, 398),
          y: clamp(midpoint.y + labelOffset.y, 24, 286)
        },
        selectedSide,
        selectedRegionMember
      }
    ];
  })
);

const renderedRegions = computed(() =>
  visibleRegions.value.flatMap((region) => {
    const isProved = props.provedRegionIds.includes(region.id);
    const isSelected = props.selectedRegionId === region.id;
    if (!isProved && !isSelected) {
      return [];
    }

    const leftPoints = pathPoints(region.leftPath);
    const rightPoints = pathPoints(region.rightPath);
    const points = [...leftPoints, ...rightPoints];

    if (!points.length) {
      return [];
    }

    const center = centroid(points);
    const expandedLeftPoints = expandPoints(leftPoints, center, 14);
    const expandedRightPoints = expandPoints(rightPoints, center, 14);
    const labelPoint = center;

    return [
      {
        id: region.id,
        isProved,
        isSelected,
        outline: [...expandedLeftPoints, ...expandedRightPoints.slice().reverse()].map((point) => `${point.x},${point.y}`).join(" "),
        leftLine: expandedLeftPoints.map((point) => `${point.x},${point.y}`).join(" "),
        rightLine: expandedRightPoints.map((point) => `${point.x},${point.y}`).join(" "),
        labelX: labelPoint.x,
        labelY: labelPoint.y
      }
    ];
  })
);

function pathPoints(path: string[]): Array<{ x: number; y: number }> {
  if (path.length === 0) {
    return [];
  }

  const arrows = path
    .map((arrowId) => props.diagram?.arrows.find((candidate) => candidate.id === arrowId))
    .filter((arrow): arrow is NonNullable<typeof arrow> => !!arrow);
  if (!arrows.length) {
    return [];
  }

  const firstNode = nodeMap.value.get(arrows[0].from);
  if (!firstNode) {
    return [];
  }

  const points = [firstNode.position];
  for (const arrow of arrows) {
    const target = nodeMap.value.get(arrow.to);
    if (target) {
      points.push(target.position);
    }
  }
  return points;
}

function centroid(points: Array<{ x: number; y: number }>): { x: number; y: number } {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length
  };
}

function expandPoints(
  points: Array<{ x: number; y: number }>,
  center: { x: number; y: number },
  amount: number
): Array<{ x: number; y: number }> {
  return points.map((point) => expandPoint(point, center, amount));
}

function expandPoint(
  point: { x: number; y: number },
  center: { x: number; y: number },
  amount: number
): { x: number; y: number } {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const length = Math.max(Math.hypot(dx, dy), 1);

  return {
    x: point.x + (dx / length) * amount,
    y: point.y + (dy / length) * amount
  };
}

function labelOffsetForArrow(
  ux: number,
  uy: number,
  midpoint: { x: number; y: number }
): { x: number; y: number } {
  const normal = { x: -uy, y: ux };
  const amount = 15;

  if (Math.abs(uy) < 0.25) {
    return { x: 0, y: midpoint.y < canvasCenter.y ? -amount : amount };
  }

  if (Math.abs(ux) < 0.25) {
    return { x: midpoint.x < canvasCenter.x ? -amount : amount, y: 0 };
  }

  const direction = normal.y < 0 ? 1 : -1;
  return {
    x: normal.x * amount * direction,
    y: normal.y * amount * direction
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function beginPan(event: MouseEvent): void {
  if (event.button !== 0) {
    return;
  }

  isPanning.value = true;
  lastPointer.value = { x: event.clientX, y: event.clientY };
}

function movePan(event: MouseEvent): void {
  if (!isPanning.value) {
    return;
  }

  const dx = event.clientX - lastPointer.value.x;
  const dy = event.clientY - lastPointer.value.y;
  pan.value = { x: pan.value.x + dx, y: pan.value.y + dy };
  lastPointer.value = { x: event.clientX, y: event.clientY };
}

function endPan(): void {
  isPanning.value = false;
}

function resetView(): void {
  zoom.value = 1;
  pan.value = { x: 0, y: 0 };
}

function openAuxiliaryMenu(event: MouseEvent, kind: "arrow" | "node", id: string): void {
  contextMenu.value = { x: event.clientX, y: event.clientY, kind, id };
}

function closeContextMenu(): void {
  contextMenu.value = undefined;
}

function deleteContextMenuTarget(): void {
  if (!contextMenu.value) {
    return;
  }

  if (contextMenu.value.kind === "arrow") {
    emit("removeAuxiliaryArrow", contextMenu.value.id);
  } else {
    emit("removeAuxiliaryNode", contextMenu.value.id);
  }
  closeContextMenu();
}
</script>

<template>
  <section class="panel diagram-panel" @click="closeContextMenu">
    <div class="panel-header">
      <h2>Diagram</h2>
    </div>

    <div class="zoom-row">
      <button type="button" @click="zoom = Math.max(0.6, zoom - 0.1)">-</button>
      <input v-model.number="zoom" type="range" min="0.6" max="1.8" step="0.1" />
      <button type="button" @click="zoom = Math.min(1.8, zoom + 0.1)">+</button>
      <button type="button" @click="resetView">Reset</button>
    </div>

    <div v-if="diagram" class="diagram-canvas">
      <svg
        viewBox="0 0 470 310"
        role="img"
        aria-label="Current goal diagram"
        :class="{ panning: isPanning, 'auxiliary-mode': isAuxiliaryMode }"
        @mousedown="beginPan"
        @mousemove="movePan"
        @mouseup="endPan"
        @mouseleave="endPan"
      >
        <defs>
          <marker id="arrow-head" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <path d="M0,0 L0,6 L9,3 z" />
          </marker>
          <marker id="arrow-head-selected" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <path d="M0,0 L0,6 L9,3 z" />
          </marker>
          <marker id="arrow-head-left" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <path d="M0,0 L0,6 L9,3 z" />
          </marker>
          <marker id="arrow-head-right" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <path d="M0,0 L0,6 L9,3 z" />
          </marker>
          <marker id="arrow-head-region" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <path d="M0,0 L0,6 L9,3 z" />
          </marker>
        </defs>

        <g :transform="zoomTransform">
          <g
            v-for="region in renderedRegions"
            :key="region.id"
            class="diagram-region"
            :class="{ 'proved-region': region.isProved, 'selected-region': region.isSelected }"
          >
            <polygon class="region-fill" :points="region.outline" />
            <polyline class="region-edge" :points="region.leftLine" />
            <polyline class="region-edge" :points="region.rightLine" />
            <text :transform="`translate(${region.labelX} ${region.labelY}) scale(${inverseZoom})`">
              {{ region.isProved ? "OK" : "SELECTED" }}
            </text>
          </g>

          <g
            v-for="arrow in renderedArrows"
            :key="arrow.id"
            class="diagram-arrow"
            :class="{
              auxiliary: arrow.status === 'auxiliary',
              'selected-left': arrow.selectedSide === 'left',
              'selected-right': arrow.selectedSide === 'right',
              'selected-region-arrow': arrow.selectedRegionMember,
              'selected-auxiliary': selectedAuxiliaryArrowId === arrow.id
            }"
            role="button"
            tabindex="0"
            @click="$emit('selectArrow', arrow.id)"
            @contextmenu.prevent.stop="arrow.status === 'auxiliary' && openAuxiliaryMenu($event, 'arrow', arrow.id)"
            @keydown.enter="$emit('selectArrow', arrow.id)"
          >
            <line
              class="arrow-hitbox"
              :x1="arrow.start.x"
              :y1="arrow.start.y"
              :x2="arrow.end.x"
              :y2="arrow.end.y"
            />
            <line
              class="arrow-visible"
              :x1="arrow.start.x"
              :y1="arrow.start.y"
              :x2="arrow.end.x"
              :y2="arrow.end.y"
            />
            <foreignObject
              class="diagram-label-fo"
              :transform="`translate(${arrow.labelPosition.x} ${arrow.labelPosition.y}) scale(${inverseZoom})`"
              x="-52"
              y="-12"
              width="104"
              height="24"
            >
              <div class="diagram-math-label arrow-math-label">
                <span class="diagram-label-id">{{ arrow.id }}</span>
                <MathText :latex="latexTerm(arrow.term)" :fallback="arrow.label" />
              </div>
            </foreignObject>
          </g>

          <g
            v-for="node in diagram.nodes"
            :key="node.id"
            class="diagram-node"
            :class="{
              auxiliary: node.status === 'auxiliary',
              'selected-from': isAuxiliaryMode && auxiliaryFrom === node.id,
              'selected-to': isAuxiliaryMode && auxiliaryTo === node.id,
              'selected-auxiliary': selectedAuxiliaryNodeId === node.id
            }"
            :role="isAuxiliaryMode ? 'button' : undefined"
            :tabindex="isAuxiliaryMode ? 0 : undefined"
            @click.stop="isAuxiliaryMode && $emit('selectNode', node.id)"
            @contextmenu.prevent.stop="node.status === 'auxiliary' && openAuxiliaryMenu($event, 'node', node.id)"
            @keydown.enter="isAuxiliaryMode && $emit('selectNode', node.id)"
          >
            <circle class="node-hitbox" :cx="node.position.x" :cy="node.position.y" r="28" />
            <circle class="node-focus" :cx="node.position.x" :cy="node.position.y" r="23" />
            <foreignObject
              class="diagram-label-fo"
              :transform="`translate(${node.position.x} ${node.position.y + 5}) scale(${inverseZoom})`"
              x="-38"
              y="-13"
              width="76"
              height="26"
            >
              <div class="diagram-math-label node-math-label">
                <MathText :latex="latexObject(node.object)" :fallback="node.label" />
              </div>
            </foreignObject>
          </g>
        </g>
      </svg>
      <div
        v-if="contextMenu"
        class="diagram-context-menu"
        :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
        @click.stop
      >
        <strong>{{ contextMenu.kind }} {{ contextMenu.id }}</strong>
        <button type="button" @click="deleteContextMenuTarget">Delete</button>
      </div>
    </div>
    <p v-else class="muted">This proof target has no equation diagram. Split it into equation subgoals to view diagrams.</p>
  </section>
</template>
