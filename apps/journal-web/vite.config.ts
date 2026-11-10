import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vueSetupExtend from 'vite-plugin-vue-setup-extend';
import { analyticsPlugins } from '../journal-analytics/vite.plugins.ts';

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), 'JOURNAL_');
  const apiTarget = environment.JOURNAL_API_TARGET ?? 'https://feeds.xmcloud.buzz';
  return {
    root: fileURLToPath(new URL('.', import.meta.url)),
    plugins: [
      vue(),
      vueSetupExtend(),
      ...analyticsPlugins(),
      {
        name: 'journal-analytics-entry',
        configureServer(server) {
          server.middlewares.use((request, _response, next) => {
            const pathname = request.url?.split('?')[0];
            if (pathname === '/analytics' || pathname === '/analytics/') {
              request.url = '/analytics.html';
            }
            next();
          });
        },
      },
    ],
    server: {
      host: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/media': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      rolldownOptions: {
        input: {
          main: fileURLToPath(new URL('index.html', import.meta.url)),
          contribute: fileURLToPath(new URL('contribute.html', import.meta.url)),
          analytics: fileURLToPath(new URL('analytics.html', import.meta.url)),
        },
        output: {
          codeSplitting: {
            // Keep shared deps such as Vue out of the lazy rich-text vendor chunks.
            includeDependenciesRecursively: false,
            groups: [
              { name: 'vendor-prosemirror', test: /[\\/]node_modules[\\/](?:prosemirror-|orderedmap|rope-sequence|w3c-keyname)/ },
              { name: 'vendor-tiptap', test: /[\\/]node_modules[\\/](?:@tiptap|linkifyjs|uuid)[\\/]/ },
              { name: 'vendor-highlight', test: /[\\/]node_modules[\\/](?:lowlight|highlight\.js)[\\/]/ },
            ],
          },
        },
      },
    },
  };
});
