"use client";

import { useEffect, useState } from "react";
import { useUser, SignOutButton, useAuth } from "@clerk/nextjs";
import { useLanguage } from "@/lib/language-context";
import { Item, ItemService, CATEGORIES } from "@/lib/services/item-service";
import { ItemCard } from "@/components/item-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClerkSupabaseClient } from "@/lib/supabase";
import { 
  User, 
  Bookmark, 
  LogOut, 
  ChevronRight, 
  Briefcase,
  PackageSearch,
  Mail,
  LayoutGrid,
  Trash2,
  Loader2,
  Clock,
  Upload,
  X,
  Send,
  ShieldCheck,
  PlusCircle,
  AlertTriangle
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ProfilePage() {
  const { user, isLoaded: userLoaded } = useUser();
  const { getToken, userId } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("posts");
  
  // States for Posts
  const [myItems, setMyItems] = useState<Item[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);

  // States for Safety Box
  const [safetyItems, setSafetyItems] = useState<any[]>([]);
  const [safetyLoading, setSafetyLoading] = useState(false);
  const [safetySubmitting, setSafetySubmitting] = useState(false);
  const [safetyCategory, setSafetyCategory] = useState("");
  const [safetyImages, setSafetyImages] = useState<File[]>([]);
  const [safetyPreviews, setSafetyPreviews] = useState<string[]>([]);
  const [isAddingSafetyItem, setIsAddingSafetyItem] = useState(false);

  // Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    variant: "default" | "destructive" | "warning";
  }>({
    open: false,
    title: "",
    description: "",
    onConfirm: () => {},
    variant: "default"
  });

  // States for Saved Items
  const [savedItems, setSavedItems] = useState<Item[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);

  useEffect(() => {
    if (user?.id) {
      if (activeTab === "posts") loadMyItems();
      if (activeTab === "safety") loadSafetyItems();
      if (activeTab === "saved") loadSavedItems();
    }
  }, [user?.id, activeTab]);

  const loadSavedItems = async () => {
    setSavedLoading(true);
    try {
      if (userId) {
        const token = await getToken({ template: 'supabase' });
        const supabase = createClerkSupabaseClient(token!);
        const items = await ItemService.getSavedItems(supabase, userId);
        setSavedItems(items);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSavedLoading(false);
    }
  };

  useEffect(() => {
    const handleUpdate = () => {
      if (activeTab === "saved") loadSavedItems();
    };
    window.addEventListener('saved-items-updated', handleUpdate);
    return () => window.removeEventListener('saved-items-updated', handleUpdate);
  }, [activeTab]);

  const loadMyItems = async () => {
    setPostsLoading(true);
    try {
      const data = await ItemService.getItems({ user_id: user?.id });
      setMyItems(data);
    } catch (error) {
      console.error(error);
    } finally {
      setPostsLoading(false);
    }
  };

  const loadSafetyItems = async () => {
    setSafetyLoading(true);
    try {
      const token = await getToken({ template: 'supabase' });
      const supabase = createClerkSupabaseClient(token!);
      const { data, error } = await supabase
        .from('safety_box')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSafetyItems(data || []);
    } catch (error) {
      toast.error(t('dataLoadError'));
    } finally {
      setSafetyLoading(false);
    }
  };

  const handleSafetyImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (safetyImages.length + files.length > 5) {
      toast.error(t('maxImagesReached'));
      return;
    }
    setSafetyImages(prev => [...prev, ...files]);
    const newPreviews = files.map(file => URL.createObjectURL(file));
    setSafetyPreviews(prev => [...prev, ...newPreviews]);
  };

  const removeSafetyImage = (index: number) => {
    setSafetyImages(prev => prev.filter((_, i) => i !== index));
    setSafetyPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleRegisterSafetyItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = (formData.get('name') as string).trim();
    const description = (formData.get('description') as string).trim();
    const phone = (formData.get('phone') as string).trim();
    const reward = (formData.get('reward') as string).trim();

    if (!name || !description || !safetyCategory || !phone) {
      toast.error(t('fillAllFields'));
      return;
    }

    // Phone validation
    if (!/^\d{9}$/.test(phone)) {
      toast.error("Рақами телефон бояд маҳз 9 рақам бошад (масалан: 900123456)");
      return;
    }

    // Reward validation
    if (reward && isNaN(Number(reward))) {
      toast.error("Маблағи туҳфа бояд танҳо рақам бошад");
      return;
    }

    setSafetySubmitting(true);
    try {
      const token = await getToken({ template: 'supabase' });
      const supabase = createClerkSupabaseClient(token!);

      const imageUrls = [];
      for (const file of safetyImages) {
        const ext = file.name.split('.').pop();
        const fileName = `safety-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('items').upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('items').getPublicUrl(fileName);
        imageUrls.push(publicUrl);
      }

      const { data, error } = await supabase
        .from('safety_box')
        .insert([{ 
          user_id: userId, 
          item_name: name, 
          category: safetyCategory,
          description,
          phone_number: phone,
          reward: reward ? `${reward}` : null,
          images: imageUrls
        }])
        .select()
        .single();

      if (error) throw error;
      setSafetyItems([data, ...safetyItems]);
      toast.success(t('success'));
      setSafetyImages([]);
      setSafetyPreviews([]);
      setSafetyCategory("");
      setIsAddingSafetyItem(false);
    } catch (error) {
      toast.error(t('error'));
    } finally {
      setSafetySubmitting(false);
    }
  };

  const handlePublishSafetyItem = async (safetyItem: any) => {
    setConfirmDialog({
      open: true,
      title: t('publishItem'),
      description: t('publishFromSafeConfirm'),
      variant: "default",
      onConfirm: async () => {
        try {
          const token = await getToken({ template: 'supabase' });
          const supabase = createClerkSupabaseClient(token!);
          
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

          if (safetyItem.images?.length > 0) {
            const imageRecords = safetyItem.images.map((url: string) => ({
              item_id: item.id,
              image_url: url
            }));
            await supabase.from('item_images').insert(imageRecords);
          }

          await supabase.from('safety_box').delete().eq('id', safetyItem.id);
          setSafetyItems(prev => prev.filter(i => i.id !== safetyItem.id));
          toast.success(t('publishFromSafeSuccess'));
        } catch (error) {
          toast.error(t('error'));
        }
      }
    });
  };

  const deleteSafetyItem = async (id: string) => {
    setConfirmDialog({
      open: true,
      title: t('deleteConfirmTitle'),
      description: t('removeFromSafeConfirm'),
      variant: "destructive",
      onConfirm: async () => {
        try {
          const token = await getToken({ template: 'supabase' });
          const supabase = createClerkSupabaseClient(token!);
          const { error } = await supabase.from('safety_box').delete().eq('id', id);
          if (error) throw error;
          setSafetyItems(safetyItems.filter(i => i.id !== id));
          toast.success(t('success'));
        } catch (error) {
          toast.error(t('error'));
        }
      }
    });
  };

  if (!userLoaded) return null;

  const menuItems = [
    {
      id: "posts",
      title: t('myPosts'),
      icon: LayoutGrid,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-900/20"
    },
    {
      id: "info",
      title: t('personalInfo'),
      icon: User,
      color: "text-indigo-600",
      bg: "bg-indigo-50 dark:bg-indigo-900/20"
    },
    {
      id: "saved",
      title: t('savedItems'),
      icon: Bookmark,
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-900/20"
    },
    {
      id: "safety",
      title: t('mySafe'),
      icon: Briefcase,
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-900/20"
    }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "posts":
        return (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="sticky top-[64px] z-30 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md pt-4 pb-4 px-2 mb-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black uppercase tracking-tight">{t('myPosts')}</h3>
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 flex items-center justify-center rounded text-[12px] font-black bg-zinc-900 text-white">
                    {myItems.length}
                  </div>
                  <Link href="/items/add">
                    <Button size="icon" className="h-6 w-6 rounded bg-zinc-900 text-white hover:bg-zinc-100 hover:text-zinc-900 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white transition-all shadow-sm">
                      <PlusCircle className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>              </div>
            </div>

            {postsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 px-1">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-2xl" />)}
              </div>
            ) : myItems.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 px-1">
                {myItems.map((item) => (
                  <ItemCard key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 mx-1">
                <PackageSearch className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                <h4 className="font-bold text-zinc-400 uppercase text-xs tracking-widest">{t('noItemsFound')}</h4>
                <AddItemModal />
              </div>
            )}
          </div>
        );
      
      case "info":
        return (
          <div className="animate-in slide-in-from-right-4 duration-500 space-y-12 pb-20">
            <div className="sticky top-[64px] z-30 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md pt-4 pb-4 px-2 mb-6">
              <h3 className="text-lg font-black uppercase tracking-tight">{t('personalInfo')}</h3>
            </div>
            
            <div className="max-w-2xl px-2 space-y-12">
              {/* Avatar Section */}
              <section className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-4 h-4 text-zinc-400" />
                  <h4 className="font-black uppercase text-[10px] tracking-[0.2em] text-zinc-400">{t('avatarAndName')}</h4>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-8 bg-zinc-50 dark:bg-zinc-900/30 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-900">
                  <div className="relative group shrink-0">
                    <Avatar className="w-24 h-24 border-4 border-white dark:border-zinc-800 shadow-xl rounded-2xl overflow-hidden">
                      <AvatarImage src={user?.imageUrl} />
                      <AvatarFallback className="bg-zinc-900 text-white text-3xl font-black">
                        {user?.firstName?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 cursor-pointer rounded-2xl transition-all">
                      <Upload className="w-6 h-6 text-white" />
                      <span className="text-[8px] font-black text-white uppercase mt-1 opacity-80">{t('changePhoto')}</span>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*" 
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              toast.loading(t('uploading'));
                              await user?.setProfileImage({ file });
                              toast.dismiss();
                              toast.success(t('photoUpdated'));
                            } catch (err) {
                              toast.dismiss();
                              toast.error(t('error'));
                            }
                          }
                        }}
                      />
                    </label>
                  </div>
                  <form 
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const firstName = formData.get('firstName') as string;
                      const lastName = formData.get('lastName') as string;
                      try {
                        setSafetySubmitting(true);
                        await user?.update({ firstName, lastName });
                        toast.success(t('nameSaved'));
                      } catch (err) {
                        toast.error(t('error'));
                      } finally {
                        setSafetySubmitting(false);
                      }
                    }}
                    className="flex-1 space-y-4 w-full"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest ml-1">{t('firstName')}</Label>
                        <Input name="firstName" defaultValue={user?.firstName || ""} className="h-10 rounded-xl bg-white dark:bg-zinc-950 font-bold" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest ml-1">{t('lastName')}</Label>
                        <Input name="lastName" defaultValue={user?.lastName || ""} className="h-10 rounded-xl bg-white dark:bg-zinc-950 font-bold" />
                      </div>
                    </div>
                    <Button type="submit" size="sm" disabled={safetySubmitting} className="rounded-lg bg-zinc-900 text-white font-black uppercase text-[9px] tracking-widest px-6">
                      {t('saveName')}
                    </Button>
                  </form>
                </div>
              </section>

              {/* Read-only Email Section */}
              <section className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <Mail className="w-4 h-4 text-zinc-400" />
                  <h4 className="font-black uppercase text-[10px] tracking-[0.2em] text-zinc-400">{t('email')}</h4>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-900/30 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-900 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest ml-1">{t('currentEmail')}</Label>
                    <div className="h-10 flex items-center px-4 rounded-xl bg-zinc-100/50 dark:bg-zinc-900/50 text-zinc-500 font-bold text-sm">
                      {user?.primaryEmailAddress?.emailAddress}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        );

      case "saved":
        return (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="sticky top-[64px] z-30 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md pt-4 pb-4 px-2 mb-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black uppercase tracking-tight">{t('savedItems')}</h3>
                <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-900 text-white">
                  {savedItems.length}
                </div>
              </div>
            </div>

            {savedLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 px-1">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-2xl" />)}
              </div>
            ) : savedItems.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 px-1">
                {savedItems.map((item) => (
                  <ItemCard key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 mx-1">
                <Bookmark className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                <h4 className="font-bold text-zinc-400 uppercase text-xs tracking-widest">{t('savedItemsEmpty')}</h4>
                <Button asChild size="sm" className="mt-6 rounded-md font-black uppercase text-[10px] tracking-wider">
                  <Link href="/">{t('home')}</Link>
                </Button>
              </div>
            )}
          </div>
        );

      case "safety":
        return (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="sticky top-[64px] z-30 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md pt-4 pb-4 px-2 mb-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black uppercase tracking-tight">{t('mySafe')}</h3>
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 flex items-center justify-center rounded text-[12px] font-black bg-zinc-900 text-white">
                    {safetyItems.length}
                  </div>
                  <Button 
                    onClick={() => setIsAddingSafetyItem(!isAddingSafetyItem)}
                    size="icon" 
                    className={cn(
                      "h-6 w-6 rounded transition-all shadow-sm",
                      isAddingSafetyItem 
                        ? "bg-red-500 text-white hover:bg-red-600" 
                        : "bg-zinc-900 text-white hover:bg-zinc-100 hover:text-zinc-900 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
                    )}
                  >
                    {isAddingSafetyItem ? <X className="h-3.5 w-3.5" /> : <PlusCircle className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="max-w-4xl mx-auto px-2">
              {isAddingSafetyItem ? (
                <Card className="rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-xl overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                  <CardHeader className="bg-zinc-50 dark:bg-zinc-900/50 p-6 border-b border-zinc-100 dark:border-zinc-800">
                    <CardTitle className="text-lg font-black uppercase tracking-wider flex items-center gap-3">
                      <Briefcase className="w-5 h-5 text-amber-500" /> {t('registerNewItem')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8">
                    <form onSubmit={async (e) => {
                      await handleRegisterSafetyItem(e);
                    }} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="name" className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">{t('safetyItemNameLabel')}</Label>
                          <Input id="name" name="name" placeholder={t('safetyItemNamePlaceholder')} className="rounded-xl h-12 text-sm bg-zinc-50/50 dark:bg-zinc-900/50" required />
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">{t('categoryLabel')}</Label>
                          <Select onValueChange={setSafetyCategory} required value={safetyCategory}>
                            <SelectTrigger className="h-12 rounded-xl text-sm bg-zinc-50/50 dark:bg-zinc-900/50">
                              <SelectValue placeholder={t('categoryLabel')} />
                            </SelectTrigger>
                            <SelectContent>
                              {CATEGORIES.map((cat) => (
                                <SelectItem key={cat.id} value={cat.name}>
                                  {cat.icon} {t(`categories.${cat.id}`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="phone" className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">{t('phoneLabel')}</Label>
                          <Input 
                            id="phone" 
                            name="phone" 
                            placeholder="992XXXXXXXXX" 
                            className="rounded-xl h-12 text-sm bg-zinc-50/50 dark:bg-zinc-900/50" 
                            required 
                            type="text"
                            inputMode="numeric"
                            onChange={(e) => e.target.value = e.target.value.replace(/[^0-9]/g, '')}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="reward" className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">{t('rewardLabel')}</Label>
                          <Input 
                            id="reward" 
                            name="reward" 
                            placeholder={t('rewardPlaceholder')} 
                            className="rounded-xl h-12 text-sm bg-zinc-50/50 dark:bg-zinc-900/50" 
                            type="text" 
                            inputMode="numeric"
                            onChange={(e) => e.target.value = e.target.value.replace(/[^0-9]/g, '')}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="description" className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">{t('description')}</Label>
                        <Textarea id="description" name="description" placeholder="Маълумоти иловагӣ..." className="rounded-xl min-h-[120px] text-sm resize-none bg-zinc-50/50 dark:bg-zinc-900/50" required />
                      </div>

                      <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">{t('addImages')} ({safetyImages.length}/5)</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                          {safetyPreviews.map((src, i) => (
                            <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border-2 border-zinc-100 dark:border-zinc-800 shadow-sm">
                              <Image src={src} alt="Preview" fill className="object-cover" />
                              <button type="button" onClick={() => removeSafetyImage(i)} className="absolute top-1.5 right-1.5 bg-red-500 text-white p-1 rounded-full shadow-md hover:bg-red-600 transition-colors"><X className="w-3 h-3" /></button>
                            </div>
                          ))}
                          {safetyImages.length < 5 && (
                            <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all group">
                              <Upload className="w-6 h-6 text-zinc-300 group-hover:text-zinc-500 transition-colors" />
                              <span className="text-[8px] font-black uppercase text-zinc-400 mt-2">{t('add')}</span>
                              <input type="file" className="hidden" accept="image/*" multiple onChange={handleSafetyImageChange} />
                            </label>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-4 pt-4">
                        <Button type="submit" className="flex-1 rounded-xl h-14 font-black uppercase tracking-wider text-xs bg-zinc-900 text-white hover:bg-zinc-800 shadow-lg shadow-zinc-100 dark:shadow-none" disabled={safetySubmitting}>
                          {safetySubmitting ? <Loader2 className="animate-spin w-5 h-5" /> : t('saveItem')}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setIsAddingSafetyItem(false)} className="rounded-xl h-14 px-8 font-black uppercase tracking-wider text-xs">
                          {t('cancel')}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-6">
                  <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-5 flex gap-4 items-start animate-in fade-in slide-in-from-top-2 duration-700">
                    <ShieldCheck className="w-6 h-6 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-blue-900 dark:text-blue-200 font-bold leading-tight uppercase tracking-tight mb-1">{t('importantInfo')}</p>
                      <p className="text-[11px] text-blue-700/80 dark:text-blue-400 font-medium leading-normal">
                        {t('importantInfoDesc')}
                      </p>
                    </div>
                  </div>

                  {safetyLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                      {[...Array(3)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-2xl" />)}
                    </div>
                  ) : safetyItems.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                      {safetyItems.map((item) => (
                        <Card key={item.id} className="overflow-hidden hover:shadow-md transition-shadow duration-300 group flex flex-col h-full rounded-xl border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                          <div className="relative aspect-square overflow-hidden rounded-t-xl bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center">
                            {item.images?.[0] ? (
                              <Image src={item.images[0]} alt={item.item_name} fill className="object-cover transition-transform duration-500 group-hover:scale-105" />
                            ) : <PackageSearch className="w-12 h-12 text-zinc-200" />}
                            
                            <div className="absolute top-2 left-2 right-2 flex justify-between items-center">
                              <Badge className="bg-white/90 backdrop-blur text-black text-[9px] font-black rounded px-2 py-0.5 border-none shadow-sm uppercase tracking-tighter">
                                 {t(`categories.${CATEGORIES.find(c => c.name === item.category)?.id || '6'}`)}
                              </Badge>
                              
                              <div className="flex gap-1.5">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      variant="secondary" 
                                      size="icon" 
                                      className="h-7 w-7 rounded-lg bg-white/90 backdrop-blur text-blue-600 hover:bg-blue-600 hover:text-white shadow-sm border-none transition-all"
                                      onClick={() => handlePublishSafetyItem(item)}
                                    >
                                      <Send className="w-3.5 h-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{t('publishItem')}</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      variant="secondary" 
                                      size="icon" 
                                      className="h-7 w-7 rounded-lg bg-white/90 backdrop-blur text-red-500 hover:bg-red-500 hover:text-white shadow-sm border-none transition-all"
                                      onClick={() => deleteSafetyItem(item.id)}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{t('delete')}</TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                          </div>
                          <CardContent className="p-3 flex-1 flex flex-col">
                            <h4 className="font-black text-xs line-clamp-1 leading-tight uppercase tracking-tight mb-1 group-hover:text-emerald-500 transition-colors">
                              {item.item_name}
                            </h4>
                            {item.description && (
                              <p className="text-zinc-500 text-[10px] line-clamp-2 leading-tight font-medium mb-3">
                                {item.description}
                              </p>
                            )}
                            <div className="mt-auto pt-2 border-t border-zinc-50 dark:border-zinc-900 flex justify-between items-center">
                              <div className="flex items-center gap-1.5 text-[9px] font-bold text-zinc-400 uppercase tracking-wider">
                                <Clock className="w-2.5 h-2.5" /> {new Date(item.created_at).toLocaleDateString()}
                              </div>
                              {item.reward && (
                                <span className="text-[9px] font-black text-amber-600 uppercase">
                                  {item.reward} TJS
                                </span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-24 border-2 border-dashed rounded-[40px] border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/10">
                      <div className="w-20 h-20 bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-100 dark:border-zinc-800 flex items-center justify-center mx-auto mb-6">
                        <PackageSearch className="w-10 h-10 text-zinc-200" />
                      </div>
                      <p className="text-zinc-400 text-[11px] font-black uppercase tracking-[0.2em]">{t('safetyBoxEmpty')}</p>
                      <Button 
                        onClick={() => setIsAddingSafetyItem(true)}
                        variant="outline" 
                        size="sm" 
                        className="mt-8 rounded-xl font-black uppercase text-[10px] tracking-widest px-8"
                      >
                        {t('addFirstItem')}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <TooltipProvider>
      <div className="container mx-auto px-4 py-8 min-h-[90vh]">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 lg:gap-12 items-start">
          {/* Left Sidebar - Sticky */}
          <div className="lg:col-span-1 lg:sticky lg:top-[100px] z-20 space-y-10">
            <div className="flex items-center gap-4 text-left">
              <div className="relative group shrink-0">
                <Avatar className="w-16 h-16 border-2 border-white dark:border-zinc-800 shadow-md rounded-xl transition-transform group-hover:scale-105">
                  <AvatarImage src={user?.imageUrl} />
                  <AvatarFallback className="bg-zinc-900 text-white text-xl font-black">
                    {user?.firstName?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="space-y-0.5 min-w-0">
                <h2 className="text-lg font-black tracking-tight uppercase leading-tight truncate">
                  {user?.fullName || t('user')}
                </h2>
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <Mail className="w-3 h-3 shrink-0" />
                  <span className="text-[10px] font-bold lowercase tracking-tight truncate">
                    {user?.primaryEmailAddress?.emailAddress}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {menuItems.map((item) => (
                <button 
                  key={item.id} 
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl transition-all group shadow-sm border",
                    activeTab === item.id 
                      ? "bg-zinc-900 border-zinc-900 text-white dark:bg-zinc-100 dark:border-zinc-100 dark:text-zinc-900 scale-[1.02] shadow-md" 
                      : "bg-white border-zinc-100 text-zinc-700 hover:border-zinc-300 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-lg transition-colors", 
                      activeTab === item.id ? "bg-white/20 text-white dark:bg-zinc-900/10 dark:text-zinc-900" : cn(item.bg, item.color)
                    )}>
                      <item.icon className="w-4 h-4" />
                    </div>
                    <span className="font-black text-[10px] uppercase tracking-wider">
                      {item.title}
                    </span>
                  </div>
                  <ChevronRight className={cn(
                    "w-4 h-4 transition-transform", 
                    activeTab === item.id ? "translate-x-1" : "text-zinc-300 group-hover:translate-x-0.5"
                  )} />
                </button>
              ))}
            </div>
            
            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-900">
              <SignOutButton>
                <Button variant="ghost" className="w-full h-11 rounded-xl font-black text-[10px] uppercase tracking-widest text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20 transition-all gap-2 justify-start px-4">
                  <LogOut className="w-4 h-4" />
                  {t('signOut')}
                </Button>
              </SignOutButton>
            </div>
          </div>

          {/* Right Content */}
          <div className="lg:col-span-3">
            <div className="min-h-[60vh]">
              {renderContent()}
            </div>
          </div>
        </div>
      </div>

      {/* Reusable Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog(prev => ({ ...prev, open: false }))}>
        <DialogContent className="sm:max-w-md rounded-3xl p-8 gap-6 border-none shadow-2xl">
          <DialogHeader className="space-y-3">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center mb-2",
              confirmDialog.variant === "destructive" ? "bg-red-50 dark:bg-red-900/20 text-red-600" : 
              confirmDialog.variant === "warning" ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600" : 
              "bg-blue-50 dark:bg-blue-900/20 text-blue-600"
            )}>
              {confirmDialog.variant === "destructive" ? <Trash2 className="w-6 h-6" /> : 
               confirmDialog.variant === "warning" ? <AlertTriangle className="w-6 h-6" /> : 
               <Send className="w-6 h-6" />}
            </div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">{confirmDialog.title}</DialogTitle>
            <DialogDescription className="text-zinc-500 font-medium text-sm leading-relaxed">
              {confirmDialog.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-3 sm:justify-start pt-2">
            <Button 
              type="button" 
              className={cn(
                "flex-1 h-12 rounded-xl font-black uppercase tracking-widest text-[10px]",
                confirmDialog.variant === "destructive" ? "bg-red-600 hover:bg-red-700" : "bg-zinc-900 hover:bg-zinc-800"
              )}
              onClick={() => {
                confirmDialog.onConfirm();
                setConfirmDialog(prev => ({ ...prev, open: false }));
              }}
            >
              {t('confirm')}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              className="flex-1 h-12 rounded-xl font-black uppercase tracking-widest text-[10px] border-zinc-200"
              onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
            >
              {t('cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

function Badge({ children, className, variant = "default" }: any) {
  return (
    <span className={cn(
      "px-2 py-0.5 rounded text-[10px] font-bold",
      variant === "default" ? "bg-zinc-900 text-white" : "border border-zinc-200 text-zinc-500",
      className
    )}>
      {children}
    </span>
  );
}
