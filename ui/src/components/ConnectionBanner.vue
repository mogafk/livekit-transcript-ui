<script setup lang="ts">
import type { ConnectionState } from '../api/stream'

defineProps<{ state: ConnectionState }>()
</script>

<template>
  <div v-if="state === 'reconnecting'" class="banner" role="status">
    Нет связи с сервером — переподключаюсь…
  </div>
</template>

<style scoped>
.banner {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 8px 16px;
  text-align: center;
  font-size: 14px;
  color: var(--warn);
  background: var(--warn-bg);
}
</style>
