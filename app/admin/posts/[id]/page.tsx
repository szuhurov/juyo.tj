"use client";

import { use } from "react";
import { useAdminPost } from "@/lib/hooks/use-admin-posts";
import { PostDetailHeader } from "@/components/admin/posts/post-detail-header";
import { PostEditForm } from "@/components/admin/posts/post-edit-form";
import { PostVerificationAttempts } from "@/components/admin/posts/post-verification-attempts";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminPostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, error } = useAdminPost(id);

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm font-bold text-red-600">Эълон ёфт нашуд</p>;
  }

  return (
    <div className="space-y-5">
      <PostDetailHeader item={data.item} />
      <PostEditForm item={data.item} />
      <PostVerificationAttempts attempts={data.verificationAttempts} />
    </div>
  );
}
