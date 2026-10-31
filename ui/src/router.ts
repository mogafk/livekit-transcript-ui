import { createRouter, createWebHistory } from 'vue-router'
import SessionList from './views/SessionList.vue'
import SessionView from './views/SessionView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: SessionList },
    { path: '/sessions/:id', component: SessionView, props: true },
  ],
})
