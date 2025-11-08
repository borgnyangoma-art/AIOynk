import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },

  build: {
    // Enable code splitting
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunk for React and React-DOM
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // UI library chunk
          'ui-vendor': [
            '@monaco-editor/react',
            'fabric',
            'grapesjs',
            'three',
            'video.js',
          ],
          // State management chunk
          'state-vendor': ['@reduxjs/toolkit', 'react-redux'],
          // Utility chunk
          'utils-vendor': ['axios', 'socket.io-client', 'react-markdown'],
        },
      },
    },

    // Optimize chunk size
    chunkSizeWarningLimit: 1000,

    // Generate source maps for production debugging
    sourcemap: false,

    // Minimize output
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },

  // Server configuration
  server: {
    port: 3000,
    open: true,
    cors: true,
  },

  // Preview server
  preview: {
    port: 3000,
  },

  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@reduxjs/toolkit',
      'react-redux',
      'axios',
    ],
  },

  // Define global constants
  define: {
    __DEV__: JSON.stringify(false),
    __VERSION__: JSON.stringify(process.env.npm_package_version),
  },
})
