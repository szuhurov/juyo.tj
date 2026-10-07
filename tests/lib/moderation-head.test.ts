import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { VISUAL_MODEL } from '@/lib/visual-model';

// The weapons head is versioned: the JSON in tools/moderation-bench is the
// source, the migration installs exactly it, and the database records its hash.
const ROOT = path.join(__dirname, '..', '..');
const ID = 'weapons-dinov2-s14-q4-lr-v1';
const raw = readFileSync(path.join(ROOT, 'tools', 'moderation-bench', `head-${ID}.json`), 'utf8');
const head = JSON.parse(raw);
const sql = readFileSync(path.join(ROOT, 'supabase', 'migrations', '20261007010001_image_moderation_model_v1.sql'), 'utf8');

describe('weapons moderation head v1', () => {
  it('belongs to the visual-search model the devices run', () => {
    expect(head.visual_model_id).toBe(VISUAL_MODEL.id);
    expect(head.visual_model_sha256).toBe(VISUAL_MODEL.sha256);
  });

  it('has one 384-d head per category with sane thresholds (review < block < 1)', () => {
    for (const c of ['firearm', 'blade']) {
      const h = head.categories[c];
      expect(h.weights).toHaveLength(VISUAL_MODEL.dim);
      expect(h.weights.every((x: number) => Number.isFinite(x))).toBe(true);
      expect(h.t_review).toBeGreaterThan(0);
      expect(h.t_block === null || (h.t_block > h.t_review && h.t_block < 1)).toBe(true);
    }
  });

  it('the migration installs exactly this file (hash + every weight)', () => {
    const sha = createHash('sha256').update(raw).digest('hex');
    expect(sql).toContain(`'${sha}'`);
    for (const c of ['firearm', 'blade']) {
      const h = head.categories[c];
      expect(sql).toContain(`('${ID}', '${c}', '[${h.weights.join(',')}]', ${h.bias}, ${h.t_review}, ${h.t_block ?? 'null'})`);
    }
  });
});
