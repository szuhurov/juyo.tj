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
  item: AdminPostRow & {
    description: string | null;
    reward: string | null;
    phone_number: string | null;
    moderation_result: string | null;
    views: number;
    profiles: { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null; phone: string | null } | null;
  };
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
