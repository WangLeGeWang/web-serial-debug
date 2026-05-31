import { createRouter, createWebHistory } from 'vue-router'
import WorkbenchPage from '../pages/WorkbenchPage.vue'
import HelpPage from '../pages/HelpPage.vue'
import CanvasPage from '../pages/CanvasPage.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'workbench',
      component: WorkbenchPage
    },
    {
      path: '/help',
      name: 'help',
      component: HelpPage
    },
    {
      path: '/canvas/:id',
      name: 'canvas',
      component: CanvasPage
    }
  ]
})

router.beforeEach((to) => {
  if (to.name === 'workbench' && to.query.help === '1') {
    return { name: 'help' }
  }
})

export default router
