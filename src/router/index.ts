import { createRouter, createWebHistory } from 'vue-router'
import WorkbenchPage from '../pages/WorkbenchPage.vue'
import HelpPage from '../pages/HelpPage.vue'

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
    }
  ]
})

router.beforeEach((to) => {
  if (to.name === 'workbench' && to.query.help === '1') {
    return { name: 'help' }
  }
})

export default router
