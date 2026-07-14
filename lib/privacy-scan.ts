/**
 * Клиенти санҷиши AI барои ҳимояи махфият дар аксҳои ҳуҷҷатҳо.
 * Ниг. supabase/functions/document-privacy-scan барои мантиқи AI.
 */
import { SupabaseClient } from "@supabase/supabase-js";
import { compressImage } from "@/lib/image-utils";

export interface PrivacyRegion {
  label: string;
  x: number; // 0-1, гӯшаи чап-боло
  y: number; // 0-1
  width: number; // 0-1
  height: number; // 0-1
}

export interface PrivacyScanResult {
  is_document: boolean;
  document_type: string | null;
  regions: PrivacyRegion[];
}

export async function scanImageForPrivacy(
  supabaseClient: SupabaseClient,
  file: File,
): Promise<PrivacyScanResult> {
  // Аксҳои аслӣ (аз камера) метавонанд 8-15МБ бошанд — фиристодани онҳо
  // бе фишурдан асосии сабаби суст будани ин санҷиш буд (upload + coding
  // base64 + коркарди OpenAI-и акси калон). Координатаҳо (0-1) новобаста
  // аз андоза дуруст мемонанд, пас фишурдан ба дурустии натиҷа таъсир намекунад.
  const compressed = await compressImage(file, 1280, 0.8);
  const formData = new FormData();
  formData.append("image", compressed);
  const { data, error } = await supabaseClient.functions.invoke(
    "document-privacy-scan",
    { body: formData },
  );
  if (error) throw error;
  return (data ?? { is_document: false, document_type: null, regions: [] }) as PrivacyScanResult;
}
