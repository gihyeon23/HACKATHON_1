import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  return {
    plugins: [react()],
    // VITE_API_BASE_URL 이 비어 있을 때만 쓰는 개발용 프록시 (/api → 백엔드)
    server: { port: 5173, proxy: env.VITE_API_PROXY_TARGET ? { "/api": env.VITE_API_PROXY_TARGET } : undefined },
  };
});
