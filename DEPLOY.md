# Deploying to GitHub Pages

Every push to `main` runs `.github/workflows/deploy.yml`: it installs dependencies with `npm ci`, runs `npm run build`, and publishes `dist/` to GitHub Pages. You can also run it manually from the **Actions** tab ("Deploy to GitHub Pages" → **Run workflow**).

The Vite base path is set automatically from the repository name during the GitHub build (see `vite.config.ts`), so renaming the repository needs no code change.

## One-time setting

In the repository on GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Without this, the deploy step fails.

## Published URL

- After a successful run, the URL is shown in **Settings → Pages**, and on the run's `deploy` job in the **Actions** tab.
- It has the form `https://<owner>.github.io/<repository>/`.

If your default branch is not `main`, change `branches: [main]` in the workflow.
