import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 백엔드 CORS 기본 허용 출처가 http://localhost:5173 이라 포트를 고정한다
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
});
