import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminService, AdminPostFilters } from "@/lib/services/admin-service";
import { ADMIN_KEYS } from "@/lib/hooks/admin-query-keys";

export interface AdminPostRow {
  id: string;
  title: string;
  category: string;
  type: "lost" | "found";
  is_resolved: boolean;
  moderation_status: "pending" | "approved" | "rejected";
  status: "active" | "deleted" | null;
  created_at: string;
  user_id: string;
  profiles: { first_name: string | null; last_name: string | null } | null;
  images: { image_url: string }[];
}

export interface AdminPostDetail {
  item: Omit<AdminPostRow, "images"> & {
    description: string | null;
    reward: string | null;
    phone_number: string | null;
    moderation_result: string | null;
    views: number;
    profiles: { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null; phone: string | null } | null;
    images: { id: string; image_url: string }[];
  };
}

// Count of "pending" posts — for the red badge in the admin sidebar.
// Polls every 30 seconds so the admin sees the updated count even without
// a manual refresh (e.g. after a notify-pending-review push).
export function usePendingPostsCount() {
  return useQuery({
    queryKey: [...ADMIN_KEYS.posts(), "pending-count"],
    queryFn: async () => {
      const res = (await AdminService.getPosts({ moderation_status: "pending", status: "active", pageSize: 1 })) as {
        total: number;
      };
      return res.total;
    },
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
}

export function useAdminPosts(filters: AdminPostFilters) {
  return useQuery({
    queryKey: ADMIN_KEYS.postsList(filters),
    queryFn: () => AdminService.getPosts(filters) as Promise<{ posts: AdminPostRow[]; total: number }>,
    staleTime: 30_000,
  });
}

export function useAdminPost(id: string) {
  return useQuery({
    queryKey: ADMIN_KEYS.postDetail(id),
    queryFn: () => AdminService.getPost(id) as Promise<AdminPostDetail>,
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useUpdateAdminPost(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: Record<string, unknown>) => AdminService.updatePost(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.postDetail(id) });
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.posts() });
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.stats() });
    },
  });
}

export function useReplacePostImages(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (replacements: { imageId: string; oldUrl: string; file: File }[]) => {
      for (const r of replacements) {
        await AdminService.replacePostImage(id, r.imageId, r.oldUrl, r.file);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.postDetail(id) });
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.posts() });
    },
  });
}

export function useDeleteAdminPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => AdminService.deletePost(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.postDetail(id) });
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.posts() });
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.stats() });
    },
  });
}

export function usePermanentlyDeletePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => AdminService.permanentlyDeletePost(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.postDetail(id) });
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.posts() });
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.stats() });
      queryClient.invalidateQueries({ queryKey: ["admin", "posts", "deleted-archive"] });
    },
  });
}

export interface DeletedItemSnapshot {
  id: string;
  user_id: string;
  title: string;
  category: string;
  type: "lost" | "found";
  is_resolved: boolean;
  moderation_status: string;
  created_at: string;
  images: { image_url: string }[];
  profiles: { first_name: string | null; last_name: string | null } | null;
}

export interface DeletedItemEntry {
  id: string;
  item_id: string;
  item_snapshot: DeletedItemSnapshot;
  deleted_at: string;
}

export function useDeletedItemsArchive(userId?: string) {
  return useQuery({
    queryKey: userId ? ["admin", "posts", "deleted-archive", "user", userId] : ["admin", "posts", "deleted-archive"],
    queryFn: () => AdminService.getDeletedItemsArchive(userId) as Promise<{ entries: DeletedItemEntry[] }>,
    staleTime: 30_000,
  });
}

export function useDeletedItemEntry(id: string) {
  return useQuery({
    queryKey: ["admin", "posts", "deleted-archive", id],
    queryFn: () => AdminService.getDeletedItemEntry(id) as Promise<{ entry: DeletedItemEntry }>,
    enabled: !!id,
    staleTime: 30_000,
  });
}
