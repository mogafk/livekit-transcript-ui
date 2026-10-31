<script setup lang="ts">
import type { Segment } from '@transcript-ui/shared'
import { formatTime, speakerHue } from '../format'

defineProps<{ segment: Segment }>()
</script>

<template>
  <li class="line" :class="{ interim: !segment.isFinal }">
    <time class="time" :datetime="segment.start">{{ formatTime(segment.start) }}</time>
    <span class="speaker" :style="{ '--hue': speakerHue(segment.speakerId) }">
      {{ segment.speakerName }}
    </span>
    <p class="text">{{ segment.text }}</p>
  </li>
</template>

<style scoped>
.line {
  display: grid;
  grid-template-columns: 72px 140px 1fr;
  gap: 4px 12px;
  padding: 8px 0;
  align-items: baseline;
}
.time {
  font-size: 13px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.speaker {
  font-weight: 600;
  color: hsl(var(--hue) 60% var(--speaker-l));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.text {
  margin: 0;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.interim .text {
  color: var(--text-muted);
  font-style: italic;
}
.interim .text::after {
  content: ' …';
}
@media (max-width: 600px) {
  .line {
    grid-template-columns: auto 1fr;
  }
  .text {
    grid-column: 1 / -1;
  }
}
</style>
