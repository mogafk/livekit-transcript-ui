<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import ConnectionBanner from '../components/ConnectionBanner.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { formatDateTime, formatTime } from '../format'
import { useSessionsStore } from '../stores/sessions'

const store = useSessionsStore()

onMounted(() => {
  document.title = 'Транскрипты'
  store.open()
})
onUnmounted(() => store.close())
</script>

<template>
  <ConnectionBanner :state="store.connection" />
  <main class="page">
    <h1>Сессии</h1>
    <p v-if="store.loaded && store.sorted.length === 0" class="empty">
      Сессий пока нет. Они появятся, когда транскрибатор пришлёт первые события.
    </p>
    <ul class="list">
      <li v-for="s in store.sorted" :key="s.id">
        <RouterLink :to="`/sessions/${s.id}`" class="card">
          <div class="row">
            <span class="name" :title="s.name">{{ s.name }}</span>
            <StatusBadge :status="s.status" />
          </div>
          <div class="meta">
            <span>начало {{ formatDateTime(s.startedAt) }}</span>
            <span>последнее событие {{ formatTime(s.lastEventAt) }}</span>
            <span>спикеров {{ s.speakerCount }}</span>
            <span>реплик {{ s.segmentCount }}</span>
          </div>
        </RouterLink>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}
.card {
  display: block;
  padding: 12px 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: inherit;
  text-decoration: none;
}
.card:hover {
  border-color: var(--accent);
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin-top: 6px;
  font-size: 13px;
  color: var(--text-muted);
}
.empty {
  color: var(--text-muted);
}
</style>
