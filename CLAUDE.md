@AGENTS.md

## Project conventions

- **Model**: default to Sonnet 5.5 for development work.
- **UI**: use the shadcn/ui design system already in the repo (`components/`, `components.json`, `design-system/`). Reuse existing components and tokens before adding new ones. See `PRODUCT.md` and `DECISIONS.md` for product and design decisions.
- **Package manager**: pnpm.
- **Versioning**: SemVer, currently pre-1.0. Record every user-visible change under `## [Unreleased]` in `CHANGELOG.md` (Keep a Changelog format). To release, move those entries under a new version heading with a date, bump `version` in `package.json` to match, commit, and tag `vX.Y.Z`.
- **Public repo, nothing private**: never commit secrets, tokens, `.env` files, databases, GPX/FIT/CSV/XLSX data, photos, real names, home addresses, hostnames or LAN IPs. Put personal strings in `local/private-patterns.txt` (gitignored). Use the GitHub noreply identity for commits.
- **Before every push**: run `scripts/check-public-safe.sh` and only push if it passes.
- **Deploy**: with Docker Compose on the dev VM (`docker compose up -d --build`). Persistent data lives in `data/` and is never committed.
- **Docs**: integration docs live in `docs/`; keep them in step with behavior changes.
