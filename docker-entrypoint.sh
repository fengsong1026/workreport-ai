#!/bin/sh
set -e

# Ensure data directories exist
mkdir -p /app/data/db /app/data/reports

# Initialize / sync database schema
npx prisma db push --skip-generate

# Start Next.js production server
exec npm start -- -H 0.0.0.0
