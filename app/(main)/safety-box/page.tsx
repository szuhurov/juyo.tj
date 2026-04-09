"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useLanguage } from "@/lib/language-context";
import { createClerkSupabaseClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusCircle, Briefcase, Trash2, Send, Info } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import Link from "next/link";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function SafetyBoxPage() {
  const { t } = useLanguage();
  const { userId, getToken } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) loadSafetyBox();
  }, [userId]);

  const loadSafetyBox = async () => {
    setLoading(true);
    try {
      const token = await getToken({ template: 'supabase' });
      const supabase = createClerkSupabaseClient(token!);
      const { data, error } = await supabase
        .from('safety_box')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error(error);
      toast.error(t('dataLoadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('removeFromSafeConfirm'))) return;

    try {
      const token = await getToken({ template: 'supabase' });
      const supabase = createClerkSupabaseClient(token!);
      const { error } = await supabase.from('safety_box').delete().eq('id', id);
      if (error) throw error;
      
      setItems(prev => prev.filter(item => item.id !== id));
      toast.success(t('success'));
    } catch (error) {
      toast.error(t('error'));
    }
  };

  const handlePublish = async (safetyItem: any) => {
    if (!confirm(t('publishFromSafeConfirm'))) return;

    try {
      const token = await getToken({ template: 'supabase' });
      const supabase = createClerkSupabaseClient(token!);
      
      // 1. Create item in feed
      const { data: item, error: itemError } = await supabase
        .from('items')
        .insert([{
          user_id: userId,
          title: safetyItem.item_name,
          description: safetyItem.description,
          category: safetyItem.category,
          type: 'lost',
          date: new Date().toISOString().split('T')[0],
          reward: safetyItem.reward,
          phone_number: safetyItem.phone_number,
          moderation_status: 'pending'
        }])
        .select()
        .single();

      if (itemError) throw itemError;

      // 2. Add images
      if (safetyItem.images?.length > 0) {
        const imageRecords = safetyItem.images.map((url: string) => ({
          item_id: item.id,
          image_url: url
        }));
        await supabase.from('item_images').insert(imageRecords);
      }

      // 3. Remove from safety box
      await supabase.from('safety_box').delete().eq('id', safetyItem.id);
      
      setItems(prev => prev.filter(i => i.id !== safetyItem.id));
      toast.success(t('publishFromSafeSuccess'));
    } catch (error) {
      toast.error(t('error'));
    }
  };

  return (
    <TooltipProvider>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
              <Briefcase className="w-8 h-8 text-blue-600" /> {t('safetyBoxTitle')}
            </h1>
            <p className="text-zinc-500 mt-1 text-sm">{t('safetyBoxDesc')}</p>
          </div>
          <Button asChild size="lg" className="rounded-lg gap-2 font-bold h-12">
            <Link href="/safety-box/add">
              <PlusCircle className="w-5 h-5" /> {t('add')}
            </Link>
          </Button>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl p-5 mb-8 flex gap-4 items-start">
          <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-blue-900 dark:text-blue-300 text-xs font-medium leading-relaxed">
            {t('safetyItemBanner')}
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : items.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => (
              <Card key={item.id} className="rounded-xl overflow-hidden shadow-md border flex flex-col">
                <div className="relative aspect-video bg-zinc-100 dark:bg-zinc-900">
                  {item.images?.[0] ? (
                    <Image src={item.images[0]} alt={item.item_name} fill className="object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-zinc-300">
                      <Briefcase className="w-10 h-10" />
                    </div>
                  )}
                  <Badge className="absolute top-3 left-3 bg-white/90 backdrop-blur text-black text-[10px] font-bold rounded-md">
                     {t(`categories.${item.category}`)}
                  </Badge>
                </div>
                <CardContent className="p-5 flex-1">
                  <h3 className="text-lg font-bold mb-1">{item.item_name}</h3>
                  <p className="text-zinc-500 text-xs line-clamp-2 leading-relaxed">{item.description}</p>
                </CardContent>
                <CardFooter className="p-5 pt-0 flex gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="flex-1 rounded-lg gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-zinc-200 dark:border-zinc-800"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('delete')}</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        className="flex-[2] rounded-lg gap-2 bg-blue-600 hover:bg-blue-700 font-bold"
                        onClick={() => handlePublish(item)}
                      >
                        <Send className="w-4 h-4" /> {t('publishFromSafe').split(' ')[0]}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('publishFromSafe')}</p>
                    </TooltipContent>
                  </Tooltip>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border-2 border-dashed">
            <Briefcase className="w-16 h-16 text-zinc-200 mx-auto mb-4" />
            <h3 className="text-xl font-black">{t('noData')}</h3>
            <p className="text-zinc-400 max-w-xs mx-auto mt-1 text-sm">{t('safetyBoxDesc')}</p>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
