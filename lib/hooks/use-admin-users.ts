import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminService, AdminUserFilters } from "@/lib/services/admin-service";
import { ADMIN_KEYS } from "@/lib/hooks/admin-query-keys";

export interface AdminUserRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  email: string | null;
  status: string | null;
  created_at: string;
  last_login_at: string | null;
  deleted_at: string | null;
  itemsCount: number;
  resolvedCount: number;
  is_verified?: boolean;
}

export interface AdminUserDetail {
  profile: AdminUserRow & {
    secondary_phone: string | null;
    is_qr_active: boolean;
    qr_activation_count: number;
    qr_scan_count: number;
    accepted_terms: boolean;
    is_verified: boolean;
  };
  items: {
    id: string;
    title: string;
    type: "lost" | "found";
    category: string;
    is_resolved: boolean;
    moderation_status: string;
    created_at: string;
    images: { image_url: string }[];
  }[];
  savedItems: {
    item_id: string;
    created_at: string;
    items: {
      id: string;
      title: string;
      category: string;
      type: "lost" | "found";
      is_resolved: boolean;
      moderation_status: string;
      created_at: string;
      images: { image_url: string }[];
    } | null;
  }[];
  pushTokenCount: number;
}

export function useAdminUsers(filters: AdminUserFilters) {
  return useQuery({
    queryKey: ADMIN_KEYS.usersList(filters),
    queryFn: () => AdminService.getUsers(filters) as Promise<{ users: AdminUserRow[]; total: number }>,
    staleTime: 30_000,
  });
}

export function useAdminUser(id: string) {
  return useQuery({
    queryKey: ADMIN_KEYS.userDetail(id),
    queryFn: () => AdminService.getUser(id) as Promise<AdminUserDetail>,
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useUpdateAdminUser(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: Record<string, unknown>) => AdminService.updateUser(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.userDetail(id) });
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.users() });
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.stats() });
    },
  });
}

export function useDeleteAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => AdminService.deleteUser(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.userDetail(id) });
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.users() });
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.stats() });
    },
  });
}

export function useUploadUserAvatar(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => AdminService.uploadUserAvatar(id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.userDetail(id) });
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.users() });
    },
  });
}

export function usePermanentlyDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => AdminService.permanentlyDeleteUser(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.userDetail(id) });
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.users() });
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.stats() });
      queryClient.invalidateQueries({ queryKey: ["admin", "users", "deleted-archive"] });
    },
  });
}

export interface DeletedAccountSnapshotProfile {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface DeletedAccountSnapshot {
  profile: DeletedAccountSnapshotProfile;
  items: AdminUserDetail["items"];
  savedItems: AdminUserDetail["savedItems"];
}

export interface DeletedAccountEntry {
  id: string;
  user_id: string;
  // Old records (before the snapshot was expanded) have a flat profile_snapshot —
  // that's why both shapes are allowed; normalizeDeletedAccountSnapshot resolves it.
  profile_snapshot: DeletedAccountSnapshot | DeletedAccountSnapshotProfile;
  items_count: number;
  deleted_at: string;
}

export function normalizeDeletedAccountSnapshot(entry: DeletedAccountEntry): DeletedAccountSnapshot {
  const raw = entry.profile_snapshot;
  if (raw && typeof raw === "object" && "profile" in raw) {
    return raw as DeletedAccountSnapshot;
  }
  return {
    profile: raw as DeletedAccountSnapshotProfile,
    items: [],
    savedItems: [],
  };
}

export function useDeletedAccountsArchive() {
  return useQuery({
    queryKey: ["admin", "users", "deleted-archive"],
    queryFn: () => AdminService.getDeletedAccountsArchive() as Promise<{ entries: DeletedAccountEntry[] }>,
    staleTime: 30_000,
  });
}

export function useDeletedAccountEntry(id: string) {
  return useQuery({
    queryKey: ["admin", "users", "deleted-archive", id],
    queryFn: () => AdminService.getDeletedAccountEntry(id) as Promise<{ entry: DeletedAccountEntry }>,
    enabled: !!id,
    staleTime: 30_000,
  });
}
