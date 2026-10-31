<script setup lang="ts">
import type { SessionStatus } from '@transcript-ui/shared'
import { statusLabel } from '../format'

defineProps<{ status: SessionStatus }>()
</script>

<template>
  <span class="badge" :class="status">{{ statusLabel[status] }}</span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  white-space: nowrap;
  background: var(--surface-2);
  color: var(--text-muted);
}
.badge::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.live {
  color: var(--live);
  background: var(--live-bg);
}
.live::before {
  animation: pulse 1.6s ease-in-out infinite;
}
.idle {
  color: var(--warn);
  background: var(--warn-bg);
}
@keyframes pulse {
  50% {
    opacity: 0.3;
  }
}
</style>
