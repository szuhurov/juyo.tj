# JUYO visual-search bench (developer only)

Reproducible model benchmark, ranking fit and one-time backfill for
"search by photo". Everything runs on the developer's computer with ONNX
Runtime Web (WASM) — the same runtime the browser uses. No photo or vector is
sent to any AI service; the only network use is downloading pinned model
files (`fetch-models.ts`, SHA-256 checked) and, for the backfill, JUYO's own
published photos.

Not part of the website: excluded from `tsconfig.json`, own `package.json`.

```bash
cd Web/tools/visual-bench && npm install
node fetch-models.ts models                         # candidates, checksum-pinned
node bench.ts <dataset> models [model-id ...]       # → out/results.json, out/emb-*.json, out/phash.json
node fit-ranking.ts <dataset> <model-id>            # → out/ranking-<id>.json (weights, thresholds)
node parity.ts <dataset> models <model-id>          # decoder sensitivity (libjpeg-turbo vs pure JS)
node backfill.ts images.json models > out/backfill.sql
```

`<dataset>` = `list.json` (`[{ id, category }]`) + `img/<i>.jpg`: published
listing photos (the 2026-10-04 set of 99 photos is the baseline). Results and
the decision are in [RESULTS.md](RESULTS.md).
