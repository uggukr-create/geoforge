# Contributing to geoforge

Thanks for helping! Quick start:

1. Fork and clone, then `npm install`.
2. Make your change in `src/` and add or update tests in `tests/`.
3. Run `npm run typecheck && npm run build && npm test`. All three must pass.
4. Open a pull request describing the problem and the fix.

Guidelines:
- Keep tests offline: use the mock fetcher and HTML fixtures from `tests/fixtures.ts`.
- New AI bots go into `SEARCH_BOTS` or `TRAINING_BOTS` in `src/crawler/robots.ts` with a test.
- New scoring checks must include a `fix` message and keep each pillar at 20 points.
- Do not add paid or hosted API dependencies.
- Avoid em dashes and en dashes in code, docs and generated output.

Bug reports: include the URL (or a minimal HTML sample), the command you ran and the output.
