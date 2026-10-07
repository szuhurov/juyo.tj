// SigLIP text tokenizer (SentencePiece Unigram) without a tokenizer library.
// Mirrors Xenova/siglip-base-patch16-224 tokenizer.json + SiglipTokenizer:
// lower-case, punctuation removed, spaces collapsed, Metaspace "▁" prefix,
// Viterbi over the unigram vocabulary, "</s>" appended, padded with "</s>"
// to 64 tokens (SigLIP was trained with max_length padding).
// The precompiled NFKC charsmap is NOT reproduced: prompts must be plain
// lower-case ASCII, which that map leaves unchanged.

export const MAX_LEN = 64;
const EOS = 1;
const UNK = 2;

export function makeTokenizer(tokenizerJson: { model: { vocab: [string, number][] } }) {
  const vocab = tokenizerJson.model.vocab;
  const index = new Map<string, number>();
  vocab.forEach(([piece], id) => { if (id > 2) index.set(piece, id); });
  const maxPiece = Math.max(...vocab.map(([p]) => p.length));
  const unkScore = Math.min(...vocab.map(([, s]) => s)) - 10;

  return function encode(text: string): number[] {
    if (/[^\x20-\x7e]/.test(text)) throw new Error(`prompt must be plain ASCII: ${text}`);
    const clean = text.toLowerCase().replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, '').replace(/\s+/g, ' ').trim();
    const s = '▁' + clean.replace(/ /g, '▁');
    // Viterbi: best[i] = best score of s[0..i)
    const best = new Float64Array(s.length + 1).fill(-Infinity);
    const from = new Int32Array(s.length + 1);
    const tok = new Int32Array(s.length + 1);
    best[0] = 0;
    for (let i = 0; i < s.length; i++) {
      if (best[i] === -Infinity) continue;
      let matched = false;
      for (let len = 1; len <= maxPiece && i + len <= s.length; len++) {
        const id = index.get(s.slice(i, i + len));
        if (id === undefined) continue;
        matched = true;
        const sc = best[i] + vocab[id][1];
        if (sc > best[i + len]) { best[i + len] = sc; from[i + len] = i; tok[i + len] = id; }
      }
      if (!matched && best[i] + unkScore > best[i + 1]) { best[i + 1] = best[i] + unkScore; from[i + 1] = i; tok[i + 1] = UNK; }
    }
    const ids: number[] = [];
    for (let i = s.length; i > 0; i = from[i]) ids.push(tok[i]);
    ids.reverse();
    ids.push(EOS);
    if (ids.length > MAX_LEN) throw new Error(`prompt too long: ${text}`);
    while (ids.length < MAX_LEN) ids.push(EOS);
    return ids;
  };
}
