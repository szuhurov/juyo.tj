export const ADMIN_KEYS = {
  all: ["admin"] as const,
  stats: () => [...ADMIN_KEYS.all, "stats"] as const,
  users: () => [...ADMIN_KEYS.all, "users"] as const,
  usersList: (filters: unknown) => [...ADMIN_KEYS.users(), "list", { filters }] as const,
  userDetail: (id: string) => [...ADMIN_KEYS.users(), "detail", id] as const,
  posts: () => [...ADMIN_KEYS.all, "posts"] as const,
  postsList: (filters: unknown) => [...ADMIN_KEYS.posts(), "list", { filters }] as const,
  postDetail: (id: string) => [...ADMIN_KEYS.posts(), "detail", id] as const,
  settings: () => [...ADMIN_KEYS.all, "settings"] as const,
};
