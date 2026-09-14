/**
 * Client-side service for the admin panel — all requests go to /api/admin/*.
 */

async function adminFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Хатогии дархост (${res.status})`);
  }
  return res.json();
}

function toQueryString<T extends object>(filters: T = {} as T): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export interface AdminUserFilters {
  search?: string;
  status?: "active" | "deleted" | "all";
  joined?: "today" | "month";
  pushEnabled?: "1";
  sort?: "created_at" | "last_login_at";
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface AdminPostFilters {
  search?: string;
  type?: "lost" | "found";
  category?: string;
  moderation_status?: "pending" | "approved" | "rejected";
  resolved?: "true" | "false" | "all";
  status?: "active" | "deleted" | "all";
  user_id?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export type NotifyTarget =
  | { mode: "single"; userIds: [string] }
  | { mode: "ids"; userIds: string[] }
  | { mode: "all" };

export const AdminService = {
  getStats(period?: "today" | "week" | "month" | "year" | "all") {
    return adminFetch(`/api/admin/stats${period ? `?period=${period}` : ""}`);
  },

  getUsers(filters: AdminUserFilters = {}) {
    return adminFetch(`/api/admin/users${toQueryString(filters)}`);
  },
  getUser(id: string) {
    return adminFetch(`/api/admin/users/${id}`);
  },
  updateUser(id: string, updates: Record<string, unknown>) {
    return adminFetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  },
  deleteUser(id: string) {
    return adminFetch(`/api/admin/users/${id}`, { method: "DELETE" });
  },
  permanentlyDeleteUser(id: string) {
    return adminFetch(`/api/admin/users/${id}/permanent-delete`, { method: "POST" });
  },
  getDeletedAccountsArchive() {
    return adminFetch(`/api/admin/users/deleted-archive`);
  },
  getDeletedAccountEntry(id: string) {
    return adminFetch(`/api/admin/users/deleted-archive/${id}`);
  },
  async uploadUserAvatar(id: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/admin/users/${id}/avatar`, { method: "POST", body: formData });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || `Хатогии дархост (${res.status})`);
    }
    return res.json();
  },

  getPosts(filters: AdminPostFilters = {}) {
    return adminFetch(`/api/admin/posts${toQueryString(filters)}`);
  },
  getPost(id: string) {
    return adminFetch(`/api/admin/posts/${id}`);
  },
  updatePost(id: string, updates: Record<string, unknown>) {
    return adminFetch(`/api/admin/posts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  },
  deletePost(id: string) {
    return adminFetch(`/api/admin/posts/${id}`, { method: "DELETE" });
  },
  permanentlyDeletePost(id: string) {
    return adminFetch(`/api/admin/posts/${id}/permanent-delete`, { method: "POST" });
  },
  getDeletedItemsArchive(userId?: string) {
    return adminFetch(`/api/admin/posts/deleted-archive${userId ? `?user_id=${userId}` : ""}`);
  },
  getDeletedItemEntry(id: string) {
    return adminFetch(`/api/admin/posts/deleted-archive/${id}`);
  },

  sendNotification(payload: { title: string; body: string; target: NotifyTarget }) {
    return adminFetch("/api/admin/notify", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async replacePostImage(postId: string, imageId: string, oldImageUrl: string, file: File) {
    const formData = new FormData();
    formData.append("image_id", imageId);
    formData.append("old_image_url", oldImageUrl);
    formData.append("image", file);
    const res = await fetch(`/api/admin/posts/${postId}/images`, { method: "PATCH", body: formData });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || `Хатогии дархост (${res.status})`);
    }
    return res.json();
  },

  getSettings() {
    return adminFetch("/api/admin/settings");
  },
  updateSettings(updates: { ai_moderation_enabled?: boolean; post_lifetime_days?: number }) {
    return adminFetch("/api/admin/settings", {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  },

  getEmbeddingsMissingCount() {
    return adminFetch<{ missingCount: number }>("/api/admin/reprocess-embeddings");
  },
  reprocessEmbeddings() {
    return adminFetch<{ total: number; processed: number; failed: number }>(
      "/api/admin/reprocess-embeddings",
      { method: "POST" },
    );
  },

  getDeletionRequests(filters: { status?: string } = {}) {
    return adminFetch(`/api/admin/deletion-requests${toQueryString(filters)}`);
  },
  updateDeletionRequest(id: string, updates: { status: "processed" | "rejected" }) {
    return adminFetch(`/api/admin/deletion-requests/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  },
};
