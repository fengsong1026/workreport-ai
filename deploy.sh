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

# Remove old unused images
echo "==> Cleaning up old images..."
docker image prune -f

echo "==> Done: ${IMAGE}"
