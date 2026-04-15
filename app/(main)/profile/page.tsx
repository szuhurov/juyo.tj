"use client";

import { useEffect, useState, useRef } from "react";
import { useUser, SignOutButton, useAuth } from "@clerk/nextjs";
import { useLanguage } from "@/lib/language-context";
import { Item, ItemService, CATEGORIES } from "@/lib/services/item-service";
import { Profile, ProfileService } from "@/lib/services/profile-service";
import { ItemCard } from "@/components/item-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  AlertTriangle,
  Phone,
  Pencil,
  QrCode,
  Download,
  RefreshCw,
  Palette,
  Type,
  ChevronLeft
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
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

// QR Integration
import { QRCard } from "@/components/qr-editor/qr-card";
import { toPng } from "html-to-image";

import { useUserItems, useSavedItems, useSafetyItems, ITEM_KEYS } from "@/lib/hooks/use-items";
import { useQueryClient } from "@tanstack/react-query";

export default function ProfilePage() {
  const { user, isLoaded: userLoaded } = useUser();
  const { getToken, userId } = useAuth();
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "posts");
  const qrRef = useRef<HTMLDivElement | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  
  // Profile state
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  
  // States for QR Customization
  const [qrSettings, setQrSettings] = useState({
    qrColor: "#26ba90",
    bgColor: "#eefbf5",
    text: t('qrScanMe')
  });

  // Use TanStack Query for caching
  const [token, setToken] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (userId) {
      getToken({ template: 'supabase' }).then(setToken);
    }
  }, [userId, getToken]);

  const { data: myItems = [], isLoading: postsLoading } = useUserItems(userId || undefined, token);

  const { data: savedItems = [], isLoading: savedLoading } = useSavedItems(userId || undefined, token);
  const { data: safetyItems = [], isLoading: safetyLoading } = useSafetyItems(userId || undefined, token);

  // States for Safety Box
  const [safetySubmitting, setSafetySubmitting] = useState(false);
  const [safetyType, setSafetyType] = useState<'lost' | 'found'>('lost');
  const [safetyCategory, setSafetyCategory] = useState("");
  const [safetyImages, setSafetyImages] = useState<File[]>([]);
  const [safetyPreviews, setSafetyPreviews] = useState<string[]>([]);
  const [isAddingSafetyItem, setIsAddingSafetyItem] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [selectedSafetyItem, setSelectedSafetyItem] = useState<any>(null);
  const [editingSafetyItem, setEditingSafetyItem] = useState<any>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Load Profile from Supabase
  useEffect(() => {
    const loadProfile = async () => {
      if (!userId) return;
      try {
        const token = await getToken({ template: 'supabase' });
        const supabase = createClerkSupabaseClient(token!);
        const data = await ProfileService.getProfile(supabase, userId);
        setProfile(data);
        
        // Mandatory phone check
        if (data && !data.phone) {
          setShowPhoneModal(true);
        }
      } catch (err) {
        console.error("Error loading profile:", err);
      } finally {
        setProfileLoading(false);
      }
    };
    loadProfile();
  }, [userId, getToken]);

  // Sync tab with URL
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["posts", "info", "saved", "safety", "qr"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    const params = new URLSearchParams(searchParams);
    params.set("tab", tabId);
    router.push(`/profile?${params.toString()}`, { scroll: false });
  };

  // Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    variant: "default" | "destructive" | "warning";
    isLoading?: boolean;
  }>({
    open: false,
    title: "",
    description: "",
    onConfirm: () => {},
    variant: "default"
  });

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
      id: "qr",
      title: t('qrMyCode'),
      icon: QrCode,
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-900/20"
    },
    {
      id: "saved",
      title: t('savedItems'),
      icon: Bookmark,
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-950/20"
    },
    {
      id: "safety",
      title: t('mySafe'),
      icon: Briefcase,
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-900/20"
    }
  ];

  // Listen for global item updates and invalidate queries
  useEffect(() => {
    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    };
    window.addEventListener('saved-items-updated', handleUpdate);
    window.addEventListener('items-updated', handleUpdate);
    return () => {
      window.removeEventListener('saved-items-updated', handleUpdate);
      window.removeEventListener('items-updated', handleUpdate);
    };
  }, [queryClient]);

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

    setSafetySubmitting(true);
    try {
      const imageUrls = [];
      for (const file of safetyImages) {
        // Refetch token for each upload to prevent expiration during long uploads
        const uploadToken = await getToken({ template: 'supabase' });
        const uploadSupabase = createClerkSupabaseClient(uploadToken!);
        
        const ext = file.name.split('.').pop();
        const fileName = `safety-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        const { error: uploadError } = await uploadSupabase.storage.from('items').upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = uploadSupabase.storage.from('items').getPublicUrl(fileName);
        imageUrls.push(publicUrl);
      }

      // Final token for the database record insertion
      const dbToken = await getToken({ template: 'supabase' });
      const supabase = createClerkSupabaseClient(dbToken!);

      const { data, error } = await supabase
        .from('safety_box')
        .insert([{ 
          user_id: userId, 
          item_name: name, 
          category: safetyCategory,
          type: safetyType,
          description,
          phone_number: phone,
          reward: reward ? `${reward}` : null,
          images: imageUrls
        }])
        .select()
        .single();

      if (error) throw error;
      
      // Update cache using TanStack Query
      queryClient.invalidateQueries({ queryKey: ITEM_KEYS.safetyItems(userId || "", token) });
      
      toast.success(t('success'));
      setSafetyImages([]);
      setSafetyPreviews([]);
      setSafetyCategory("");
      setSafetyType('lost');
      setIsAddingSafetyItem(false);
    } catch (error: any) {
      console.error("Detailed Safety Box Error:", error);
      const errorMsg = error.message || "Unknown error";
      const errorCode = error.code || "No code";
      toast.error(`Хатогӣ: ${errorMsg} (Код: ${errorCode})`);
    } finally {
      setSafetySubmitting(false);
    }
  };

  const handleUpdateSafetyItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingSafetyItem) return;

    const formData = new FormData(e.currentTarget);
    const name = (formData.get('name') as string).trim();
    const description = (formData.get('description') as string).trim();
    const phone = (formData.get('phone') as string).trim();
    const reward = (formData.get('reward') as string).trim();

    setSafetySubmitting(true);
    try {
      const supabaseToken = await getToken({ template: 'supabase' });
      if (!supabaseToken) throw new Error("No authentication token");
      
      const supabase = createClerkSupabaseClient(supabaseToken);

      // Existing images + new uploads
      let imageUrls = [...(editingSafetyItem.images || [])];
      
      if (safetyImages.length > 0) {
        for (const file of safetyImages) {
          const ext = file.name.split('.').pop();
          const fileName = `safety-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
          const { error: uploadError } = await supabase.storage.from('items').upload(fileName, file);
          if (uploadError) throw uploadError;
          const { data: { publicUrl } } = supabase.storage.from('items').getPublicUrl(fileName);
          imageUrls.push(publicUrl);
        }
      }

      const { data, error } = await supabase
        .from('safety_box')
        .update({ 
          item_name: name, 
          category: safetyCategory,
          type: safetyType,
          description,
          phone_number: phone,
          reward: reward ? `${reward}` : null,
          images: imageUrls
        })
        .eq('id', editingSafetyItem.id)
        .select()
        .single();

      if (error) {
        console.error("Supabase Update Error:", error);
        throw error;
      }
      
      // Update cache using TanStack Query - use the state token for consistency
      queryClient.invalidateQueries({ queryKey: ITEM_KEYS.safetyItems(userId || "", token) });
      
      toast.success(t('success'));
      setEditingSafetyItem(null);
      setSafetyImages([]);
      setSafetyPreviews([]);
    } catch (error: any) {
      console.error("Detailed Safety Box Error:", error);
      const errorMsg = error.message || error.details || "Unknown error";
      toast.error(`Хатогӣ: ${errorMsg}`);
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
      isLoading: false,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isLoading: true }));
        try {
          const token = await getToken({ template: 'supabase' });
          const supabase = createClerkSupabaseClient(token!);

          const item = await ItemService.publishFromSafetyBox(supabase, safetyItem, userId!);

          // Trigger Moderation (Async) - Server handles DB update
          if (safetyItem.images && safetyItem.images.length > 0) {
            const moderationImages = Array.isArray(safetyItem.images) 
              ? safetyItem.images 
              : [safetyItem.images];

            fetch('/api/moderate', {
              method: 'POST',
              body: JSON.stringify({ imageUrls: moderationImages, itemId: item.id }),
              headers: { 'Content-Type': 'application/json' }
            }).catch(err => console.error('Moderation trigger error:', err));
          }

          // Update cache using TanStack Query
          queryClient.invalidateQueries({ queryKey: ITEM_KEYS.safetyItems(userId || "", token) });
          queryClient.invalidateQueries({ queryKey: ITEM_KEYS.userItems(userId || "", token) });
          
          toast.success(t('imageModeration.submitted'));
          setConfirmDialog(prev => ({ ...prev, open: false }));
        } catch (error: any) {
          toast.error(error.message || t('error'));
        } finally {
          setConfirmDialog(prev => ({ ...prev, isLoading: false }));
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
      isLoading: false,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isLoading: true }));
        try {
          const token = await getToken({ template: 'supabase' });
          const supabase = createClerkSupabaseClient(token!);
          const { error } = await supabase.from('safety_box').delete().eq('id', id);
          if (error) throw error;
          
          // Update cache using TanStack Query
          queryClient.invalidateQueries({ queryKey: ITEM_KEYS.safetyItems(userId || "", token) });
          
          toast.success(t('success'));
          setConfirmDialog(prev => ({ ...prev, open: false }));
        } catch (error) {
          toast.error(t('error'));
        } finally {
          setConfirmDialog(prev => ({ ...prev, isLoading: false }));
        }
      }
    });
  };

  const startEditing = (item: any) => {
    setEditingSafetyItem(item);
    setSafetyType(item.type || 'lost');
    setSafetyCategory(item.category);
    setSafetyPreviews(item.images || []);
    setSafetyImages([]);
  };

  const handleDownloadQR = async () => {
    if (!qrRef.current) return;
    
    setIsDownloading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      const dataUrl = await toPng(qrRef.current, {
        cacheBust: true,
        pixelRatio: 3,
      });
      const link = document.createElement('a');
      link.download = `juyo-qr-${user?.id || 'code'}.png`;
      link.href = dataUrl;
      link.click();
      toast.success(t('qrSavedSuccess'));
    } catch (err) {
      toast.error(t('error'));
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSavePhoneModal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const phone = (formData.get('phone') as string).trim();
    
    if (phone.length < 9) {
      toast.error(t('phoneMinLength'));
      return;
    }

    setSafetySubmitting(true);
    try {
      const token = await getToken({ template: 'supabase' });
      const supabase = createClerkSupabaseClient(token!);
      
      const updated = await ProfileService.updateProfile(supabase, userId!, {
        phone,
        first_name: user?.firstName || "",
        last_name: user?.lastName || "",
        avatar_url: user?.imageUrl || ""
      });
      
      setProfile(updated);
      setShowPhoneModal(false);
      toast.success(t('phoneSaved'));
    } catch (err) {
      toast.error(t('error'));
    } finally {
      setSafetySubmitting(false);
    }
  };

  if (!userLoaded) return null;

  const renderContent = () => {
    switch (activeTab) {
      case "posts":
        return (
          <div className="space-y-6">
            <div className="sticky top-[64px] z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md pt-4 pb-4 px-4 mb-6 -mx-4 border-b border-zinc-100 dark:border-zinc-900">
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
                </div>
              </div>
            </div>

            <div className="animate-in fade-in duration-500">
              {postsLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6 px-1">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-2xl" />)}
                </div>
              ) : myItems.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6 px-1">
                  {myItems.map((item) => (
                    <ItemCard key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 mx-1">
                  <PackageSearch className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                  <h4 className="font-bold text-zinc-400 uppercase text-xs tracking-widest">{t('noItemsFound')}</h4>
                </div>
              )}
            </div>
          </div>
        );
      
      case "qr":
        return (
          <div className="space-y-8 pb-20">
            <div className="sticky top-[64px] z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md pt-4 pb-4 px-4 mb-6 -mx-4 border-b border-zinc-100 dark:border-zinc-900">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black uppercase tracking-tight">{t('qrMyCode')}</h3>
                <Button 
                  onClick={handleDownloadQR}
                  disabled={isDownloading}
                  className="rounded-lg h-9 px-6 font-black uppercase text-[10px] tracking-widest gap-2 bg-zinc-900 text-white shadow-md hover:bg-zinc-800"
                >
                  {isDownloading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  {t('save')}
                </Button>
              </div>
            </div>

            <div className="animate-in fade-in duration-500 space-y-8">
              <div className="px-2">
                <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-5 flex gap-4 items-center w-full mb-8">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400 font-bold uppercase tracking-tight leading-normal">
                    {t('qrStickerText')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-stretch px-2">
                {/* Left: QR Code Preview */}
                <div className="flex flex-col">
                  <div className="bg-zinc-100 dark:bg-zinc-900 rounded-[3rem] p-12 flex items-center justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 w-full h-full overflow-hidden">
                    <QRCard 
                      id={user?.id || ""} 
                      settings={{
                        qrColor: qrSettings.qrColor,
                        bgColor: qrSettings.bgColor,
                        borderRadius: "medium",
                        shadow: "soft",
                        hasBorder: false,
                        pattern: "none",
                        text: qrSettings.text
                      }} 
                      innerRef={qrRef}
                    />
                  </div>
                </div>

                {/* Right: Controls */}
                <div className="bg-zinc-50 dark:bg-zinc-900/30 p-8 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col justify-center">
                  <div className="space-y-8">
                    {/* Color Section */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Palette className="w-4 h-4 text-zinc-400" />
                        <h4 className="font-black uppercase text-[10px] tracking-[0.2em] text-zinc-400">{t('qrColors')}</h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest ml-1">{t('qrColorLabel')}</Label>
                          <div className="flex items-center gap-3 bg-white dark:bg-zinc-950 p-2 rounded-xl border border-zinc-100 dark:border-zinc-800">
                            <input 
                              type="color" 
                              value={qrSettings.qrColor} 
                              onChange={(e) => setQrSettings({...qrSettings, qrColor: e.target.value})}
                              className="w-10 h-10 rounded-lg cursor-pointer border-none p-0 bg-transparent shrink-0"
                            />
                            <Input 
                              value={qrSettings.qrColor} 
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val.startsWith('#') && val.length <= 7) {
                                  setQrSettings({...qrSettings, qrColor: val});
                                }
                              }}
                              className="h-8 border-none bg-transparent font-mono font-bold text-[10px] uppercase text-zinc-500 focus-visible:ring-0 p-0"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest ml-1">{t('qrBgLabel')}</Label>
                          <div className="flex items-center gap-3 bg-white dark:bg-zinc-950 p-2 rounded-xl border border-zinc-100 dark:border-zinc-800">
                            <input 
                              type="color" 
                              value={qrSettings.bgColor} 
                              onChange={(e) => setQrSettings({...qrSettings, bgColor: e.target.value})}
                              className="w-10 h-10 rounded-lg cursor-pointer border-none p-0 bg-transparent shrink-0"
                            />
                            <Input 
                              value={qrSettings.bgColor} 
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val.startsWith('#') && val.length <= 7) {
                                  setQrSettings({...qrSettings, bgColor: val});
                                }
                              }}
                              className="h-8 border-none bg-transparent font-mono font-bold text-[10px] uppercase text-zinc-500 focus-visible:ring-0 p-0"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Text Section */}
                    <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Type className="w-4 h-4 text-zinc-400" />
                        <h4 className="font-black uppercase text-[10px] tracking-[0.2em] text-zinc-400">{t('qrStickerText')}</h4>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest ml-1">{t('qrFooterText')}</Label>
                        <Input 
                          value={qrSettings.text} 
                          onChange={(e) => setQrSettings({...qrSettings, text: e.target.value})}
                          className="h-12 rounded-xl bg-white dark:bg-zinc-950 font-bold text-sm"
                          placeholder={t('qrInputPlaceholder')}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "info":
        return (
          <div className="space-y-12 pb-20">
            <div className="sticky top-[64px] z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md pt-4 pb-4 px-4 mb-6 -mx-4 border-b border-zinc-100 dark:border-zinc-900">
              <h3 className="text-lg font-black uppercase tracking-tight">{t('personalInfo')}</h3>
            </div>
            
            <div className="animate-in slide-in-from-right-4 duration-500 max-w-2xl px-2 space-y-12">
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
                    key={profile?.id || 'new'}
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const firstName = formData.get('firstName') as string;
                      const lastName = formData.get('lastName') as string;
                      const phone = formData.get('phone') as string;
                      
                      setSafetySubmitting(true);
                      try {
                        // 1. Update Clerk (Name)
                        try {
                          await user?.update({ firstName, lastName });
                        } catch (clerkErr) {
                          console.error("Clerk Update Error:", clerkErr);
                        }
                        
                        // 2. Update Supabase (Full Profile)
                        const token = await getToken({ template: 'supabase' });
                        if (!token) throw new Error("Authentication token not found");
                        
                        const supabase = createClerkSupabaseClient(token);
                        const updated = await ProfileService.updateProfile(supabase, userId!, {
                          first_name: firstName,
                          last_name: lastName,
                          phone,
                          avatar_url: user?.imageUrl || ""
                        });
                        setProfile(updated);
                        
                        toast.success(t('profileUpdated'));
                      } catch (err: any) {
                        console.error("Profile Update Error:", err);
                        toast.error(err.message || t('error'));
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

                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest ml-1">{t('phoneLabel')}</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                        <Input 
                          name="phone" 
                          placeholder={t('phonePlaceholder')}
                          defaultValue={profile?.phone || ""} 
                          className="h-10 pl-9 rounded-xl bg-white dark:bg-zinc-950 font-bold"
                          inputMode="numeric"
                          onChange={(e) => e.target.value = e.target.value.replace(/[^0-9]/g, '')}
                        />
                      </div>
                    </div>

                    <Button type="submit" size="sm" disabled={safetySubmitting} className="rounded-lg bg-zinc-900 text-white font-black uppercase text-[9px] tracking-widest px-6 w-full sm:w-auto">
                      {safetySubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : t('save')}
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
          <div className="space-y-6">
            <div className="sticky top-[64px] z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md pt-4 pb-4 px-4 mb-6 -mx-4 border-b border-zinc-100 dark:border-zinc-900">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black uppercase tracking-tight">{t('savedItems')}</h3>
                <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-900 text-white">
                  {savedItems.length}
                </div>
              </div>
            </div>

            <div className="animate-in fade-in duration-500">
              {savedLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6 px-1">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-2xl" />)}
                </div>
              ) : savedItems.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6 px-1">
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
          </div>
        );

      case "safety":
        return (
          <div className="space-y-8">
            <div className="sticky top-[64px] z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md pt-4 pb-4 px-4 mb-6 -mx-4 border-b border-zinc-100 dark:border-zinc-900">
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

            <div className="animate-in fade-in duration-500 max-w-4xl mx-auto px-2">
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
                      <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">{t('what_happened')}</Label>
                        <RadioGroup 
                          defaultValue="lost" 
                          onValueChange={(val) => setSafetyType(val as 'lost' | 'found')}
                          className="grid grid-cols-2 gap-4"
                        >
                          <div>
                            <RadioGroupItem value="lost" id="safety-lost" className="peer sr-only" />
                            <Label
                              htmlFor="safety-lost"
                              className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-zinc-50 peer-data-[state=checked]:border-red-600 peer-data-[state=checked]:bg-red-50 cursor-pointer transition-all"
                            >
                              <span className="text-2xl mb-1">🔍</span>
                              <span className="font-bold text-xs uppercase">{t('lost')}</span>
                            </Label>
                          </div>
                          <div>
                            <RadioGroupItem value="found" id="safety-found" className="peer sr-only" />
                            <Label
                              htmlFor="safety-found"
                              className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-zinc-50 peer-data-[state=checked]:border-emerald-600 peer-data-[state=checked]:bg-emerald-50 cursor-pointer transition-all"
                            >
                              <span className="text-2xl mb-1">🎁</span>
                              <span className="font-bold text-xs uppercase">{t('found')}</span>
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>

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
                  <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-5 flex gap-4 items-start animate-in fade-in slide-in-from-top-2 duration-700">
                    <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-emerald-900 dark:text-emerald-200 font-bold leading-tight uppercase tracking-tight mb-1">{t('importantInfo')}</p>
                      <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400 font-medium leading-normal">
                        {t('importantInfoDesc')}
                      </p>
                    </div>
                  </div>

                  {safetyLoading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                      {[...Array(3)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-2xl" />)}
                    </div>
                  ) : safetyItems.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                      {safetyItems.map((item) => (
                        <Card 
                          key={item.id} 
                          className="overflow-hidden hover:shadow-md transition-shadow duration-300 group flex flex-col h-full rounded-xl border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 cursor-pointer"
                          onClick={() => setSelectedSafetyItem(item)}
                        >
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
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handlePublishSafetyItem(item);
                                      }}
                                      disabled={isActionLoading}
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
                                      className="h-7 w-7 rounded-lg bg-white/90 backdrop-blur text-amber-600 hover:bg-amber-600 hover:text-white shadow-sm border-none transition-all"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        startEditing(item);
                                      }}
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{t('edit')}</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      variant="secondary" 
                                      size="icon" 
                                      className="h-7 w-7 rounded-lg bg-white/90 backdrop-blur text-red-500 hover:bg-red-500 hover:text-white shadow-sm border-none transition-all"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteSafetyItem(item.id);
                                      }}
                                      disabled={isActionLoading}
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
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Left Sidebar - Fixed on Desktop - Hidden on mobile */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-[100px] h-fit z-20 space-y-6">
              <div className="flex flex-col gap-3">
                {menuItems.map((item) => (
                  <button 
                    key={item.id} 
                    onClick={() => handleTabChange(item.id)}
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
                confirmDialog.variant === "destructive" ? "bg-red-600 hover:bg-red-700 text-white" : "bg-zinc-900 hover:bg-zinc-800"
              )}
              onClick={() => {
                confirmDialog.onConfirm();
              }}
              disabled={isActionLoading || confirmDialog.isLoading}
            >
              {(isActionLoading || confirmDialog.isLoading) ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                confirmDialog.variant === "destructive" ? (t('delete') || 'Нест кардан') : (t('confirm') || 'Тасдиқ')
              )}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              className="flex-1 h-12 rounded-xl font-black uppercase tracking-widest text-[10px] border-zinc-200"
              onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
              disabled={isActionLoading || confirmDialog.isLoading}
            >
              {t('cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Safety Item Details Dialog */}
      <Dialog open={!!selectedSafetyItem} onOpenChange={(open) => {
        if (!open) {
          setSelectedSafetyItem(null);
          setCurrentImageIndex(0);
        }
      }}>
        <DialogContent className="sm:max-w-4xl rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl max-h-[90vh] overflow-y-auto">
          {selectedSafetyItem && (
            <div className="grid grid-cols-1 md:grid-cols-2">
                <div className="relative aspect-square bg-zinc-100 dark:bg-zinc-900 group">
                  {selectedSafetyItem.images?.[currentImageIndex] ? (
                    <Image 
                      src={selectedSafetyItem.images[currentImageIndex]} 
                      alt={selectedSafetyItem.item_name} 
                      fill 
                      className="object-cover animate-in fade-in duration-300" 
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full"><PackageSearch className="w-24 h-24 text-zinc-200" /></div>
                  )}

                  {/* Image Navigation */}
                  {selectedSafetyItem.images && selectedSafetyItem.images.length > 1 && (
                    <>
                      <div className="absolute inset-y-0 left-0 flex items-center pl-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/40 text-white shadow-sm border-none transition-all opacity-0 group-hover:opacity-100"
                          onClick={() => setCurrentImageIndex(prev => (prev === 0 ? selectedSafetyItem.images.length - 1 : prev - 1))}
                        >
                          <ChevronLeft className="w-6 h-6" />
                        </Button>
                      </div>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/40 text-white shadow-sm border-none transition-all opacity-0 group-hover:opacity-100"
                          onClick={() => setCurrentImageIndex(prev => (prev === selectedSafetyItem.images.length - 1 ? 0 : prev + 1))}
                        >
                          <ChevronRight className="w-6 h-6" />
                        </Button>
                      </div>
                      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                        {selectedSafetyItem.images.map((_: any, i: number) => (
                          <div 
                            key={i} 
                            className={cn(
                              "h-1.5 transition-all duration-300 rounded-full shadow-sm",
                              i === currentImageIndex ? "w-6 bg-white" : "w-1.5 bg-white/40"
                            )} 
                          />
                        ))}
                      </div>
                    </>
                  )}

                  <div className="absolute top-6 left-6 flex flex-col gap-2 z-10">
                    <Badge className={cn("uppercase font-black rounded-md px-3 py-1 shadow-md border-none", selectedSafetyItem.type === 'lost' ? "bg-red-600 text-white" : "bg-emerald-600 text-white")}>
                      {selectedSafetyItem.type === 'lost' ? t('lost') : t('found')}
                    </Badge>
                    {selectedSafetyItem.reward && (
                      <Badge className="max-[632px]:flex hidden bg-amber-400 text-amber-950 font-black rounded-md px-3 py-1 shadow-md border-none whitespace-nowrap">
                        {selectedSafetyItem.type === 'lost' ? t('reward_gives_viewer') : t('reward_wants_viewer')} {selectedSafetyItem.reward} TJS
                      </Badge>
                    )}
                  </div>
                  {selectedSafetyItem.reward && (
                    <Badge className="max-[632px]:hidden absolute bottom-6 right-6 bg-amber-400 text-amber-950 font-black rounded-md px-3 py-1 shadow-md border-none whitespace-nowrap z-10">
                      {selectedSafetyItem.type === 'lost' ? t('reward_gives_viewer') : t('reward_wants_viewer')} {selectedSafetyItem.reward} TJS
                    </Badge>
                  )}
                  <Button variant="ghost" size="icon" className="absolute top-6 right-6 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/40 text-white z-10" onClick={() => setSelectedSafetyItem(null)}><X className="w-5 h-5" /></Button>
                </div>
              
              <div className="p-10 flex flex-col">
                <div className="flex justify-between items-center mb-6 pb-6 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm">
                      <Avatar className="w-full h-full"><AvatarImage src={user?.imageUrl} /><AvatarFallback><User className="w-6 h-6 text-zinc-400" /></AvatarFallback></Avatar>
                    </div>
                    <div>
                      <p className="font-black text-sm leading-tight uppercase tracking-tight">{user?.firstName || t('user')}</p>
                      <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest mt-0.5">{user?.lastName || ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-black uppercase tracking-widest">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" /> {t('private')}
                  </div>
                </div>

                <div className="flex justify-between items-center mb-4">
                  <Badge variant="outline" className="uppercase tracking-widest text-[10px] rounded-md px-2 py-1 font-black border-zinc-200">
                    {t(`categories.${CATEGORIES.find(c => c.name === selectedSafetyItem.category)?.id || '6'}`)}
                  </Badge>
                  <div className="flex items-center gap-2 text-zinc-400 text-[10px] font-black uppercase tracking-widest">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{new Date(selectedSafetyItem.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <DialogTitle className="text-4xl font-black tracking-tighter uppercase leading-none mb-6">{selectedSafetyItem.item_name}</DialogTitle>

                {selectedSafetyItem.reward && (
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-2xl p-5 mb-8 shadow-sm">
                    <p className="text-amber-600 dark:text-amber-400 font-black text-[10px] uppercase tracking-widest mb-1 leading-tight">
                      {selectedSafetyItem.type === 'lost' ? t('reward_gives_viewer') : t('reward_wants_viewer')}
                    </p>
                    <p className="text-3xl font-black text-amber-900 dark:text-amber-100 tracking-tight">
                      {selectedSafetyItem.reward} <span className="text-xl">TJS</span>
                    </p>
                  </div>
                )}

                <div className="mb-8">
                  <h3 className="font-black text-[10px] uppercase tracking-widest text-zinc-400 mb-4">{t('description')}</h3>
                  <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed text-base whitespace-pre-wrap font-medium">
                    {selectedSafetyItem.description}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 mb-10">
                  <div className="flex flex-col gap-2 items-center">
                    <Button variant="secondary" size="icon" className="h-16 w-16 rounded-2xl bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-900/50 dark:text-zinc-400 border border-zinc-100 dark:border-zinc-800 transition-all active:scale-95 shadow-sm" onClick={() => { setSelectedSafetyItem(null); startEditing(selectedSafetyItem); }}>
                      <Pencil className="w-7 h-7" />
                    </Button>
                    <span className="text-[9px] font-black uppercase text-zinc-500 tracking-tighter">{t('edit')}</span>
                  </div>
                  <div className="flex flex-col gap-2 items-center">
                    <Button variant="secondary" size="icon" className="h-16 w-16 rounded-2xl bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/10 dark:text-red-400 border border-red-100/50 dark:border-red-900/30 transition-all active:scale-95 shadow-sm" onClick={() => { setSelectedSafetyItem(null); deleteSafetyItem(selectedSafetyItem.id); }}><Trash2 className="w-7 h-7" /></Button>
                    <span className="text-[9px] font-black uppercase text-red-600/70 tracking-tighter">{t('delete')}</span>
                  </div>
                </div>

                <div className="mt-auto flex flex-col sm:flex-row gap-4">
                  <Button className="flex-1 h-16 rounded-2xl font-black gap-3 bg-zinc-900 text-white shadow-xl uppercase tracking-widest transition-all active:scale-95" asChild>
                    <a href={`tel:${selectedSafetyItem.phone_number}`}><Phone className="w-5 h-5" /> {t('call')}</a>
                  </Button>
                  <Button variant="outline" className="flex-1 h-16 rounded-2xl font-black gap-3 uppercase tracking-widest border-zinc-200 transition-all active:scale-95" onClick={() => handlePublishSafetyItem(selectedSafetyItem)} disabled={isActionLoading}>
                    <Send className="w-5 h-5" /> {t('publishItem')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Safety Item Edit Dialog */}
      <Dialog open={!!editingSafetyItem} onOpenChange={(open) => !open && setEditingSafetyItem(null)}>
        <DialogContent className="sm:max-w-xl rounded-3xl p-8 border-none shadow-2xl overflow-y-auto max-h-[90vh]">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
              <Pencil className="w-6 h-6 text-amber-500" /> {t('edit')}
            </DialogTitle>
          </DialogHeader>
          {editingSafetyItem && (
            <form onSubmit={handleUpdateSafetyItem} className="space-y-6">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">{t('what_happened')}</Label>
                <RadioGroup 
                  defaultValue={editingSafetyItem.type || 'lost'} 
                  onValueChange={(val) => setSafetyType(val as 'lost' | 'found')}
                  className="grid grid-cols-2 gap-4"
                >
                  <div>
                    <RadioGroupItem value="lost" id="edit-safety-lost" className="peer sr-only" />
                    <Label
                      htmlFor="edit-safety-lost"
                      className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-zinc-50 peer-data-[state=checked]:border-red-600 peer-data-[state=checked]:bg-red-50 cursor-pointer transition-all"
                    >
                      <span className="text-2xl mb-1">🔍</span>
                      <span className="font-bold text-xs uppercase">{t('lost')}</span>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="found" id="edit-safety-found" className="peer sr-only" />
                    <Label
                      htmlFor="edit-safety-found"
                      className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-zinc-50 peer-data-[state=checked]:border-emerald-600 peer-data-[state=checked]:bg-emerald-50 cursor-pointer transition-all"
                    >
                      <span className="text-2xl mb-1">🎁</span>
                      <span className="font-bold text-xs uppercase">{t('found')}</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="edit-name" className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">{t('safetyItemNameLabel')}</Label>
                  <Input id="edit-name" name="name" defaultValue={editingSafetyItem.item_name} className="rounded-xl h-12 text-sm bg-zinc-50/50 dark:bg-zinc-900/50" required />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">{t('categoryLabel')}</Label>
                  <Select onValueChange={setSafetyCategory} required defaultValue={editingSafetyItem.category}>
                    <SelectTrigger className="h-12 rounded-xl text-sm bg-zinc-50/50 dark:bg-zinc-900/50">
                      <SelectValue placeholder={t('categoryLabel')} />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.id} value={cat.name}>{cat.icon} {t(`categories.${cat.id}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="edit-phone" className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">{t('phoneLabel')}</Label>
                  <Input id="edit-phone" name="phone" defaultValue={editingSafetyItem.phone_number} className="rounded-xl h-12 text-sm bg-zinc-50/50 dark:bg-zinc-900/50" required type="text" inputMode="numeric" onChange={(e) => e.target.value = e.target.value.replace(/[^0-9]/g, '')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-reward" className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">{t('rewardLabel')}</Label>
                  <Input id="edit-reward" name="reward" defaultValue={editingSafetyItem.reward || ""} className="rounded-xl h-12 text-sm bg-zinc-50/50 dark:bg-zinc-900/50" type="text" inputMode="numeric" onChange={(e) => e.target.value = e.target.value.replace(/[^0-9]/g, '')} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description" className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">{t('description')}</Label>
                <Textarea id="edit-description" name="description" defaultValue={editingSafetyItem.description} className="rounded-xl min-h-[120px] text-sm resize-none bg-zinc-50/50 dark:bg-zinc-900/50" required />
              </div>

              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">{t('addImages')} ({safetyPreviews.length}/5)</Label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  {safetyPreviews.map((src, i) => (
                    <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border-2 border-zinc-100 dark:border-zinc-800 shadow-sm">
                      <Image src={src} alt="Preview" fill className="object-cover" />
                      <button type="button" onClick={() => {
                        // Handle removal of existing and new images
                        const isExisting = editingSafetyItem.images?.includes(src);
                        if (isExisting) {
                          setEditingSafetyItem({
                            ...editingSafetyItem,
                            images: editingSafetyItem.images.filter((img: string) => img !== src)
                          });
                        } else {
                          const newFileIdx = safetyImages.findIndex(f => URL.createObjectURL(f) === src);
                          if (newFileIdx !== -1) {
                            setSafetyImages(prev => prev.filter((_, idx) => idx !== newFileIdx));
                          }
                        }
                        setSafetyPreviews(prev => prev.filter((_, idx) => idx !== i));
                      }} className="absolute top-1.5 right-1.5 bg-red-500 text-white p-1 rounded-full shadow-md hover:bg-red-600 transition-colors"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                  {safetyPreviews.length < 5 && (
                    <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all group">
                      <Upload className="w-6 h-6 text-zinc-300 group-hover:text-zinc-500 transition-colors" />
                      <span className="text-[8px] font-black uppercase text-zinc-400 mt-2">{t('add')}</span>
                      <input type="file" className="hidden" accept="image/*" multiple onChange={handleSafetyImageChange} />
                    </label>
                  )}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button type="submit" className="flex-1 rounded-xl h-14 font-black uppercase tracking-wider text-xs bg-zinc-900 text-white hover:bg-zinc-800" disabled={safetySubmitting}>
                  {safetySubmitting ? <Loader2 className="animate-spin w-5 h-5" /> : t('saveName')}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditingSafetyItem(null)} className="rounded-xl h-14 px-8 font-black uppercase tracking-wider text-xs">
                  {t('cancel')}
                </Button>
              </div>
            </form>
          )}
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
