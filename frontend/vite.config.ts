import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite config tuned for performance + compatibility:
// - Splits vendor libs into cacheable chunks (react/router/socket/icons/print).
// - Targets es2018 so weak/older browsers get syntax they can run (no ESM-modern-only code).
// - No sourcemaps in production (smaller payload, faster parse).
export default defineConfig({
  plugins: [react()],
  build: {
    target: ['es2018', 'edge79', 'firefox72', 'chrome64', 'safari12'],
    sourcemap: false,
    cssCodeSplit: true,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/scheduler/')) return 'react-vendor';
          if (id.includes('node_modules/react-router')) return 'router';
          if (id.includes('node_modules/socket.io-client')) return 'socket';
          if (id.includes('node_modules/lucide-react')) return 'icons';
          if (id.includes('node_modules/xlsx')) return 'xlsx';
          if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('dompurify') || id.includes('canvg') || id.includes('svg2pdf')) return 'print-vendor';
          return 'vendor';
        },
      },
    },
  },
})