<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import ConnectionBanner from '../components/ConnectionBanner.vue'
import StatusBadge from '../components/StatusBadge.vue'
import TranscriptLine from '../components/TranscriptLine.vue'
import { formatDateTime, speakerHue } from '../format'
import { useTranscriptStore } from '../stores/transcript'

const props = defineProps<{ id: string }>()
const store = useTranscriptStore()

// Follow new lines while the user is at the bottom; scrolling up stops following.
const STICK_PX = 48
const following = ref(true)

const atBottom = () =>
  window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - STICK_PX

const onScroll = () => (following.value = atBottom())

function scrollToEnd(behavior: ScrollBehavior = 'auto') {
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior })
}

watch(
  () => store.sortedSegments,
  async () => {
    if (!following.value) return
    await nextTick()
    scrollToEnd()
  },
)

watch(
  () => props.id,
  (id) => {
    following.value = true
    store.open(id)
  },
  { immediate: true },
)

watch(
  () => store.session?.name,
  (name) => (document.title = name ? `${name} — транскрипт` : 'Транскрипт'),
)

onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  store.close()
})
</script>

<template>
  <ConnectionBanner :state="store.connection" />
  <main class="page">
    <RouterLink to="/" class="back">← Все сессии</RouterLink>

    <template v-if="store.session">
      <header class="header">
        <div class="title">
          <h1 :title="store.session.name">{{ store.session.name }}</h1>
          <StatusBadge :status="store.session.status" />
        </div>
        <p class="meta">начало {{ formatDateTime(store.session.startedAt) }}</p>
        <ul class="speakers">
          <li
            v-for="s in store.speakerList"
            :key="s.id"
            :class="{ left: !s.present }"
            :style="{ '--hue': speakerHue(s.id) }"
            :title="s.present ? 'в комнате' : 'вышел'"
          >
            {{ s.name }}
          </li>
        </ul>
      </header>

      <ol v-if="store.sortedSegments.length" class="transcript">
        <TranscriptLine v-for="seg in store.sortedSegments" :key="seg.id" :segment="seg" />
      </ol>
      <p v-else class="empty">Реплик пока нет.</p>
    </template>

    <p v-else-if="store.connection === 'reconnecting'" class="empty">
      Сессия не найдена. Если сервер перезапускался, она появится снова со следующими событиями
      транскрибатора.
    </p>
    <p v-else class="empty">Загрузка…</p>

    <button
      v-if="!following && store.sortedSegments.length"
      class="to-end"
      type="button"
      @click="scrollToEnd('smooth')"
    >
      ↓ К последним репликам
    </button>
  </main>
</template>

<style scoped>
.back {
  display: inline-block;
  margin-bottom: 12px;
  font-size: 14px;
}
.header {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 8px 0 12px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}
.title {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.title h1 {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.meta {
  margin: 4px 0 8px;
  font-size: 13px;
  color: var(--text-muted);
}
.speakers {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.speakers li {
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--hue) 60% var(--speaker-l));
  background: var(--surface-2);
}
.speakers li.left {
  opacity: 0.5;
  text-decoration: line-through;
}
.transcript {
  list-style: none;
  margin: 0;
  padding: 8px 0 72px;
}
.empty {
  color: var(--text-muted);
}
.to-end {
  position: fixed;
  right: 16px;
  bottom: 16px;
  padding: 8px 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.15);
}
</style>
