<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import ConnectionBanner from '../components/ConnectionBanner.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { parseExport } from '../export-file'
import { formatDateTime, formatTime } from '../format'
import { useSessionsStore } from '../stores/sessions'
import { useTranscriptStore } from '../stores/transcript'

const store = useSessionsStore()
const transcript = useTranscriptStore()
const router = useRouter()

const fileInput = ref<HTMLInputElement>()
const fileError = ref('')

async function openFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // the same file can be chosen again
  if (!file) return
  try {
    transcript.openFile(parseExport(await file.text()), file.name)
    fileError.value = ''
    await router.push('/file')
  } catch (e) {
    fileError.value = `${file.name}: ${(e as Error).message}`
  }
}

onMounted(() => {
  document.title = 'Транскрипты'
  store.open()
})
onUnmounted(() => store.close())
</script>

<template>
  <ConnectionBanner :state="store.connection" />
  <main class="page">
    <div class="heading">
      <h1>Сессии</h1>
      <button class="btn" type="button" @click="fileInput?.click()">Открыть JSON</button>
      <input
        ref="fileInput"
        type="file"
        accept=".json,application/json"
        hidden
        @change="openFile"
      />
    </div>
    <p v-if="fileError" class="error" role="alert">{{ fileError }}</p>
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
.heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.heading h1 {
  margin: 0;
}
.error {
  color: var(--warn);
}
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
