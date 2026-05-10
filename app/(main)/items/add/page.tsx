/**
 * Ин саҳифа барои илова кардани эълони нав ҳаст (Add Item Page).
 * Дар ин ҷо корбар метавонад дар бораи чизи гумкардааш ё ёфтааш хабар диҳад.
 * Мо суратҳоро пеш аз бор кардан фишурда (сжать) мекунем, то ки база пур нашавад.
 */

"use client";

import { useState, useEffect, Suspense } from "react"; // Барои идоракунии ҳолатҳо ва боргирии муваққатӣ
import { useRouter } from "next/navigation"; // Барои гузаштан ба саҳифаҳои дигар пас аз сабт
import { useAuth, useClerk } from "@clerk/nextjs"; // Барои кор бо маълумоти корбари воридшуда
import { useLanguage } from "@/lib/language-context"; // Барои дастрасӣ ба тарҷумаҳо ва забон
import { ItemService, CATEGORIES } from "@/lib/services/item-service"; // Барои кор бо базаи эълонҳо ва рӯйхати категорияҳо
import { ProfileService } from "@/lib/services/profile-service"; // Барои гирифтани маълумоти профили корбар
import { createClerkSupabaseClient } from "@/lib/supabase"; // Барои пайваст шудан ба базаи Supabase
import { compressImage } from "@/lib/image-utils"; // Барои хурд кардани ҳаҷми суратҳо пеш аз бор кардан
import { Button } from "@/components/ui/button"; // Компоненти тугма
import { Input } from "@/components/ui/input"; // Майдони воридкунии маълумоти кӯтоҳ
import { Textarea } from "@/components/ui/textarea"; // Майдони воридкунии матни дароз
import { Label } from "@/components/ui/label"; // Сарлавҳаҳо барои майдонҳои форма
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"; // Барои интихоби як вариант аз чандто
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Рӯйхати интихобшаванда (выпадающий список)
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Барои сохтани блоки асосии форма
import { toast } from "sonner"; // Барои нишон додани паёмҳои муваққатӣ
import { Loader2, Plus, X, Upload, ArrowLeft, ShieldAlert } from "lucide-react"; // Иконкаҳои лозимӣ барои интерфейс
import Image from "next/image"; // Барои нишон додани пешнамоиши суратҳо
import { cn } from "@/lib/utils";

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
} from "@/components/ui/dialog";

function AddItemForm() {
  // Хукҳо барои забон, роутинг ва аутентификатсияи корбар
  const { t } = useLanguage();
  const router = useRouter();
  const { userId, getToken } = useAuth();
  
  // Стейтҳо барои маълумоти форма ва раванди боргузорӣ (Loading)
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<'lost' | 'found'>('lost');
  const [category, setCategory] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [phone, setPhone] = useState("");
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<any>(null);

  // Вақте ки саҳифа бор мешавад, рақами телефони корбарро аз профилаш мегирем
  useEffect(() => {
    const fetchProfile = async () => {
      if (!userId) return;
      try {
        const token = await getToken({ template: 'supabase' });
        if (!token) return;
        const supabase = createClerkSupabaseClient(token);
        const profile = await ProfileService.getProfile(supabase, userId);
        if (profile?.phone) {
          setPhone(profile.phone);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
    };
    fetchProfile();
  }, [userId, getToken]);

  /**
   * Функсия барои коркарди суратҳои интихобшуда
   */
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > 5) {
      toast.error(t('maxImagesReached'));
      return;
    }
    
    setImages(prev => [...prev, ...files]);
    const newPreviews = files.map(file => URL.createObjectURL(file));
    setPreviews(prev => [...prev, ...newPreviews]);
  };

  /**
   * Функсия барои нест кардани сурат аз пешнамоиш (Preview)
   */
  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  /**
   * Функсия барои нишон додани модалкаи амниятӣ пеш аз сабт
   */
  const handlePreSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userId) return;

    const formData = new FormData(e.currentTarget);
    const title = (formData.get('title') as string).trim();
    const description = (formData.get('description') as string).trim();
    const currentPhone = (formData.get('phone') as string).trim();
    const reward = (formData.get('reward') as string || "").trim();

    if (!title || !description || !category || !currentPhone) {
      toast.error(t('fillAllFields'));
      return;
    }

    if (type === 'lost' && reward && isNaN(Number(reward))) {
      toast.error(t('rewardOnlyNumbers'));
      return;
    }

    if (images.length === 0) {
      toast.error(t('atLeastOneImage'));
      return;
    }

    setPendingFormData({ title, description, phone: currentPhone, reward });
    setShowSafetyModal(true);
  };

  /**
   * Функсияи асосӣ барои сабти эълон (Submit)
   */
  const onFinalSubmit = async () => {
    if (!userId || !pendingFormData) return;
    
    setShowSafetyModal(false);
    setLoading(true);
    
    const { title, description, phone, reward } = pendingFormData;

    try {
      let token = await getToken({ template: 'supabase' });
      if (!token) throw new Error("Authentication token missing");
      
      let supabase = createClerkSupabaseClient(token);

      // Боргузории суратҳо ба Облако (Storage) бо фишурдасозӣ
      const imageUrls = [];
      for (const file of images) {
        const compressedFile = await compressImage(file);
        
        const ext = compressedFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        
        const { error: uploadError } = await supabase.storage
          .from('items')
          .upload(fileName, compressedFile);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage.from('items').getPublicUrl(fileName);
        imageUrls.push(publicUrl);
      }

      token = await getToken({ template: 'supabase' });
      if (!token) throw new Error("Authentication token expired or missing");
      supabase = createClerkSupabaseClient(token);

      // Тайёр кардани объекти эълони нав
      const itemData = {
        user_id: userId,
        title,
        description,
        category,
        type,
        phone_number: phone,
        reward: (type === 'lost' && reward) ? `${reward}` : null,
        date: new Date().toISOString().split('T')[0],
        is_resolved: false,
        moderation_status: 'pending'
      };

      // Сабти эълон дар база (Insert query)
      const { data: item, error: itemError } = await supabase
        .from('items')
        .insert([itemData])
        .select()
        .single();

      if (itemError) throw itemError;

      // Сабти истиноди суратҳо дар таблицаи алоҳида
      if (imageUrls.length > 0) {
        const imageRecords = imageUrls.map(url => ({
          item_id: item.id,
          image_url: url
        }));
        await supabase.from('item_images').insert(imageRecords);
      }

      toast.success(t('imageModeration.submitted'));
      window.dispatchEvent(new Event('items-updated'));
      router.push('/profile?tab=posts');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || t('error'));
    } finally {
      setLoading(false);
      setPendingFormData(null);
    }
  };

  return (
    <div className="container mx-auto px-0 sm:px-4 py-0 sm:py-8 max-w-4xl">
      <Card className="rounded-none sm:rounded-2xl overflow-hidden border-none sm:border shadow-none sm:shadow-xl min-h-screen sm:min-h-0">
        {/* Сарлавҳаи форма */}
        <CardHeader className="bg-zinc-900 text-white p-6 sm:p-8">
          <CardTitle className="text-2xl sm:text-3xl font-black uppercase tracking-tight">{t('addItemTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="p-6 sm:p-8">
          <form onSubmit={handlePreSubmit} className="space-y-6">
            {/* Интихоби навъи эълон (Гумшуда ё Ёфтшуда) */}
            <div className="space-y-3">
              <Label className="text-sm font-black uppercase tracking-wider text-zinc-400">{t('what_happened')}</Label>
              <RadioGroup 
                defaultValue="lost" 
                onValueChange={(val) => setType(val as 'lost' | 'found')}
                className="grid grid-cols-2 gap-4"
              >
                <div>
                  <RadioGroupItem value="lost" id="lost" className="peer sr-only" />
                  <Label
                    htmlFor="lost"
                    className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-zinc-50 peer-data-[state=checked]:border-red-600 peer-data-[state=checked]:bg-red-50 cursor-pointer transition-all"
                  >
                    <span className="text-2xl mb-1">🔍</span>
                    <span className="font-bold text-sm uppercase">{t('lost')}</span>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="found" id="found" className="peer sr-only" />
                  <Label
                    htmlFor="found"
                    className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-zinc-50 peer-data-[state=checked]:border-emerald-600 peer-data-[state=checked]:bg-emerald-50 cursor-pointer transition-all"
                  >
                    <span className="text-2xl mb-1">🎁</span>
                    <span className="font-bold text-sm uppercase">{t('found')}</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Майдонҳои Сарлавҳа ва Категория */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="title" className="font-bold text-xs uppercase text-zinc-500">{t('titleLabel')}</Label>
                <Input id="title" name="title" placeholder={t('titleLabel')} className="rounded-lg h-11" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category" className="font-bold text-xs uppercase text-zinc-500">{t('categoryLabel')}</Label>
                <Select onValueChange={setCategory} required>
                  <SelectTrigger className="h-11 rounded-lg">
                    <SelectValue placeholder={t('categoryLabel')} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name} className="rounded-md">
                        {cat.icon} {t(`categories.${cat.id}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Тавсифи ашё */}
            <div className="space-y-2">
              <Label htmlFor="description" className="font-bold text-xs uppercase text-zinc-500">{t('description')}</Label>
              <Textarea 
                id="description" 
                name="description" 
                placeholder={t('description')} 
                className="rounded-lg min-h-[100px] resize-none" 
                required 
              />
            </div>

            {/* Телефон ва Мукофотпулӣ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="phone" className="font-bold text-xs uppercase text-zinc-500">{t('phoneLabel')}</Label>
                <Input 
                  id="phone" 
                  name="phone" 
                  placeholder={t('phonePlaceholder')} 
                  className="rounded-lg h-11" 
                  required 
                  type="text" 
                  inputMode="numeric"
                  value={phone || ""}
                  onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                />
              </div>
              {type === 'lost' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
                  <Label htmlFor="reward" className="font-bold text-xs uppercase text-zinc-500">
                    {t('reward_gives_input')}
                  </Label>
                  <Input 
                    id="reward" 
                    name="reward" 
                    placeholder={t('rewardPlaceholder')} 
                    className="rounded-lg h-11" 
                    type="text" 
                    inputMode="numeric" 
                    onChange={(e) => e.target.value = e.target.value.replace(/[^0-9]/g, '')}
                  />
                </div>
              )}
            </div>

            {/* Боргузории суратҳо (Photo Upload) */}
            <div className="space-y-4">
              <Label className="font-bold text-xs uppercase text-zinc-500">{t('addImages')} ({images.length}/5)</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {previews.map((src, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border group">
                    <Image src={src} alt="Preview" fill className="object-cover" />
                    <button 
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {images.length < 5 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed rounded-lg cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                        <Upload className="w-5 h-5 text-zinc-400 mb-1" />
                        <span className="text-[8px] text-zinc-400 font-bold uppercase">{t('pickImage')}</span>
                        <input type="file" className="hidden" accept="image/*" multiple onChange={handleImageChange} />
                      </label>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('maxImages')}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>

            {/* Тугмаи нашр кардан (Publish) */}
            <Button type="submit" size="lg" className="w-full h-12 rounded-lg text-base font-black bg-zinc-900 hover:bg-zinc-800 mt-4 uppercase tracking-wider text-white" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {t('loading')}
                </>
              ) : (
                t('publishBtn')
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Модалкаи амниятӣ пеш аз нашр */}
      <Dialog open={showSafetyModal} onOpenChange={setShowSafetyModal}>
        <DialogContent className="sm:max-w-md rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
          <div className="p-8 space-y-6 text-center">
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-2 animate-in zoom-in duration-500",
              type === 'found' ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-red-50 dark:bg-red-900/20"
            )}>
              <ShieldAlert className={cn("w-8 h-8", type === 'found' ? "text-emerald-500" : "text-red-500")} />
            </div>

            <DialogHeader className="space-y-3">
              <DialogTitle className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                {type === 'found' ? t('safetyPostModal.foundTitle') : t('safetyPostModal.lostTitle')}
              </DialogTitle>
              <DialogDescription className="text-zinc-500 dark:text-zinc-400 font-bold text-[13px] leading-relaxed">
                {type === 'found' ? t('safetyPostModal.foundDesc') : t('safetyPostModal.lostDesc')}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-8 pb-8">
            <Button
              onClick={onFinalSubmit}
              className={cn(
                "w-full h-14 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] text-white shadow-xl transition-all active:scale-95 border-none",
                type === 'found' ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/10" : "bg-red-600 hover:bg-red-700 shadow-red-600/10"
              )}
            >
              {t('safetyPostModal.confirmBtn')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Саҳифаи асосии AddItem бо Suspense
 */
export default function AddItemPage() {
  return (
    <TooltipProvider>
      <Suspense fallback={
        <div className="container mx-auto px-4 py-8 max-w-2xl flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-10 h-10 animate-spin text-zinc-900" />
        </div>
      }>
        <AddItemForm />
      </Suspense>
    </TooltipProvider>
  );
}
