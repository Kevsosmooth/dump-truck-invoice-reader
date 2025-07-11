#!/bin/bash

# Exit on error
set -e

echo "==> Installing server dependencies..."
cd server
npm install

echo "==> Generating Prisma client..."
npx prisma generate

echo "==> Running database migrations..."
npx prisma migrate deploy

echo "==> Build completed successfully!"