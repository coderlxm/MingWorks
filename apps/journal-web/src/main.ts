import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import './assets/main.css';
import './assets/journal-prose.css';
import 'element-plus/es/components/dropdown/style/css';
import 'element-plus/es/components/loading/style/css';
import 'element-plus/es/components/message/style/css';

const app = createApp(App);

app.use(createPinia());
app.use(router);

void router.isReady().then(() => {
  app.mount('#app');
});
