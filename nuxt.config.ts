// https://nuxt.com/docs/api/configuration/nuxt-config
import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";
import nodePolyfills from "rollup-plugin-polyfill-node";
export default defineNuxtConfig({
  modules: ["@pinia/nuxt", "@pinia-plugin-persistedstate/nuxt"],
  vite: {
    esbuild: {
      target: "esnext",
    },
    build: {
      target: "esnext",
    },
    plugins: [
      NodeGlobalsPolyfillPlugin({
        buffer: true,
        process: true,
      }),
      nodePolyfills({
        include: ["stream"],
      }),
    ],
    resolve: {
      alias: {
        stream: "stream-browserify",
      },
    },
    optimizeDeps: {
      include: ["@project-serum/anchor", "@solana/web3.js", "buffer"],
      esbuildOptions: {
        target: "esnext",
        define: {
          global: "globalThis",
        },
        plugins: [],
      },
    },
    define: {
      "process.env.BROWSER": true,
    },
  },
  pinia: {
    storesDirs: ["./stores/**"],
  },
  devtools: {
    enabled: true,

    timeline: {
      enabled: true,
    },
  },
  css: ["~/assets/css/main.css"],
  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  },
});
