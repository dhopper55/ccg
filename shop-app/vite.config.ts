import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default ({ mode }: { mode: string }) => {
  process.env = { ...process.env, ...loadEnv(mode, process.cwd()) };

  const base = process.env.VITE_BASENAME || "/";
  const outDir = process.env.VITE_OUT_DIR || "dist";

  return defineConfig({
    build: {
      outDir,
      emptyOutDir: true,
    },
    plugins: [
      tsconfigPaths(),
      react(),
    ],
    preview: {
      port: Number(process.env.VITE_APP_PORT || 5002),
    },
    server: {
      host: "0.0.0.0",
      port: Number(process.env.VITE_APP_PORT || 5002),
    },
    base,
  });
};
