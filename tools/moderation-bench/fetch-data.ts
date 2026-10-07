// Builds the JUYO weapons benchmark from Open Images V7 (validation + test).
//
//   node fetch-data.ts <data-dir>
//
// <data-dir>/meta must hold the official Open Images files (downloaded by
// hand, see README): class-descriptions.csv, {validation,test}-labels.csv
// (human-verified image labels, CC BY 4.0) and {validation,test}-images.csv
// (per-image licence, author, URLs). Every image is listed as CC BY 2.0.
//
// Owner rule: never images of minors. Any image with ANY person-related
// human-verified label is dropped — not only child labels. Open Images labels
// are not exhaustive, so this lowers the risk; it is not a guarantee.
//
// Output: <data-dir>/list.json ([{ id, label, split, tags, license, author, page }])
// and <data-dir>/img/<id>.jpg (longest side ≤ 640, re-encoded, no metadata).
// Images stay on this computer: never committed, never shipped.
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import readline from 'node:readline';
import path from 'node:path';
import sharp from 'sharp';

const DATA = process.argv[2];
if (!DATA) throw new Error('usage: node fetch-data.ts <data-dir>');
const META = path.join(DATA, 'meta');
const IMG = path.join(DATA, 'img');
await mkdir(IMG, { recursive: true });

export const FIREARM = ['Gun', 'Firearm', 'Handgun', 'Rifle', 'Shotgun', 'Machine gun', 'Revolver', 'Pistol', 'Assault rifle', 'Sniper rifle'];
export const BLADE = ['Knife', 'Kitchen knife', 'Dagger', 'Sword', 'Machete', 'Hunting knife', 'Bowie knife', 'Utility knife', 'Throwing knife', 'Sabre', 'Cold weapon'];
/** Neither class: too ambiguous to be a clean positive or a clean negative. */
const AMBIGUOUS = ['Weapon', 'Melee weapon', 'Ranged weapon', 'Explosive weapon', 'Ammunition', 'Bullet', 'Gun barrel', 'Gun accessory', 'Handgun holster',
  'Air gun', 'Airsoft gun', 'Water gun', 'Laser guns', 'Light gun', 'Blowgun', 'Paintball gun barrel', 'Starting pistol', 'Mortar (Weapon)', 'Gun turret',
  'Tank', 'Missile', 'Bomb', 'Cannon', 'Bow and arrow', 'Axe', 'Hand axe', 'Throwing axe', 'Pickaxe', 'Table knife', 'Cutlery', 'Tableware', 'Blade',
  'Serrated blade', 'Fencing weapon', 'Foil (Weapon)', 'Sabre (Fencing)', 'Military', 'Military vehicle', 'Armour'];
const PEOPLE = ['Person', 'Man', 'Woman', 'Boy', 'Girl', 'Child', 'Baby', 'Toddler', 'Human', 'Selfie', 'Self-portrait', 'Portrait', 'Portrait photography',
  'Smile', 'Soldier', 'Police', 'Police officer', 'Military police', 'Gunner', 'Gunfighter', 'Gunsmith', 'Face', 'Hand', 'Finger', 'Arm', 'Leg', 'Skin',
  'Facial expression', 'Fashion model', 'Model', 'Bride', 'Groom', 'Crowd', 'Team', 'Player', 'Athlete', 'Dancer', 'Musician', 'Lady', 'Gentleman', 'Teenager',
  'Youth', 'Family', 'Fun', 'Gesture', 'Thumb', 'Nail', 'Beard', 'Lip', 'Eyebrow', 'Forehead', 'Chin', 'Cheek', 'Neck', 'Shoulder', 'Muscle', 'Selfie stick'];
/** Things that look a little like weapons, or that JUYO photographs every day. */
const HARD = ['Tool', 'Heat gun', 'Rivet gun', 'Screw gun', 'Hammer', 'Screwdriver', 'Wrench', 'Pliers', 'Saw', 'Drill', 'Scissors', 'Flashlight', 'Hair dryer',
  'Stapler', 'Mobile phone', 'Telephone', 'Remote control', 'Camera', 'Toy', 'Wallet', 'Handbag', 'Backpack', 'Watch', 'Glasses', 'Sunglasses', 'Umbrella',
  'Key', 'Pen', 'Lighter', 'Belt', 'Bottle', 'Laptop', 'Headphones', 'Jewellery', 'Ring', 'Necklace', 'Shoe', 'Clothing', 'Bicycle', 'Car', 'Dog', 'Cat',
  'Passport', 'Banknote', 'Coin', 'Book', 'Paper', 'Tomato', 'Ketchup', 'Sauce', 'Meat', 'Strawberry', 'Food', 'Fork', 'Spoon', 'Chopsticks', 'Building',
  'Street', 'Restaurant', 'Furniture', 'Electronic device', 'Musical instrument', 'Sports equipment', 'Bag', 'Luggage and bags'];
const HARD_CAP = 60;
const NEG_TOTAL = 3000;

// ---- tiny RFC-4180 CSV reader (titles and authors contain commas/quotes) ----
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
async function* rows(file: string) {
  let header: string[] | null = null;
  for await (const line of readline.createInterface({ input: createReadStream(file) })) {
    if (!line) continue;
    const r = parseCsvLine(line);
    if (!header) { header = r; continue; }
    yield Object.fromEntries(header.map((h, i) => [h, r[i]])) as Record<string, string>;
  }
}

const names = new Map<string, string>();
for (const line of (await readFile(path.join(META, 'class-descriptions.csv'), 'utf8')).split(/\r?\n/)) {
  const r = parseCsvLine(line);
  if (r.length >= 2) names.set(r[0], r[1]);
}

const labels = new Map<string, Set<string>>();
for (const split of ['validation', 'test']) {
  for await (const r of rows(path.join(META, `${split}-labels.csv`))) {
    if (r.Confidence !== '1') continue;
    const n = names.get(r.LabelName);
    if (!n) continue;
    let s = labels.get(r.ImageID);
    if (!s) labels.set(r.ImageID, (s = new Set()));
    s.add(n);
  }
}

const meta = new Map<string, Record<string, string>>();
for (const split of ['validation', 'test']) for await (const r of rows(path.join(META, `${split}-images.csv`))) meta.set(r.ImageID, r);

const has = (s: Set<string>, list: string[]) => list.some((l) => s.has(l));
const isPeople = (s: Set<string>) => has(s, PEOPLE) || [...s].some((l) => l.startsWith('Human '));
// Deterministic order and split from the id alone, so a rerun selects the same images.
const h = (id: string) => createHash('sha256').update(id).digest().readUInt32BE(0);
const splitOf = (id: string) => { const x = h(id) % 10; return x < 6 ? 'train' : x < 8 ? 'val' : 'test'; };

type Entry = { id: string; label: 'firearm' | 'blade' | 'safe'; split: string; tags: string[]; license: string; author: string; page: string };
const chosen: Entry[] = [];
const negPool: string[] = [];
const hardCount = new Map<string, number>();
const sorted = [...labels.keys()].sort((a, b) => h(a) - h(b));
for (const id of sorted) {
  const s = labels.get(id)!;
  const m = meta.get(id);
  if (!m || m.License !== 'https://creativecommons.org/licenses/by/2.0/') continue;
  if (isPeople(s)) continue;
  const fire = has(s, FIREARM), blade = has(s, BLADE);
  const entry = (label: Entry['label']): Entry => ({ id, label, split: splitOf(id), tags: [...s].filter((l) => [...FIREARM, ...BLADE, ...HARD].includes(l)), license: m.License, author: m.Author, page: m.OriginalLandingURL });
  if (fire || blade) { chosen.push(entry(fire ? 'firearm' : 'blade')); continue; }
  if (has(s, AMBIGUOUS)) continue;
  const hard = HARD.find((l) => s.has(l) && (hardCount.get(l) ?? 0) < HARD_CAP);
  if (hard) { hardCount.set(hard, (hardCount.get(hard) ?? 0) + 1); chosen.push(entry('safe')); }
  else negPool.push(id);
}
const hardSafe = chosen.filter((e) => e.label === 'safe').length;
for (const id of negPool.slice(0, Math.max(0, NEG_TOTAL - hardSafe))) {
  const m = meta.get(id)!;
  chosen.push({ id, label: 'safe', split: splitOf(id), tags: [], license: m.License, author: m.Author, page: m.OriginalLandingURL });
}
console.error(`selected: ${chosen.filter((e) => e.label === 'firearm').length} firearm, ${chosen.filter((e) => e.label === 'blade').length} blade, ${chosen.filter((e) => e.label === 'safe').length} safe (${hardSafe} hard)`);

// ---- download: Flickr 300K thumbnail, else the CVDF mirror of the original ----
async function get(url: string) {
  const res = await fetch(url, { redirect: 'follow' }).catch(() => null);
  if (!res || !res.ok) return null;
  const b = Buffer.from(await res.arrayBuffer());
  // Flickr answers removed photos with a small "unavailable" placeholder.
  return b.length > 8000 ? b : null;
}
const ok: Entry[] = [];
let failed = 0;
const queue = chosen.slice();
await Promise.all(Array.from({ length: 16 }, async () => {
  for (let e = queue.shift(); e; e = queue.shift()) {
    const target = path.join(IMG, `${e.id}.jpg`);
    if (!existsSync(target)) {
      const m = meta.get(e.id)!;
      const subset = m.Subset === 'validation' ? 'validation' : 'test';
      const bytes = (m.Thumbnail300KURL && await get(m.Thumbnail300KURL)) || await get(`https://s3.amazonaws.com/open-images-dataset/${subset}/${e.id}.jpg`);
      if (!bytes) { failed++; continue; }
      try {
        const rot = Number(m.Rotation) || 0;
        await writeFile(target, await sharp(bytes).rotate(rot).resize(640, 640, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer());
      } catch { failed++; continue; }
    }
    ok.push(e);
    if (ok.length % 250 === 0) console.error(`  ${ok.length}/${chosen.length}`);
  }
}));
ok.sort((a, b) => h(a.id) - h(b.id));
await writeFile(path.join(DATA, 'list.json'), JSON.stringify(ok, null, 1));
console.error(`done: ${ok.length} images, ${failed} unavailable`);
