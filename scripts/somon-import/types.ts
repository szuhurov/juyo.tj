export interface SearchCard {
  externalId: string;
  url: string;
  title: string;
  location: string | null;
  cardImage: string | null;
}

export interface ListingDetail {
  title: string | null;
  description: string | null;
  images: string[];
  category: string | null;
  publishedAt: string | null; // ISO
  raw: Record<string, unknown>;
}

export interface ImportRow {
  external_id: string;
  source: string;
  title: string;
  description: string | null;
  images: string[];
  category: string | null;
  type: "lost" | "found" | null;
  location: string | null;
  published_at: string | null;
  source_url: string;
  raw_data: Record<string, unknown>;
}
