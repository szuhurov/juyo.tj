// Candidate image-embedding models for the JUYO visual-search benchmark.
// Every file is downloaded once by fetch-models.ts (pinned SHA-256) and run
// locally with onnxruntime-web (the same runtime as the browser build).
import type { PreprocessSpec } from '../../lib/visual-preprocess.ts';

export type Pooling = 'pooler' | 'image_embeds' | 'cls' | 'cls+mean';

export interface Candidate {
  id: string;
  label: string;
  file: string;
  externalData?: string;
  url: string;
  sha256: string;
  pooling: Pooling;
  spec: PreprocessSpec;
  license: string;
  commercialOk: boolean;
  note?: string;
}

const HALF: Pick<PreprocessSpec, 'mean' | 'std'> = { mean: [0.5, 0.5, 0.5], std: [0.5, 0.5, 0.5] };
const IMAGENET: Pick<PreprocessSpec, 'mean' | 'std'> = { mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225] };
const OPENAI: Pick<PreprocessSpec, 'mean' | 'std'> = { mean: [0.48145466, 0.4578275, 0.40821073], std: [0.26862954, 0.26130258, 0.27577711] };
const HF = 'https://huggingface.co';

export const CANDIDATES: Candidate[] = [
  {
    id: 'siglip-b16-224-q8',
    label: 'SigLIP base/16 224 (current)',
    file: 'siglip_q.onnx',
    url: `${HF}/Xenova/siglip-base-patch16-224/resolve/main/onnx/vision_model_quantized.onnx`,
    sha256: 'ef14a954f3d57e1806666432bd9785004c1dc27100aa260eee0cb0f10a5de058',
    pooling: 'pooler',
    spec: { size: 224, mode: 'squash', ...HALF },
    license: 'Apache-2.0 (google/siglip-base-patch16-224)',
    commercialOk: true,
  },
  {
    id: 'siglip2-b16-224-q8',
    label: 'SigLIP 2 base/16 224',
    file: 'siglip2_q.onnx',
    url: `${HF}/onnx-community/siglip2-base-patch16-224-ONNX/resolve/main/onnx/vision_model_quantized.onnx`,
    sha256: 'undefined',
    pooling: 'pooler',
    spec: { size: 224, mode: 'squash', ...HALF },
    license: 'Apache-2.0 (google/siglip2-base-patch16-224)',
    commercialOk: true,
  },
  {
    id: 'dinov2-s14-q8',
    label: 'DINOv2 small/14',
    file: 'dinov2s_q.onnx',
    url: `${HF}/onnx-community/dinov2-small-ONNX/resolve/main/onnx/model_quantized.onnx`,
    sha256: '7cfc69bd1874d20b9dbecdab057f21aeac7b90c2f560bd0fb66af86c78024f62',
    pooling: 'cls',
    spec: { size: 224, mode: 'squash', ...IMAGENET },
    license: 'Apache-2.0 (facebook/dinov2-small)',
    commercialOk: true,
  },
  {
    id: 'dinov2-s14-q8-clsmean',
    label: 'DINOv2 small/14, CLS+mean patch',
    file: 'dinov2s_q.onnx',
    url: `${HF}/onnx-community/dinov2-small-ONNX/resolve/main/onnx/model_quantized.onnx`,
    sha256: '7cfc69bd1874d20b9dbecdab057f21aeac7b90c2f560bd0fb66af86c78024f62',
    pooling: 'cls+mean',
    spec: { size: 224, mode: 'squash', ...IMAGENET },
    license: 'Apache-2.0 (facebook/dinov2-small)',
    commercialOk: true,
  },
  {
    id: 'dinov2-s14-q8-r280',
    label: 'DINOv2 small/14 at 280 px',
    file: 'dinov2s_q.onnx',
    url: `${HF}/onnx-community/dinov2-small-ONNX/resolve/main/onnx/model_quantized.onnx`,
    sha256: '7cfc69bd1874d20b9dbecdab057f21aeac7b90c2f560bd0fb66af86c78024f62',
    pooling: 'cls',
    spec: { size: 280, mode: 'squash', ...IMAGENET },
    license: 'Apache-2.0 (facebook/dinov2-small)',
    commercialOk: true,
  },
  {
    id: 'dinov2-s14-q8-r336',
    label: 'DINOv2 small/14 at 336 px',
    file: 'dinov2s_q.onnx',
    url: `${HF}/onnx-community/dinov2-small-ONNX/resolve/main/onnx/model_quantized.onnx`,
    sha256: '7cfc69bd1874d20b9dbecdab057f21aeac7b90c2f560bd0fb66af86c78024f62',
    pooling: 'cls',
    spec: { size: 336, mode: 'squash', ...IMAGENET },
    license: 'Apache-2.0 (facebook/dinov2-small)',
    commercialOk: true,
  },
  {
    id: 'dinov2-s14-fp32-r280',
    label: 'DINOv2 small/14 fp32 at 280 px',
    file: 'dinov2s_fp32.onnx',
    url: `${HF}/onnx-community/dinov2-small-ONNX/resolve/main/onnx/model.onnx`,
    sha256: '6266c3cd72db6953cecdcbfeab9422a9f783d96f1a4e296ba70ffbac43b54a18',
    pooling: 'cls',
    spec: { size: 280, mode: 'squash', ...IMAGENET },
    license: 'Apache-2.0 (facebook/dinov2-small)',
    commercialOk: true,
  },
  {
    id: 'dinov2-s14-q4-r280',
    label: 'DINOv2 small/14 4-bit weights at 280 px',
    file: 'dinov2s_q4.onnx',
    url: `${HF}/onnx-community/dinov2-small-ONNX/resolve/main/onnx/model_q4.onnx`,
    sha256: '0f4a7f7d8524f2959407d0f35b09281111bc90c6ed105509290e36da1c669314',
    pooling: 'cls',
    spec: { size: 280, mode: 'squash', ...IMAGENET },
    license: 'Apache-2.0 (facebook/dinov2-small)',
    commercialOk: true,
  },
  {
    id: 'dinov2-s14-fp16-r280',
    label: 'DINOv2 small/14 fp16 at 280 px',
    file: 'dinov2s_fp16.onnx',
    url: `${HF}/onnx-community/dinov2-small-ONNX/resolve/main/onnx/model_fp16.onnx`,
    sha256: 'e6ab6a3e681f842a3d6ca57ecd302820a700c41a9be5e40f69ec8e019b8d8e94',
    pooling: 'cls',
    spec: { size: 280, mode: 'squash', ...IMAGENET },
    license: 'Apache-2.0 (facebook/dinov2-small)',
    commercialOk: true,
  },
  {
    id: 'dinov2-s14-q8-crop',
    label: 'DINOv2 small/14, HF centre crop',
    file: 'dinov2s_q.onnx',
    url: `${HF}/onnx-community/dinov2-small-ONNX/resolve/main/onnx/model_quantized.onnx`,
    sha256: '7cfc69bd1874d20b9dbecdab057f21aeac7b90c2f560bd0fb66af86c78024f62',
    pooling: 'cls',
    spec: { size: 224, mode: 'crop', resizeTo: 256, ...IMAGENET },
    license: 'Apache-2.0 (facebook/dinov2-small)',
    commercialOk: true,
  },
  {
    id: 'dinov2-s14-fp32',
    label: 'DINOv2 small/14 fp32',
    file: 'dinov2s_fp32.onnx',
    url: `${HF}/onnx-community/dinov2-small-ONNX/resolve/main/onnx/model.onnx`,
    sha256: '6266c3cd72db6953cecdcbfeab9422a9f783d96f1a4e296ba70ffbac43b54a18',
    pooling: 'cls',
    spec: { size: 224, mode: 'squash', ...IMAGENET },
    license: 'Apache-2.0 (facebook/dinov2-small)',
    commercialOk: true,
  },
  {
    id: 'dinov2-b14-q8',
    label: 'DINOv2 base/14',
    file: 'dinov2b_q.onnx',
    url: `${HF}/Xenova/dinov2-base/resolve/main/onnx/model_quantized.onnx`,
    sha256: '1a1210212e3d8c2924d2ad985e46207bb407ac9a9763a240cacdeb94cd0bbf9c',
    pooling: 'cls',
    spec: { size: 224, mode: 'squash', ...IMAGENET },
    license: 'Apache-2.0 (facebook/dinov2-base)',
    commercialOk: true,
  },
  {
    id: 'dinov3-s16-q8',
    label: 'DINOv3 ViT-S/16',
    file: 'dinov3s_q.onnx',
    externalData: 'model_quantized.onnx_data',
    url: `${HF}/onnx-community/dinov3-vits16-pretrain-lvd1689m-ONNX/resolve/main/onnx/model_quantized.onnx`,
    sha256: '7686e8c849202c4fdd67d1cd336449c29bdddbcca535d765d3014f50d04d516d',
    pooling: 'pooler',
    spec: { size: 224, mode: 'squash', ...IMAGENET },
    license: 'DINOv3 License (Meta, custom; upstream gated)',
    commercialOk: false,
    note: 'Commercial use allowed but custom terms (attribution "Built with DINOv3", use restrictions, revocable); needs owner/legal sign-off.',
  },
  {
    id: 'mobileclip-s0-q8',
    label: 'MobileCLIP S0',
    file: 'mobileclip_s0_q.onnx',
    url: `${HF}/Xenova/mobileclip_s0/resolve/main/onnx/vision_model_quantized.onnx`,
    sha256: 'fcbd153d1aa1314fb72ea39b20c37e0572e7e7b05359b51f3efee5d682658472',
    pooling: 'image_embeds',
    spec: { size: 256, mode: 'crop', resizeTo: 256, mean: [0, 0, 0], std: [1, 1, 1] },
    license: 'Apple ML Research Model License (research only)',
    commercialOk: false,
    note: 'Weights licensed for non-commercial research only — measured for reference, cannot ship.',
  },
  {
    id: 'clip-b32-q8',
    label: 'OpenAI CLIP ViT-B/32',
    file: 'clipb32_q.onnx',
    url: `${HF}/Xenova/clip-vit-base-patch32/resolve/main/onnx/vision_model_quantized.onnx`,
    sha256: '583fd1110a514667812fee7d684952aaf82a99b959760c8d7dca7e0ab9839299',
    pooling: 'image_embeds',
    spec: { size: 224, mode: 'crop', resizeTo: 224, ...OPENAI },
    license: 'MIT (openai/CLIP)',
    commercialOk: true,
  },
];
