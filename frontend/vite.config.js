import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

export default defineConfig({
  plugins: [
    wasm(),
    topLevelAwait(),
    react(),
    tailwindcss(),
  ],

  optimizeDeps: {
    // Exclude cofhejs from pre-bundling (WASM must load natively)
    // but force-include tweetnacl so Vite converts it from CJS → ESM
    exclude: ["cofhejs"],
    include: [
      "tweetnacl",
      "ethers-v5 > ethers",
    ],
  },

  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
    fs: {
      allow: [".."],
    },
  },

  build: {
    target: "esnext",
    rollupOptions: {
      external: [],
    },
    commonjsOptions: {
      // Force tweetnacl CJS to be transformed for ESM compatibility
      include: [/tweetnacl/],
      transformMixedEsModules: true,
    },
  },
})