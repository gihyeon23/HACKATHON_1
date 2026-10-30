# ─── 1단계: 빌드 ───────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# 의존성 먼저 설치해 캐시 레이어로 분리 (소스만 바뀌면 재사용)
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# API 주소를 비워 두면 같은 주소의 /api 를 부른다 → nginx 가 backend 로 넘김 (CORS 불필요)
ENV VITE_API_BASE_URL=
RUN npm run build

# ─── 2단계: 실행 ───────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
