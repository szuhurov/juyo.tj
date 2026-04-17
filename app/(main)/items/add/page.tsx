"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useClerk } from "@clerk/nextjs";
import { useLanguage } from "@/lib/language-context";
import { ItemService, CATEGORIES } from "@/lib/services/item-service";
import { createClerkSupabaseClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Plus, X, Upload } from "lucide-react";
import Image from "next/image";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function AddItemForm() {
  const { t } = useLanguage();
  const router = useRouter();
  const { userId, getToken } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<'lost' | 'found'>('lost');
  const [category, setCategory] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

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

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userId) return;

    const formData = new FormData(e.currentTarget);
    const title = (formData.get('title') as string).trim();
    const description = (formData.get('description') as string).trim();
    const phone = (formData.get('phone') as string).trim();
    const reward = (formData.get('reward') as string || "").trim();

    if (!title || !description || !category || !phone) {
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

    setLoading(true);
    try {
      let token = await getToken({ template: 'supabase' });
      if (!token) throw new Error("Authentication token missing");
      
      let supabase = createClerkSupabaseClient(token);

      const imageUrls = [];
      for (const file of images) {
        const ext = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        
        const { error: uploadError } = await supabase.storage
          .from('items')
          .upload(fileName, file);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage.from('items').getPublicUrl(fileName);
        imageUrls.push(publicUrl);
      }

      token = await getToken({ template: 'supabase' });
      if (!token) throw new Error("Authentication token expired or missing");
      supabase = createClerkSupabaseClient(token);

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

      const { data: item, error: itemError } = await supabase
        .from('items')
        .insert([itemData])
        .select()
        .single();

      if (itemError) throw itemError;

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
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Card className="rounded-2xl overflow-hidden border shadow-xl">
        <CardHeader className="bg-zinc-900 text-white p-6">
          <CardTitle className="text-2xl font-black uppercase tracking-tight">{t('addItemTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={onSubmit} className="space-y-6">
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
                    placeholder={t('rewardPlaceholder')} 
                    className="rounded-lg h-11" 
                    type="text" 
                    inputMode="numeric" 
                    onChange={(e) => e.target.value = e.target.value.replace(/[^0-9]/g, '')}
                  />
                </div>
              )}
            </div>

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
    </div>
  );
}

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
