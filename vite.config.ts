import { defineConfig } from 'vite';

/**
 * GitHub Pages serves project sites at https://<owner>.github.io/<repo>/.
 * In GitHub Actions, GITHUB_REPOSITORY ("owner/repo") gives the repo name, so the
 * base path follows the repository automatically (a "<owner>.github.io" user-site
 * repo is served at the root). Local dev and builds use "/".
 */
function pagesBase(): string {
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
  if (!process.env.GITHUB_ACTIONS || !repo || repo.endsWith('.github.io')) return '/';
  return `/${repo}/`;
}

export default defineConfig({
  base: pagesBase(),
  server: { port: 5173, host: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
});
