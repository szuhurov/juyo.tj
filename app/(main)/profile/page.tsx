/**
 * Ин саҳифаи Профили корбар ҳаст. 
 * Дар ин ҷо корбар метавонад эълонҳои худро идора кунад, маълумоти шахсиашро иваз кунад,
 * QR-коди худро созад ва ашёҳояшро дар "Қуттии бехатарӣ" (Safety Box) нигоҳ дорад.
 */

"use client";

import { useEffect, useState, useRef, Suspense } from "react"; // Барои идоракунии вақт, ҳолат ва боргирии саҳифа
import { useUser, SignOutButton, useAuth } from "@clerk/nextjs"; // Барои кор бо маълумоти корбари воридшуда ва баромад аз сайт
import { useLanguage } from "@/lib/language-context"; // Барои идоракунии забони интерфейс
import { Item, ItemService, CATEGORIES } from "@/lib/services/item-service"; // Барои кор бо хизматрасониҳои эълонҳо ва категорияҳо
import { Profile, ProfileService } from "@/lib/services/profile-service"; // Барои идоракунии маълумоти шахсии корбар
import { ItemCard } from "@/components/item-card"; // Барои нишон додани карточкаҳои эълонҳо
import { Button } from "@/components/ui/button"; // Компоненти тугма
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Барои сохтани блокҳои иттилоотӣ
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // Барои нишон додани сурати корбар
import { Skeleton } from "@/components/ui/skeleton"; // Барои ҳолати боргирии муваққатӣ
import { Input } from "@/components/ui/input"; // Майдони воридкунии матн
import { Label } from "@/components/ui/label"; // Сарлавҳаҳо барои майдонҳои форма
import { Textarea } from "@/components/ui/textarea"; // Майдони воридкунии матни калон
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Рӯйхати интихобшаванда
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"; // Гурӯҳи интихобкунандаҳо
import { createClerkSupabaseClient } from "@/lib/supabase"; // Барои пайваст шудан ба базаи Supabase
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
} from "lucide-react"; // Иконкаҳои гуногун барои интерфейс
import Link from "next/link"; // Барои пайвандҳо ба саҳифаҳои дигар
import Image from "next/image"; // Барои нишон додани суратҳои оптимизатсияшуда
import { useRouter, useSearchParams } from "next/navigation"; // Барои идоракунии адрес ва параметрҳои URL
import { cn } from "@/lib/utils"; // Барои пайваст кардани классҳои CSS
import { toast } from "sonner"; // Барои нишон додани огоҳиномаҳо
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"; // Барои нишон додани маслиҳатҳои кӯтоҳ
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"; // Барои тирезаҳои тасдиқкунанда (модалкаҳо)

// Интеграцияи QR
import { QRCard } from "@/components/qr-editor/qr-card"; // Компонент барои сохтани QR-код
import { toPng } from "html-to-image"; // Барои табдил додани HTML ба сурати PNG
import { HexColorPicker } from "react-colorful"; // Барои интихоби ранги QR-код
import { compressImage } from "@/lib/image-utils"; // Барои фишурдани суратҳо

import { useUserItems, useSavedItems, useSafetyItems, ITEM_KEYS } from "@/lib/hooks/use-items"; // Хукҳои махсус барои гирифтани ашёҳо аз база
import { useQueryClient } from "@tanstack/react-query"; // Барои идоракунии кэши маълумотҳо

function ProfileContent() {
  // Хукҳо барои гирифтани маълумоти корбар ва забони сайт
  const { user, isLoaded: userLoaded } = useUser();
  const { getToken, userId } = useAuth();
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  
  // Стейтҳо барои идоракунии табҳо (вкладки) ва танзимоти QR
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "posts");
  const qrRef = useRef<HTMLDivElement | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [activePicker, setActivePicker] = useState<"qr" | "bg" | null>(null);
  
  // Стейтҳо барои нигоҳ доштани маълумоти профил ва нишон додани модалҳо
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  
  // Стейт барои танзимоти намуди зоҳирии QR-код (рангҳо ва текст)
  const [qrSettings, setQrSettings] = useState({
    qrColor: "#26ba90",
    bgColor: "#eefbf5",
    text: t('qrScanMe')
  });

  // Гирифтани токени базаи додаҳо барои ин корбар
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    const fetchToken = async () => {
      if (userId) {
        const t = await getToken({ template: 'supabase' });
        setToken(t);
      }
    };
    fetchToken();
  }, [userId]);

  // Гирифтани рӯйхати эълонҳо, ашёҳои захирашуда ва ашёҳои "Қуттии бехатарӣ"
  const { data: myItems = [], isLoading: postsLoading } = useUserItems(userId || undefined, token);
  const { data: savedItems = [], isLoading: savedLoading } = useSavedItems(userId || undefined, token);
  const { data: safetyItems = [], isLoading: safetyLoading } = useSafetyItems(userId || undefined, token);

  // Стейтҳо барои идоракунии ашёҳо дар "Қуттии бехатарӣ" (Safety Box)
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

  // Бор кардани профил аз база ҳангоми кушода шудани саҳифа
  useEffect(() => {
    const loadProfile = async () => {
      if (!userId) return;
      try {
        const supabaseToken = await getToken({ template: 'supabase' });
        if (!supabaseToken) return;
        const supabase = createClerkSupabaseClient(supabaseToken);
        const data = await ProfileService.getProfile(supabase, userId);
        setProfile(data);
        
        // Агар рақами телефон набошад, тирезаи махсусро нишон медиҳем
        if (data && (!data.phone || !data.secondary_phone)) {
          setShowPhoneModal(true);
        }
      } catch (err) {
        console.error("Error loading profile:", err);
      } finally {
        setProfileLoading(false);
      }
    };
    loadProfile();
  }, [userId]);

  // Синхронизатсия кардани таби фаъол бо URL
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["posts", "info", "saved", "safety", "qr"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  /**
   * Функсия барои иваз кардани таб (вкладка) ва нав кардани URL
   */
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    const params = new URLSearchParams(searchParams);
    params.set("tab", tabId);
    router.push(`/profile?${params.toString()}`, { scroll: false });
  };

  // Стейт барои тирезаи тасдиқи амалҳо (Confirm Dialog)
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

  // Элементҳои менюи паҳлӯӣ (Sidebar Menu)
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

  // Вақте ки маълумот дар ягон ҷо нав мешавад, ин ҷо ҳам кэшро тоза мекунем
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

  /**
   * Функсия барои коркарди суратҳо дар Қуттии бехатарӣ
   */
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

  /**
   * Функсия барои нест кардани сурат аз пешнамоиши Қуттии бехатарӣ
   */
  const removeSafetyImage = (index: number) => {
    setSafetyImages(prev => prev.filter((_, i) => i !== index));
    setSafetyPreviews(prev => prev.filter((_, i) => i !== index));
  };

  /**
   * Функсия барои бақайдгирии ашёи нав дар Қуттии бехатарӣ
   */
  const handleRegisterSafetyItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = (formData.get('name') as string || "").trim();
    const description = (formData.get('description') as string || "").trim();
    const phone = (formData.get('phone') as string || "").trim();
    const reward = (formData.get('reward') as string || "").trim();

    if (!name || !description || !safetyCategory || !phone) {
      toast.error(t('fillAllFields'));
      return;
    }

    setSafetySubmitting(true);
    try {
      const imageUrls = [];
      for (const file of safetyImages) {
        const uploadToken = await getToken({ template: 'supabase' });
        const uploadSupabase = createClerkSupabaseClient(uploadToken!);
        
        const compressedFile = await compressImage(file);
        
        const ext = compressedFile.name.split('.').pop();
        const fileName = `safety-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        const { error: uploadError } = await uploadSupabase.storage.from('items').upload(fileName, compressedFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = uploadSupabase.storage.from('items').getPublicUrl(fileName);
        imageUrls.push(publicUrl);
      }

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
      toast.error(`Хатогӣ: ${errorMsg}`);
    } finally {
      setSafetySubmitting(false);
    }
  };

  /**
   * Функсия барои нав кардани маълумоти ашё дар Қуттии бехатарӣ
   */
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

      const originalImages = safetyItems.find((it: any) => it.id === editingSafetyItem.id)?.images || [];
      const currentImagesInState = editingSafetyItem.images || [];
      const removedUrls = originalImages.filter((url: string) => !currentImagesInState.includes(url));

      if (removedUrls.length > 0) {
        const filePaths = removedUrls.map((urlStr: string) => {
          try {
            const url = new URL(urlStr);
            const pathParts = url.pathname.split('/public/items/');
            return pathParts.length > 1 ? pathParts[1] : null;
          } catch (e) {
            const parts = urlStr.split('/public/items/');
            return parts.length > 1 ? parts[1].split('?')[0] : null;
          }
        }).filter(Boolean) as string[];

        if (filePaths.length > 0) {
          await supabase.storage.from('items').remove(filePaths);
        }
      }

      let imageUrls = [...currentImagesInState];
      
      if (safetyImages.length > 0) {
        for (const file of safetyImages) {
          const compressedFile = await compressImage(file);
          const ext = compressedFile.name.split('.').pop();
          const fileName = `safety-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
          const { error: uploadError } = await supabase.storage.from('items').upload(fileName, compressedFile);
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

      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ITEM_KEYS.safetyItems(userId || "", token) });
      
      toast.success(t('success'));
      setEditingSafetyItem(null);
      setSafetyImages([]);
      setSafetyPreviews([]);
    } catch (error: any) {
      console.error("Detailed Safety Box Error:", error);
      toast.error(`Хатогӣ: ${error.message}`);
    } finally {
      setSafetySubmitting(false);
    }
  };

  /**
   * Функсия барои нашри эълон аз Қуттии бехатарӣ ба рӯйхати умумӣ (Publish)
   */
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

  /**
   * Функсия барои нест кардани ашё аз Қуттии бехатарӣ
   */
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
          
          const { data: item } = await supabase
            .from('safety_box')
            .select('images')
            .eq('id', id)
            .single();

          if (item?.images && item.images.length > 0) {
            const filePaths = item.images.map((urlStr: string) => {
              try {
                const url = new URL(urlStr);
                const pathParts = url.pathname.split('/public/items/');
                return pathParts.length > 1 ? pathParts[1] : null;
              } catch (e) {
                const parts = urlStr.split('/public/items/');
                return parts.length > 1 ? parts[1].split('?')[0] : null;
              }
            }).filter(Boolean) as string[];

            if (filePaths.length > 0) {
              await supabase.storage.from('items').remove(filePaths);
            }
          }

          const { error } = await supabase.from('safety_box').delete().eq('id', id);
          if (error) throw error;
          
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

  /**
   * Омода кардани ашё барои таҳрир кардан
   */
  const startEditing = (item: any) => {
    setEditingSafetyItem(item);
    setSafetyType(item.type || 'lost');
    setSafetyCategory(item.category);
    setSafetyPreviews(item.images || []);
    setSafetyImages([]);
  };

  /**
   * Функсия барои боргирии QR-код ҳамчун сурат (Download)
   */
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

  if (!userLoaded) return null;

  // Нишон додани мӯҳтаво вобаста ба таби интихобшуда
  const renderContent = () => {
    switch (activeTab) {
      case "posts":
        return (
          <div className="space-y-6">
            {/* Сарлавҳаи таби Эълонҳо */}
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

            {/* Рӯйхати эълонҳои шахсӣ */}
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
            {/* Сарлавҳаи таби QR-код */}
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

            {/* Танзимоти намуди зоҳирии QR */}
            <div className="animate-in fade-in duration-500 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-start px-2">
                {/* Пешнамоиши QR (Preview) */}
                <div className="flex flex-col sticky top-[130px] z-30 md:relative md:top-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md -mx-2 px-2 py-4 md:p-0 md:bg-transparent md:backdrop-blur-none transition-all duration-300">
                  <div className="bg-zinc-100 dark:bg-zinc-900 rounded-[2.5rem] md:rounded-[3rem] p-8 md:p-12 flex items-center justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 w-full overflow-hidden shadow-sm md:shadow-none">
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

                {/* Панели танзимоти ранг ва текст */}
                <div className="bg-zinc-50 dark:bg-zinc-900/30 p-8 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col justify-center">
                  <div className="space-y-8">
                    {/* Рангҳои QR */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Palette className="w-4 h-4 text-zinc-400" />
                        <h4 className="font-black uppercase text-[10px] tracking-[0.2em] text-zinc-400">{t('qrColors')}</h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2 relative">
                          <Label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest ml-1">{t('qrColorLabel')}</Label>
                          <div className="flex items-center gap-3 bg-white dark:bg-zinc-950 p-2 rounded-xl border border-zinc-100 dark:border-zinc-800">
                            <button 
                              className="w-10 h-10 rounded-lg cursor-pointer border-2 border-zinc-100 dark:border-zinc-800 shrink-0 shadow-sm transition-transform active:scale-95"
                              style={{ backgroundColor: qrSettings.qrColor }}
                              onClick={() => setActivePicker(activePicker === "qr" ? null : "qr")}
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
                          
                          {activePicker === "qr" && (
                            <div className="absolute top-full left-0 z-50 mt-2 p-3 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-100 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
                              <HexColorPicker 
                                color={qrSettings.qrColor} 
                                onChange={(color) => setQrSettings({...qrSettings, qrColor: color})} 
                              />
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="w-full mt-2 h-8 font-black uppercase text-[8px] tracking-widest"
                                onClick={() => setActivePicker(null)}
                              >
                                {t('confirm') || 'OK'}
                              </Button>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2 relative">
                          <Label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest ml-1">{t('qrBgLabel')}</Label>
                          <div className="flex items-center gap-3 bg-white dark:bg-zinc-950 p-2 rounded-xl border border-zinc-100 dark:border-zinc-800">
                            <button 
                              className="w-10 h-10 rounded-lg cursor-pointer border-2 border-zinc-100 dark:border-zinc-800 shrink-0 shadow-sm transition-transform active:scale-95"
                              style={{ backgroundColor: qrSettings.bgColor }}
                              onClick={() => setActivePicker(activePicker === "bg" ? null : "bg")}
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

                          {activePicker === "bg" && (
                            <div className="absolute top-full left-0 z-50 mt-2 p-3 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-100 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
                              <HexColorPicker 
                                color={qrSettings.bgColor} 
                                onChange={(color) => setQrSettings({...qrSettings, bgColor: color})} 
                              />
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="w-full mt-2 h-8 font-black uppercase text-[8px] tracking-widest"
                                onClick={() => setActivePicker(null)}
                              >
                                {t('confirm') || 'OK'}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Тексти зери QR-код */}
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
            {/* Сарлавҳаи таби Маълумоти шахсӣ */}
            <div className="sticky top-[64px] z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md pt-4 pb-4 px-4 mb-6 -mx-4 border-b border-zinc-100 dark:border-zinc-900">
              <h3 className="text-lg font-black uppercase tracking-tight">{t('personalInfo')}</h3>
            </div>
            
            <div className="animate-in slide-in-from-right-4 duration-500 max-w-2xl px-2 space-y-12">
              {/* Бахши Аватар ва Ному насаб */}
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
                  {/* Формаи таҳрири маълумоти профил */}
                  <form 
                    key={profile?.id || 'new'}
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const firstName = formData.get('firstName') as string;
                      const lastName = formData.get('lastName') as string;
                      const phone = (formData.get('phone') as string || "").trim();
                      const secondaryPhone = (formData.get('secondaryPhone') as string || "").trim();

                      if (phone.length < 9 || secondaryPhone.length < 9) {
                        toast.error(t('phoneMinLength'));
                        return;
                      }

                      if (phone === secondaryPhone) {
                        toast.error(t('phonesMustBeDifferent'));
                        return;
                      }
                      
                      setSafetySubmitting(true);
                      try {
                        try {
                          await user?.update({ firstName, lastName });
                        } catch (clerkErr) {
                          console.error("Clerk Update Error:", clerkErr);
                        }
                        
                        const token = await getToken({ template: 'supabase' });
                        if (!token) throw new Error("Authentication token not found");
                        
                        const supabase = createClerkSupabaseClient(token);
                        const updated = await ProfileService.updateProfile(supabase, userId!, {
                          first_name: firstName,
                          last_name: lastName,
                          phone,
                          secondary_phone: secondaryPhone,
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest ml-1">{t('phoneLabel')}</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                          <Input 
                            name="phone" 
                            placeholder={t('phonePlaceholder')}
                            defaultValue={profile?.phone || ""} 
                            className="h-10 pl-9 rounded-xl bg-white dark:bg-zinc-950 font-bold text-xs"
                            inputMode="numeric"
                            required
                            onChange={(e) => e.target.value = e.target.value.replace(/[^0-9]/g, '')}
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest ml-1">{t('phoneSecondaryLabel')}</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                          <Input 
                            name="secondaryPhone" 
                            placeholder={t('phoneSecondaryPlaceholder')}
                            defaultValue={profile?.secondary_phone || ""} 
                            className="h-10 pl-9 rounded-xl bg-white dark:bg-zinc-950 font-bold text-xs"
                            inputMode="numeric"
                            required
                            onChange={(e) => e.target.value = e.target.value.replace(/[^0-9]/g, '')}
                          />
                        </div>
                      </div>
                    </div>

                    <Button type="submit" size="sm" disabled={safetySubmitting} className="rounded-lg bg-zinc-900 text-white font-black uppercase text-[9px] tracking-widest px-6 w-full sm:w-auto">
                      {safetySubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : t('save')}
                    </Button>
                  </form>
                </div>
              </section>

              {/* Бахши Почтаи электронӣ (Email) */}
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
            {/* Сарлавҳаи таби Захирашудаҳо */}
            <div className="sticky top-[64px] z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md pt-4 pb-4 px-4 mb-6 -mx-4 border-b border-zinc-100 dark:border-zinc-900">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black uppercase tracking-tight">{t('savedItems')}</h3>
                <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-900 text-white">
                  {savedItems.length}
                </div>
              </div>
            </div>

            {/* Рӯйхати ашёҳои захирашуда */}
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
            {/* Сарлавҳаи таби Қуттии бехатарӣ */}
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

            {/* Идоракунии Қуттии бехатарӣ (Safety Box) */}
            <div className="animate-in fade-in duration-500 max-w-4xl mx-auto px-2">
              {isAddingSafetyItem ? (
                /* Формаи илова кардани ашё ба бойгонӣ */
                <Card className="rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-xl overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                  <CardHeader className="bg-zinc-50 dark:bg-zinc-900/50 p-6 border-b border-zinc-100 dark:border-zinc-800">
                    <CardTitle className="text-lg font-black uppercase tracking-wider flex items-center gap-3">
                      <Briefcase className="w-5 h-5 text-amber-500" /> {t('registerNewItem')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8">
                    <form onSubmit={handleRegisterSafetyItem} className="space-y-6">
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
                /* Намоиши ашёҳои бойгонӣ (Safety Box Items) */
                <div className="space-y-6">
                  {safetyLoading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                      {[...Array(3)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-2xl" />)}
                    </div>
                  ) : safetyItems.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                      {safetyItems.map((item: any) => (
                        <Card 
                          key={item.id} 
                          className="overflow-hidden hover:shadow-md transition-shadow duration-300 group flex flex-col h-full rounded-xl border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 cursor-pointer"
                          onClick={() => setSelectedSafetyItem(item)}
                        >
                          {/* Сурати ашё дар бойгонӣ */}
                          <div className="relative aspect-square overflow-hidden rounded-t-xl bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center">
                            {item.images?.[0] ? (
                              <Image src={item.images[0]} alt={item.item_name} fill className="object-cover transition-transform duration-500 group-hover:scale-105" />
                            ) : <PackageSearch className="w-12 h-12 text-zinc-200" />}
                            
                            <div className="absolute top-2 left-2 right-2 flex justify-between items-center">
                              <Badge className="bg-white/90 backdrop-blur text-black text-[9px] font-black rounded px-2 py-0.5 border-none shadow-sm uppercase tracking-tighter">
                                 {t(`categories.${CATEGORIES.find(c => c.name === item.category)?.id || '6'}`)}
                              </Badge>
                              
                              <div className="flex gap-1.5">
                                {/* Тугмаи нашр кардан аз бойгонӣ */}
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
                                {/* Тугмаи нест кардан аз бойгонӣ */}
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
                              </div>
                            </div>
                          </div>
                          <CardContent className="p-3 flex-1 flex flex-col">
                            <h4 className="font-black text-xs line-clamp-1 leading-tight uppercase tracking-tight mb-1 group-hover:text-emerald-500 transition-colors">
                              {item.item_name}
                            </h4>
                            <div className="mt-auto pt-2 border-t border-zinc-50 dark:border-zinc-900 flex justify-between items-center">
                              <div className="flex items-center gap-1.5 text-[9px] font-bold text-zinc-400 uppercase tracking-wider">
                                <Clock className="w-2.5 h-2.5" /> {new Date(item.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-24 border-2 border-dashed rounded-[40px] border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/10">
                      <p className="text-zinc-400 text-[11px] font-black uppercase tracking-[0.2em]">{t('safetyBoxEmpty')}</p>
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
          {/* Менюи Sidebar (Менюи паҳлӯӣ) */}
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
              
              {/* Тугмаи баромад (Log out) */}
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

          {/* Мӯҳтавои асосии табҳо */}
          <div className="lg:col-span-3">
            <div className="min-h-[60vh]">
              {renderContent()}
            </div>
          </div>
        </div>
      </div>

      {/* Тирезаҳои тасдиқ (Dialogs/Modals) */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog(prev => ({ ...prev, open: false }))}>
        <DialogContent className="sm:max-w-md rounded-3xl p-8 gap-6 border-none shadow-2xl">
          <DialogHeader className="space-y-3">
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
                confirmDialog.variant === "destructive" ? "bg-red-600 hover:bg-red-700 text-white" : "bg-zinc-900 hover:bg-zinc-800 text-white"
              )}
              onClick={() => confirmDialog.onConfirm()}
              disabled={confirmDialog.isLoading}
            >
              {confirmDialog.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (confirmDialog.variant === "destructive" ? t('delete') : t('confirm'))}
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

/**
 * Саҳифаи асосии Профил бо Suspense
 */
export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-20 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-10 h-10 animate-spin text-zinc-900" />
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}

/**
 * Компоненти хурд барои нишонҳо (Badge)
 */
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
