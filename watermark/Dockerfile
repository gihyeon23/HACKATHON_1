# 워터마크 엔진 (stateless REST API, :8000). docker-compose 의 watermark 서비스.
FROM python:3.12-slim

WORKDIR /app

# 컨테이너에는 화면이 없으므로 opencv-python 대신 headless 판을 쓴다 (libGL 불필요).
# pytest 는 실행에 필요 없어 뺀다
COPY requirements.txt .
RUN grep -vE '^(opencv-python|pytest)$' requirements.txt > requirements.docker.txt \
    && pip install --no-cache-dir -r requirements.docker.txt opencv-python-headless

COPY watermark watermark
COPY server.py .

# 보안: non-root 실행. matplotlib 캐시 위치를 쓰기 가능한 곳으로
RUN useradd -r -u 10001 engine
USER engine
ENV HOST=0.0.0.0 PORT=8000 MPLCONFIGDIR=/tmp/matplotlib PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["python", "server.py"]
