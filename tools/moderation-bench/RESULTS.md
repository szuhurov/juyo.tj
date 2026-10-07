# JUYO weapons moderation — benchmark and decision (2026-10-07)

## Question

Owner rule: first try a tiny JUYO classifier on the DINOv2 vector the phone
and browser already compute for visual search (option C, ≈0 MB extra), and
compare it with SigLIP zero-shot (option A, would add 99.5 MB to the app).
A new model (B) only if both fail. Licences Apache-2.0/MIT only. Nothing leaves
the device; the database scores the vector.

## Data (Open Images V7 validation + test, CC BY 2.0 images, CC BY 4.0 labels)

- Only images with **no person-related human-verified label** (owner rule: never
  images of minors). Labels are not exhaustive, so this lowers the risk; it is
  not a guarantee. Images stay on the developer computer (not committed).
- 3 705 images: 207 firearm, 501 blade (knife, dagger, sword…), 3 000 safe, of
  which 2 521 are "hard" (tools, heat/rivet guns, phones, toys, scissors,
  forks/spoons, food, wallets, bags, keys…). Split by hash of the image id:
  train 2 158 / val 772 / test 775 (test: 50 firearm, 110 blade, 615 safe).
- Plus JUYO's own 99 published listing photos as an in-domain "safe" check.
- Not covered: nudity, gore (no permissive dataset without risk of minors — the
  admin checks these by eye).

## Results on `test` (nothing was fitted on it)

Thresholds are chosen on `val`: REVIEW = keep ≥ 98 % recall; BLOCK = lowest
score above every val negative with precision ≥ 99 %.

| Model | Extra on device | AUROC firearm | AUROC blade | Firearm REVIEW P / R / F1 / FPR / FNR | Blade REVIEW P / R / F1 / FPR / FNR | BLOCK firearm TP / FP | BLOCK blade TP / FP | Safe photos sent to REVIEW | JUYO photos flagged |
|---|---|---|---|---|---|---|---|---|---|
| **C-lr** (logistic, DINOv2) | 2 × 384 floats | **0.997** | 0.978 | 0.86 / 0.98 / 0.92 / 1.3 % / 2.0 % | 0.57 / 0.96 / 0.72 / 13.0 % / 3.6 % | 44 / 1* | 61 / 0 | 86 / 615 (14 %) | 4 / 99, 0 blocked |
| C-mlp (384→32→1, DINOv2) | ~12 k floats | 0.995 | 0.975 | 0.86 / 0.96 / 0.91 / 1.3 % / 4.0 % | 0.55 / 0.95 / 0.70 / 13.7 % / 5.5 % | 42 / 2 | 55 / 0 | 89 / 615 | 3 / 99 |
| A-zs (SigLIP zero-shot) | +99.5 MB + text vectors | 0.992 | 0.959 | 0.36 / 0.98 / 0.53 / 14.1 % / 2.0 % | 0.25 / 0.98 / 0.40 / 51.4 % / 1.8 % | 44 / 4 | 43 / 0 | 357 / 615 (58 %) | 11 / 99 |
| A-lr (logistic, SigLIP) | +99.5 MB | 0.991 | 0.987 | 0.87 / 0.96 / 0.91 / 1.1 % / 4.0 % | 0.62 / 0.95 / 0.75 / 10.4 % / 4.5 % | 42 / 3 | 58 / 0 | 69 / 615 | 1 / 99 |

\* Checked by eye: the one "safe" image above the firearm BLOCK threshold
(`c66d7da537bcc29c`, labelled only "Bag") is a rifle in a gun bag — a label
error in Open Images. Corrected, BLOCK firearm is 45 / 45 on test (95 % Wilson
lower bound ≈ 0.92 — 45 positives cannot prove 99 %).

Final decisions of C-lr on test (160 weapons, 615 safe):

|  | SAFE | REVIEW | BLOCK |
|---|---|---|---|
| weapon (firearm or blade) | **5** (3.1 %) | 49 | 106 |
| safe | 529 | 85 | 1 (the mislabelled rifle) |

Missed weapons (SAFE): a rifle barely visible in a car corner, and four knives
small in the frame or among food. Safe photos sent to REVIEW are mostly forks,
spoons, food, bottles, clothing (metal/elongated shapes) — they only go to the
normal admin queue. JUYO photos flagged: keys (blade 0.63), an umbrella (0.65),
a wallet and a document — all REVIEW, none blocked.

Latency: the head itself is a dot product (0.002 ms). The vector is the one
visual search already makes (DINOv2 q4, measured here in Node/WASM 8 threads:
623 ms median, load 1.6 s; on phones see visual-bench). SigLIP would add 476 ms
per photo and 99.5 MB.

## Decision

**C-lr** — logistic regression on the existing DINOv2 vector:
best firearm AUROC, far fewer false REVIEWs than zero-shot, no extra download,
no new library, and the score is computed in the database (a modified client
cannot send a "safe" score). SigLIP adds 99.5 MB without a clear gain (A-lr is
slightly better on blades, slightly worse on firearms). B is not needed for
weapons.

Policy `weapons-v1` (file `head-weapons-dinov2-s14-q4-lr-v1.json`, SHA-256 in
the migration):

| Category | REVIEW from p ≥ | BLOCK from p ≥ |
|---|---|---|
| firearm | 0.3079 | 0.7505 |
| blade (knives count like firearms, owner) | 0.2169 | 0.9751 |

## Honest limits

- Open Images photos are not JUYO photos; real listings (phone photos, covered
  areas from the privacy pipeline, Tajik context) can behave differently.
  Re-measure on real JUYO data once there are flagged listings.
- 50 firearm / 110 blade test positives: the precision of BLOCK is estimated,
  not proven, at 99 %. The admin can undo every BLOCK.
- 3 % of weapons on test land in SAFE — they are still seen by the admin in the
  "safe" list before publication (nothing is published without the admin).
- No nudity / gore model.

## Reproduce

```bash
cd Web/tools/moderation-bench
node fetch-data.ts <data-dir>                    # needs <data-dir>/meta (README)
node embed.ts <data-dir> out/emb-open.json
node embed.ts <juyo-99-dir> out/emb-juyo.json
node evaluate.ts <data-dir> out/emb-open.json out/emb-juyo.json <models-dir>
node export-head.ts out/results.json weapons-dinov2-s14-q4-lr-v1 weapons-v1 > out/model.sql
```

Every model or policy update must rerun `evaluate.ts` and must not lower
recall at the REVIEW threshold; a new head is a new id and a new migration.
