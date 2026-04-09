"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useLanguage } from "@/lib/language-context";
import { CATEGORIES } from "@/lib/services/item-service";
import { createClerkSupabaseClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, X, Upload, ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function AddSafetyItemPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const { userId, getToken } = useAuth();
  
  const [loading, setLoading] = useState(false);
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
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const phone = formData.get('phone') as string;
    const reward = formData.get('reward') as string;

    if (!name || !description || !category) {
      toast.error(t('fillAllFields'));
      return;
    }

    setLoading(true);
    try {
      const token = await getToken({ template: 'supabase' });
      const supabase = createClerkSupabaseClient(token!);

      const imageUrls = [];
      for (const file of images) {
        const ext = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('items').upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('items').getPublicUrl(fileName);
        imageUrls.push(publicUrl);
      }

      const { error } = await supabase
        .from('safety_box')
        .insert([{
          user_id: userId,
          item_name: name,
          description,
          category,
          reward,
          phone_number: phone,
          images: imageUrls
        }]);

      if (error) throw error;

      toast.success(t('success'));
      router.push('/safety-box');
    } catch (error: any) {
      toast.error(error.message || t('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Button variant="ghost" asChild className="mb-4 gap-2">
        <Link href="/safety-box">
          <ArrowLeft className="w-4 h-4" /> {t('safetyBoxTitle')}
        </Link>
      </Button>
      
      <Card className="rounded-[2.5rem] overflow-hidden border-none shadow-2xl">
        <CardHeader className="bg-zinc-900 text-white p-8">
          <CardTitle className="text-3xl font-black">{t('addSafetyItemTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="font-bold">{t('safetyItemNameLabel')}</Label>
              <Input id="name" name="name" placeholder={t('safetyItemNamePlaceholder')} className="rounded-xl h-12" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category" className="font-bold">{t('categoryLabel')}</Label>
              <Select onValueChange={setCategory} required>
                <SelectTrigger className="h-12 rounded-xl">
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

            <div className="space-y-2">
              <Label htmlFor="description" className="font-bold">{t('safetyItemDescLabel')}</Label>
              <Textarea 
                id="description" 
                name="description" 
                placeholder={t('safetyItemDescPlaceholder')} 
                className="rounded-xl min-h-[100px]" 
                required 
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="phone" className="font-bold">{t('phoneLabel')}</Label>
                <Input id="phone" name="phone" placeholder="9XXXXXXXX" className="rounded-xl h-12" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reward" className="font-bold">{t('rewardLabel')}</Label>
                <Input id="reward" name="reward" placeholder={t('rewardLabel')} className="rounded-xl h-12" />
              </div>
            </div>

            <div className="space-y-4">
              <Label className="font-bold">{t('addImages')} ({images.length}/5)</Label>
              <div className="grid grid-cols-5 gap-4">
                {previews.map((src, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden border">
                    <Image src={src} alt="Preview" fill className="object-cover" />
                    <button type="button" onClick={() => removeImage(i)} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full"><X className="w-3 h-3" /></button>
                  </div>
                ))}
                {images.length < 5 && (
                  <label className="aspect-square flex items-center justify-center border-2 border-dashed rounded-xl cursor-pointer hover:bg-zinc-50">
                    <Upload className="w-6 h-6 text-zinc-400" />
                    <input type="file" className="hidden" accept="image/*" multiple onChange={handleImageChange} />
                  </label>
                )}
              </div>
            </div>

            <Button type="submit" size="lg" className="w-full h-14 rounded-2xl text-lg font-black bg-zinc-900 hover:bg-zinc-800" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : t('save')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
