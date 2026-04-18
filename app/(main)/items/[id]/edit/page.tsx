/**
 * Ин саҳифа барои таҳрир кардани эълон ҳаст (Edit Page).
 * Агар корбар дар эълонаш хато карда бошад ё суратҳои нав илова кардан хоҳад,
 * вай метавонад аз ин ҷо ҳама чизро нав кунад.
 */

"use client";

import { useEffect, useState, use } from "react"; // Барои кор бо стейт ва эффектҳо
import { useRouter } from "next/navigation"; // Барои гузаштан ба саҳифаҳои дигар
import { useAuth } from "@clerk/nextjs"; // Барои гирифтани маълумоти корбар
import { useLanguage } from "@/lib/language-context"; // Барои тарҷумаи забон
import { ItemService, CATEGORIES, Item } from "@/lib/services/item-service"; // Барои кор бо эълонҳо
import { createClerkSupabaseClient } from "@/lib/supabase"; // Барои пайваст шудан ба база
import { Button } from "@/components/ui/button"; // Компоненти тугма
import { Input } from "@/components/ui/input"; // Компоненти воридкунии матн
import { Textarea } from "@/components/ui/textarea"; // Компоненти воридкунии матни дароз
import { Label } from "@/components/ui/label"; // Компоненти тамға
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"; // Барои интихоби як аз якчандто
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Барои рӯйхати интихобшаванда
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Компоненти корт
import { toast } from "sonner"; // Барои нишон додани хабарҳо
import { Loader2, Plus, X, Upload, ArrowLeft } from "lucide-react"; // Иконкаҳо
import Image from "next/image"; // Барои суратҳо
import Link from "next/link"; // Барои гузаштан ба саҳифаҳо

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"; // Барои нишон додани маслиҳатҳо

export default function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  // ID-и эълонро аз URL мегирем
  const { id } = use(params);
  const { t } = useLanguage();
  const router = useRouter();
  const { userId, getToken } = useAuth();
  
  // Стейтҳо барои нигоҳ доштани маълумоти эълон ва ҳолати боргузорӣ (Loading)
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [item, setItem] = useState<Item | null>(null);
  
  // Стейтҳо барои навъи ашё, категория ва суратҳо
  const [type, setType] = useState<'lost' | 'found'>('lost');
  const [category, setCategory] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<{url: string, isExisting: boolean}[]>([]);

  // Вақте ки саҳифа кушода мешавад, маълумоти эълонро аз база мехонем
  useEffect(() => {
    if (userId) loadItem();
  }, [id, userId]);

  /**
   * Функсия барои гирифтани маълумоти эълон аз база
   */
  const loadItem = async () => {
    try {
      setLoading(true);
      const token = await getToken({ template: 'supabase' });
      const supabase = createClerkSupabaseClient(token!);
      
      const { data, error } = await supabase
        .from('items')
        .select('*, images:item_images(image_url)')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      // Агар корбар соҳиби эълон набошад, вайро ба главний мефиристем
      if (data.user_id !== userId) {
        toast.error(t('accessDenied'));
        router.push('/');
        return;
      }

      setItem(data);
      setType(data.type);
      setCategory(data.category);
      if (data.images) {
        setPreviews(data.images.map((img: any) => ({ url: img.image_url, isExisting: true })));
      }
    } catch (error) {
      console.error(error);
      toast.error(t('itemNotFound'));
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Функсия барои коркарди суратҳои нави интихобшуда
   */
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (previews.length + files.length > 5) {
      toast.error(t('maxImagesReached'));
      return;
    }
    
    setImages(prev => [...prev, ...files]);
    const newPreviews = files.map(file => ({ url: URL.createObjectURL(file), isExisting: false }));
    setPreviews(prev => [...prev, ...newPreviews]);
  };

  /**
   * Функсия барои нест кардани сурат аз рӯйхати пешнамоиш (Preview)
   */
  const removeImage = (index: number) => {
    const previewToRemove = previews[index];
    if (!previewToRemove.isExisting) {
      const fileIndex = previews.filter((p, i) => i < index && !p.isExisting).length;
      setImages(prev => prev.filter((_, i) => i !== fileIndex));
    }
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  /**
   * Функсияи асосӣ барои сабт кардани тағйирот (Update)
   */
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userId || !item) return;

    // Маълумотро аз форма мегирем
    const formData = new FormData(e.currentTarget);
    const title = (formData.get('title') as string || '').trim();
    const description = (formData.get('description') as string || '').trim();
    const phone = (formData.get('phone') as string || '').trim();
    const rewardField = formData.get('reward');
    const reward = rewardField ? (rewardField as string).trim() : null;

    // Месанҷем, ки ҳамаи майдонҳо пур шудаанд
    if (!title || !description || !category || !phone) {
      toast.error(t('fillAllFields'));
      return;
    }

    if (previews.length === 0) {
      toast.error(t('atLeastOneImage'));
      return;
    }

    setSaving(true);
    try {
      let token = await getToken({ template: 'supabase' });
      if (!token) throw new Error("Authentication token missing");
      
      let supabase = createClerkSupabaseClient(token);

      // 1. Боргузории суратҳои нав ба Облако (Storage)
      const finalImageUrls: string[] = [];
      const newFiles = images;
      let newFileIdx = 0;
      let hasNewImages = false;

      for (const preview of previews) {
        if (preview.isExisting) {
          finalImageUrls.push(preview.url);
        } else {
          hasNewImages = true;
          const file = newFiles[newFileIdx++];
          const ext = file.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
          
          const { error: uploadError } = await supabase.storage
            .from('items')
            .upload(fileName, file);
          
          if (uploadError) throw uploadError;
          
          const { data: { publicUrl } } = supabase.storage.from('items').getPublicUrl(fileName);
          finalImageUrls.push(publicUrl);
        }
      }

      token = await getToken({ template: 'supabase' });
      if (!token) throw new Error("Authentication token expired or missing");
      supabase = createClerkSupabaseClient(token);

      const existingUrls = item.images?.map(img => img.image_url) || [];
      const imagesChanged = hasNewImages || 
                            finalImageUrls.length !== existingUrls.length ||
                            finalImageUrls.some((url, i) => url !== existingUrls[i]);

      // 2. Нав кардани маълумоти эълон дар база (Update query)
      const updateData: any = {
        title,
        description,
        category,
        type,
        phone_number: phone,
        reward: reward ? `${reward}` : null
      };

      // Агар суратҳо иваз шуда бошанд, боз ба модерация мефиристем
      if (imagesChanged) {
        updateData.moderation_status = 'pending';
      }

      const { error: updateError } = await supabase
        .from('items')
        .update(updateData)
        .eq('id', id);

      if (updateError) throw updateError;

      // 3. Тоза кардани суратҳои кӯҳна ва сабти суратҳои нав
      if (imagesChanged) {
        const removedUrls = existingUrls.filter(url => !finalImageUrls.includes(url));
        
        if (removedUrls.length > 0) {
          const filePaths = removedUrls.map(urlStr => {
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

        await supabase.from('item_images').delete().eq('item_id', id);
        
        const imageRecords = finalImageUrls.map(url => ({
          item_id: id,
          image_url: url
        }));
        await supabase.from('item_images').insert(imageRecords);
      }

      if (imagesChanged) {
        toast.success(t('imageModeration.submitted'));
      } else {
        toast.success(t('updateSuccess'));
      }
      
      window.location.href = `/items/${id}`;
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || t('error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Тугмаи бекор кардан (Назад) */}
        <Button variant="ghost" asChild className="mb-6 gap-2 rounded-md font-bold">
          <Link href={`/items/${id}`}>
            <ArrowLeft className="w-4 h-4" /> {t('cancel')}
          </Link>
        </Button>

        <Card className="rounded-2xl overflow-hidden border shadow-xl">
          {/* Сарлавҳаи форма */}
          <CardHeader className="bg-zinc-900 text-white p-6">
            <CardTitle className="text-2xl font-black uppercase tracking-tight">{t('editItemTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={onSubmit} className="space-y-6">
              {/* Интихоби навъи эълон (Радио-кнопкаҳо) */}
              <div className="space-y-3">
                <Label className="text-sm font-black uppercase tracking-wider text-zinc-400">{t('what_happened')}</Label>
                <RadioGroup 
                  value={type}
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

              {/* Майдонҳои асосии маълумот (Title, Category, Description) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="title" className="font-bold text-xs uppercase text-zinc-500">{t('titleLabel')}</Label>
                  <Input id="title" name="title" defaultValue={item?.title} placeholder={t('titleLabel')} className="rounded-lg h-11" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category" className="font-bold text-xs uppercase text-zinc-500">{t('categoryLabel')}</Label>
                  <Select value={category} onValueChange={setCategory} required>
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

              <div className="space-y-2">
                <Label htmlFor="description" className="font-bold text-xs uppercase text-zinc-500">{t('description')}</Label>
                <Textarea 
                  id="description" 
                  name="description" 
                  defaultValue={item?.description}
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
                    defaultValue={item?.phone_number}
                    placeholder={t('phonePlaceholder')} 
                    className="rounded-lg h-11" 
                    required 
                    type="text" 
                    inputMode="numeric"
                    onChange={(e) => e.target.value = e.target.value.replace(/[^0-9]/g, '')}
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
                      defaultValue={item?.reward?.replace(/[^0-9]/g, '')}
                      placeholder={t('rewardPlaceholder')} 
                      className="rounded-lg h-11" 
                      type="text" 
                      inputMode="numeric" 
                      onChange={(e) => e.target.value = e.target.value.replace(/[^0-9]/g, '')}
                    />
                  </div>
                )}
              </div>

              {/* Қисмати идоракунии суратҳо (Image Upload) */}
              <div className="space-y-4">
                <Label className="font-bold text-xs uppercase text-zinc-500">{t('addImages')} ({previews.length}/5)</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                  {previews.map((preview, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden border group">
                      <Image src={preview.url} alt="Preview" fill className="object-cover" />
                      <button 
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {previews.length < 5 && (
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

              {/* Тугмаи сабт (Submit button) */}
              <Button type="submit" size="lg" className="w-full h-12 rounded-lg text-base font-black bg-zinc-900 hover:bg-zinc-800 mt-4 uppercase tracking-wider text-white" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {t('loading')}
                  </>
                ) : (
                  t('updateBtn')
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
