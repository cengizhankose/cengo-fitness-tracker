# Build stage
FROM node:22-alpine AS build
WORKDIR /app
# Vite build-time env (Out Plane env group passes these as build args)
ARG VITE_CONVEX_URL
ARG VITE_SYNC_SECRET
ENV VITE_CONVEX_URL=$VITE_CONVEX_URL \
    VITE_SYNC_SECRET=$VITE_SYNC_SECRET
COPY package.json ./
RUN npm install --no-audit --no-fund --legacy-peer-deps
COPY . .
RUN npm run build

# Serve stage
FROM node:22-alpine
WORKDIR /app
RUN npm install -g serve@14
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000", "--no-clipboard"]
