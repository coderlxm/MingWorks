import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vueSetupExtend from 'vite-plugin-vue-setup-extend';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [vue(), vueSetupExtend()],
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'https://feeds.xmcloud.buzz',
        changeOrigin: true,
      },
      '/media': {
        target: 'https://feeds.xmcloud.buzz',
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
});
