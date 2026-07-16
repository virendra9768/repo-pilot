# RepoPilot container — for a long-running host (Oracle Always Free VM, etc.).
# node:22 (Debian bookworm) includes the `git` binary that simple-git needs to
# clone repos at runtime.
FROM node:22

WORKDIR /app

# Install dependencies first (better layer caching). --include=dev so the build
# tools (typescript, tailwind, postcss) are available even under NODE_ENV=production.
COPY package.json package-lock.json ./
RUN npm install --include=dev

# Copy the rest (demo-repos/ and cache-seed/ are included — they ship in the image)
# and build.
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# OPENROUTER_API_KEY is provided at `docker run` time, not baked into the image.
CMD ["npm", "start"]
