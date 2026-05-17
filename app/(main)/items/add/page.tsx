/**
 * Ин саҳифа барои илова кардани эълони нав ҳаст (Add Item Page).
 * Дар ин ҷо мо формаро ба чанд қадам (steps) ҷудо кардем, то ки истифодааш осон ва зебо бошад.
 */

"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useLanguage } from "@/lib/language-context";
import { ItemService, CATEGORIES } from "@/lib/services/item-service";
import { ProfileService } from "@/lib/services/profile-service";
import { createClerkSupabaseClient } from "@/lib/supabase";
import { compressImage } from "@/lib/image-utils";
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
import { Loader2, Plus, X, Upload, ArrowLeft, ShieldAlert, CheckCircle2 } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function AddItemForm() {
  const { t } = useLanguage();
  const router = useRouter();
  const { userId, getToken } = useAuth();
  
  // Ҳолатҳои форма (Form States)
  const [step, setStep] = useState(1);
  const totalSteps = 4;
  const [loading, setLoading] = useState(false);
  
  // Маълумоти эълон
  const [type, setType] = useState<'lost' | 'found' | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [phone, setPhone] = useState("");
  const [reward, setReward] = useState("");
  
  const [showSafetyModal, setShowSafetyModal] = useState(false);

  // Боргузории рақами телефон аз профил
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

  // Санҷиши қадамҳо пеш аз гузаштан
  const nextStep = () => {
    if (step === 1) {
      if (!type) {
        toast.error(t('fillAllFields'));
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!title.trim() || !category || !description.trim()) {
        toast.error(t('fillAllFields'));
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (images.length === 0) {
        toast.error(t('atLeastOneImage'));
        return;
      }
      setStep(4);
    }
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const handlePreSubmit = () => {
    if (!phone.trim()) {
      toast.error(t('fillAllFields'));
      return;
    }
    if (type === 'lost' && reward && isNaN(Number(reward))) {
      toast.error(t('rewardOnlyNumbers'));
      return;
    }
    setShowSafetyModal(true);
  };

  const onFinalSubmit = async () => {
    if (!userId) return;
    
    setShowSafetyModal(false);
    setLoading(true);
    
    try {
      let token = await getToken({ template: 'supabase' });
      if (!token) throw new Error("Authentication token missing");
      
      let supabase = createClerkSupabaseClient(token);

      const imageUrls = [];
      for (const file of images) {
        const compressedFile = await compressImage(file);
        const ext = compressedFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('items').upload(fileName, compressedFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('items').getPublicUrl(fileName);
        imageUrls.push(publicUrl);
      }

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

      const { data: item, error: itemError } = await supabase.from('items').insert([itemData]).select().single();
      if (itemError) throw itemError;

      if (imageUrls.length > 0) {
        const imageRecords = imageUrls.map(url => ({ item_id: item.id, image_url: url }));
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
    <div className="container mx-auto px-0 sm:px-4 py-0 sm:py-6 max-w-xl h-[calc(100vh-144px)] sm:h-auto flex flex-col">
      <Card className="flex-1 rounded-none sm:rounded-[2.5rem] overflow-hidden border-none sm:border shadow-none sm:shadow-2xl flex flex-col bg-white">
        {/* Step Indicator */}
        <div className="bg-zinc-900 px-6 py-4 flex items-center justify-between border-b border-zinc-800">
          <div className="flex gap-1.5 flex-1 max-w-[200px]">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div 
                key={i} 
                className={cn(
                  "h-1 rounded-full flex-1 transition-all duration-500",
                  step > i + 1 ? "bg-emerald-500" : step === i + 1 ? "bg-white" : "bg-zinc-700"
                )}
              />
            ))}
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-4">
            {t('step', { current: step, total: totalSteps })}
          </span>
        </div>

        <CardContent className="p-6 sm:p-10 flex-1 flex flex-col justify-center overflow-y-auto scrollbar-none">
          {/* Step 1: Type Selection */}
          {step === 1 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-black uppercase tracking-tight">{t('what_happened')}</h2>
              </div>
              <RadioGroup 
                onValueChange={(val) => setType(val as 'lost' | 'found')}
                className="grid grid-cols-1 gap-4"
              >
                <div className="relative">
                  <RadioGroupItem value="lost" id="lost" className="peer sr-only" />
                  <Label
                    htmlFor="lost"
                    className="flex items-center gap-6 rounded-3xl border-2 border-zinc-100 p-6 hover:bg-zinc-50 peer-data-[state=checked]:border-red-500 peer-data-[state=checked]:bg-red-50/30 cursor-pointer transition-all group"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">🔍</div>
                    <div className="flex-1">
                      <span className="block font-black text-lg uppercase leading-none mb-1">{t('lost')}</span>
                      <span className="text-zinc-500 text-xs font-bold">{t('lost_desc')}</span>
                    </div>
                    <div className="w-6 h-6 rounded-full border-2 border-zinc-200 peer-data-[state=checked]:border-red-500 peer-data-[state=checked]:bg-red-500 flex items-center justify-center transition-colors">
                      <div className="w-2 h-2 rounded-full bg-white opacity-0 peer-data-[state=checked]:opacity-100 transition-opacity" />
                    </div>
                  </Label>
                </div>
                <div className="relative">
                  <RadioGroupItem value="found" id="found" className="peer sr-only" />
                  <Label
                    htmlFor="found"
                    className="flex items-center gap-6 rounded-3xl border-2 border-zinc-100 p-6 hover:bg-zinc-50 peer-data-[state=checked]:border-emerald-500 peer-data-[state=checked]:bg-emerald-50/30 cursor-pointer transition-all group"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">🎁</div>
                    <div className="flex-1">
                      <span className="block font-black text-lg uppercase leading-none mb-1">{t('found')}</span>
                      <span className="text-zinc-500 text-xs font-bold">{t('found_desc')}</span>
                    </div>
                    <div className="w-6 h-6 rounded-full border-2 border-zinc-200 peer-data-[state=checked]:border-emerald-500 peer-data-[state=checked]:bg-emerald-500 flex items-center justify-center transition-colors">
                      <div className="w-2 h-2 rounded-full bg-white opacity-0 peer-data-[state=checked]:opacity-100 transition-opacity" />
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Step 2: Basic Info */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="space-y-2">
                <Label className="font-black text-[10px] uppercase tracking-[0.2em] text-zinc-400">{t('titleLabel')}</Label>
                <Input 
                  placeholder={t('titleLabel')} 
                  className="rounded-2xl h-14 bg-zinc-50 border-none text-lg font-bold focus-visible:ring-zinc-900" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="font-black text-[10px] uppercase tracking-[0.2em] text-zinc-400">{t('categoryLabel')}</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-14 rounded-2xl bg-zinc-50 border-none text-lg font-bold focus:ring-zinc-900">
                    <SelectValue placeholder={t('categoryLabel')} />
                  </SelectTrigger>
                  <SelectContent className="rounded-3xl border-none shadow-2xl">
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name} className="rounded-xl py-3 font-bold">
                        <span className="mr-2">{cat.icon}</span> {t(`categories.${cat.id}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-black text-[10px] uppercase tracking-[0.2em] text-zinc-400">{t('description')}</Label>
                <Textarea 
                  placeholder={t('description')} 
                  className="rounded-2xl min-h-[140px] bg-zinc-50 border-none text-lg font-bold focus-visible:ring-zinc-900 resize-none" 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Step 3: Photos */}
          {step === 3 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-black uppercase tracking-tight">{t('addImages')}</h2>
                <p className="text-zinc-500 text-sm font-medium">{t('maxImages')}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {previews.map((src, i) => (
                  <div key={i} className="relative aspect-square rounded-3xl overflow-hidden border-4 border-white shadow-lg group">
                    <Image src={src} alt="Preview" fill className="object-cover" />
                    <button 
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-xl shadow-xl active:scale-90 transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {images.length < 5 && (
                  <label className="aspect-square flex flex-col items-center justify-center border-4 border-dashed border-zinc-100 rounded-3xl cursor-pointer hover:bg-zinc-50 transition-all active:scale-95 group">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-400 group-hover:bg-zinc-900 group-hover:text-white transition-all">
                      <Plus className="w-6 h-6" />
                    </div>
                    <span className="mt-3 text-[10px] font-black uppercase tracking-widest text-zinc-400">{t('pickImage')}</span>
                    <input type="file" className="hidden" accept="image/*" multiple onChange={handleImageChange} />
                  </label>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Contact & Reward */}
          {step === 4 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-black uppercase tracking-tight">{t('phoneRequiredTitle')}</h2>
                <p className="text-zinc-500 text-sm font-medium">{t('phoneRequiredDesc')}</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="font-black text-[10px] uppercase tracking-[0.2em] text-zinc-400">{t('phoneLabel')}</Label>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-zinc-400">+992</span>
                    <Input 
                      className="rounded-2xl h-14 bg-zinc-50 border-none text-xl font-black pl-16 focus-visible:ring-zinc-900" 
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                      inputMode="numeric"
                      maxLength={9}
                    />
                  </div>
                </div>

                {type === 'lost' && (
                  <div className="space-y-2">
                    <Label className="font-black text-[10px] uppercase tracking-[0.2em] text-zinc-400">{t('reward_gives_input')}</Label>
                    <div className="relative">
                      <span className="absolute right-5 top-1/2 -translate-y-1/2 font-black text-zinc-400">TJS</span>
                      <Input 
                        placeholder="0"
                        className="rounded-2xl h-14 bg-zinc-50 border-none text-xl font-black pr-14 focus-visible:ring-zinc-900" 
                        value={reward}
                        onChange={(e) => setReward(e.target.value.replace(/[^0-9]/g, ''))}
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>

        {/* Navigation Footer */}
        <div className="p-6 sm:p-10 bg-white flex gap-3 sm:gap-4 items-center">
          {step > 1 && (
            <Button 
              variant="outline" 
              size="lg" 
              onClick={prevStep}
              className="rounded-2xl h-14 px-4 sm:px-8 border-2 font-black uppercase tracking-widest text-[10px] sm:text-[11px] hover:bg-zinc-50 shrink-0"
            >
              <ArrowLeft className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('back')}</span>
            </Button>
          )}
          <Button 
            size="lg" 
            onClick={step === totalSteps ? handlePreSubmit : nextStep}
            className={cn(
              "flex-1 rounded-2xl h-14 font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] text-[10px] sm:text-[11px] shadow-xl active:scale-95 transition-all duration-700 overflow-hidden",
              step === totalSteps ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20" : "bg-zinc-900 hover:bg-zinc-800 shadow-zinc-900/20",
              step === 1 && type && "bg-emerald-500 animate-[pulse_3s_cubic-bezier(0.4,0,0.6,1)_infinite] shadow-emerald-500/40 -translate-y-6 ring-8 ring-emerald-500/10"
            )}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (step === totalSteps ? t('publishBtn') : t('next'))}
          </Button>
        </div>
      </Card>

      {/* Safety Modal */}
      <Dialog open={showSafetyModal} onOpenChange={setShowSafetyModal}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
          <div className="p-10 space-y-6 text-center">
            <div className="w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-2 animate-in zoom-in duration-500 bg-red-50 dark:bg-red-900/20">
              <ShieldAlert className="w-10 h-10 text-red-500" />
            </div>

            <div className="space-y-3">
              <DialogTitle className="text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                {type === 'found' ? t('safetyPostModal.foundTitle') : t('safetyPostModal.lostTitle')}
              </DialogTitle>
              <p className="text-zinc-500 dark:text-zinc-400 font-bold text-sm leading-relaxed">
                {type === 'found' ? t('safetyPostModal.foundDesc') : t('safetyPostModal.lostDesc')}
              </p>
            </div>
          </div>

          <div className="px-10 pb-10">
            <Button
              onClick={onFinalSubmit}
              className="w-full h-16 rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-xs text-white shadow-xl transition-all active:scale-95 border-none bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/10"
            >
              {t('safetyPostModal.confirmBtn')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
