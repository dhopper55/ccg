import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import checker from "vite-plugin-checker";
import tsconfigPaths from "vite-tsconfig-paths";

export default ({ command, mode }) => {
  process.env = { ...process.env, ...loadEnv(mode, process.cwd()) };

  const base = process.env.VITE_BASENAME || "/";
  const outDir = process.env.VITE_OUT_DIR || "dist";
  const isDevServer = command === "serve";

  return defineConfig({
    build: {
      outDir,
      emptyOutDir: true,
    },
    plugins: [
      tsconfigPaths(),
      react(),
      ...(isDevServer
        ? [
            checker({
              typescript: true,
              eslint: {
                useFlatConfig: true,
                lintCommand: 'eslint "./src/**/*.{ts,tsx}"',
              },
              overlay: {
                initialIsOpen: false,
              },
            }),
          ]
        : []),
    ],
    preview: {
      port: Number(process.env.VITE_APP_PORT || 5001),
    },
    server: {
      host: "0.0.0.0",
      port: Number(process.env.VITE_APP_PORT || 5001),
    },
    base,
  });
};
