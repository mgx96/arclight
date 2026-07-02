# Arclight backend — proof-of-view attestor + Circle Gateway nanopayment agent.
# Runs the TypeScript server directly via tsx (no separate build step). Testnet secrets are
# injected at runtime as environment variables by the host (Render/Railway/Fly), never baked in.
FROM node:24-slim

# pnpm via corepack (version pinned to the one used locally).
ENV PNPM_HOME=/usr/local/bin
RUN corepack enable && corepack prepare pnpm@11.0.0 --activate

WORKDIR /app

# Install dependencies first for better layer caching. tsx/typescript are devDependencies and are
# required at runtime here (we execute .ts directly), so install the full dependency set.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# --ignore-scripts: the only package with a build script is esbuild (a transitive dep), and tsx
# ships its own copy, so its native build is unused here. Skipping scripts also avoids pnpm 11's
# ERR_PNPM_IGNORED_BUILDS, which otherwise exits 1 and fails the image build.
RUN pnpm install --frozen-lockfile --ignore-scripts

# Application source.
COPY tsconfig.json ./
COPY src ./src

# The service listens on $PORT (defaults to 8787). Hosts set PORT via env; expose the default.
ENV PORT=8787
EXPOSE 8787

CMD ["pnpm", "start"]
