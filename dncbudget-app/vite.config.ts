import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd()) };

  const base = env.VITE_BASENAME || "/";
  const outDir = env.VITE_OUT_DIR || "dist";

  return {
    base,
    build: {
      outDir,
      emptyOutDir: true,
    },
    plugins: [tsconfigPaths(), react()],
    server: {
      host: "0.0.0.0",
      port: Number(env.VITE_APP_PORT || 5002),
    },
    preview: {
      port: Number(env.VITE_APP_PORT || 5002),
    },
  };
});
