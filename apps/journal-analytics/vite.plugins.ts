import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

export function analyticsPlugins() {
  return [react(), tailwindcss()];
}
