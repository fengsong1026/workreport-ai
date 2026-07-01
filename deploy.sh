#!/bin/bash
set -e

REGISTRY="crpi-sg3816vcnxzdwweb.cn-hangzhou.personal.cr.aliyuncs.com/myworkreport/workreport-ai"
TAG="${1:-latest}"
IMAGE="${REGISTRY}:${TAG}"

echo "==> Deploying: ${IMAGE}"

# Pull latest image
echo "==> Pulling image..."
docker pull "${IMAGE}"

# Find and update the image line in docker-compose.yml to match the target tag
if [ "${TAG}" != "latest" ]; then
  echo "==> Pinning docker-compose.yml to tag: ${TAG}"
  sed -i '' "s|image: ${REGISTRY}:.*|image: ${IMAGE}|" docker-compose.yml 2>/dev/null || \
  sed -i "s|image: ${REGISTRY}:.*|image: ${IMAGE}|" docker-compose.yml
fi

# Restart service
echo "==> Restarting service..."
docker compose up -d

# Wait for health check
echo "==> Waiting for service to be healthy..."
for i in $(seq 1 30); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8088/api/health 2>/dev/null || echo "000")
  if [ "${STATUS}" = "200" ]; then
    echo "==> Health check passed (HTTP ${STATUS})"
    break
  fi
  echo "    Attempt ${i}/30: HTTP ${STATUS}, retrying..."
  sleep 2
done

if [ "${STATUS}" != "200" ]; then
  echo "!!> Health check failed after 30 attempts"
  exit 1
fi

# Remove old unused images
echo "==> Cleaning up old images..."
docker image prune -f

echo "==> Done: ${IMAGE}"
