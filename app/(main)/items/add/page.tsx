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
  
  // Маълумоти эълон (Consolidated State for better stability)
  const [formData, setFormData] = useState({
    type: null as 'lost' | 'found' | null,
    title: "",
    category: "",
    description: "",
    phone: "",
    reward: ""
  });
  
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
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
          setFormData(prev => ({ ...prev, phone: profile.phone as string }));
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
      if (!formData.type) {
        toast.error(t('fillAllFields'));
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!formData.title.trim() || !formData.category || !formData.description.trim()) {
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
    if (!formData.phone.trim()) {
      toast.error(t('fillAllFields'));
      return;
    }
    if (formData.type === 'lost' && formData.reward && isNaN(Number(formData.reward))) {
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
        title: formData.title,
        description: formData.description,
        category: formData.category,
        type: formData.type,
        phone_number: formData.phone,
        reward: (formData.type === 'lost' && formData.reward) ? `${formData.reward}` : null,
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
        {/* Step Indicator - Full Width Minimalist */}
        <div className="w-full flex h-1.5 gap-1 bg-zinc-50 dark:bg-zinc-900 overflow-hidden">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div 
              key={i} 
              className={cn(
                "h-full flex-1 transition-all duration-700 ease-in-out",
                step > i + 1 ? "bg-emerald-500" : step === i + 1 ? "bg-emerald-400" : "bg-zinc-100 dark:bg-zinc-800"
              )}
            />
          ))}
        </div>

        <CardContent className="p-6 sm:p-10 flex-1 flex flex-col justify-center overflow-y-auto scrollbar-none">
          {/* Step 1: Type Selection */}
          {step === 1 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-black uppercase tracking-tight">{t('what_happened')}</h2>
              </div>
              <RadioGroup 
                value={formData.type || ""}
                onValueChange={(val) => setFormData(prev => ({ ...prev, type: val as 'lost' | 'found' }))}
                className="grid grid-cols-1 gap-4"
              >
                <div className="relative">
                  <Label
                    htmlFor="lost"
                    className="flex items-center gap-6 rounded-3xl border-2 border-zinc-100 p-6 hover:bg-zinc-50 has-[button[data-state=checked]]:border-emerald-500 has-[button[data-state=checked]]:bg-emerald-50/30 cursor-pointer transition-all group"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">🔍</div>
                    <div className="flex-1">
                      <span className="block font-black text-lg uppercase leading-none mb-1">{t('lost')}</span>
                      <span className="text-zinc-500 text-xs font-bold">{t('lost_desc')}</span>
                    </div>
                    <RadioGroupItem 
                      value="lost" 
                      id="lost" 
                      className="w-6 h-6 border-2 border-zinc-200 data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500 [&_span]:hidden transition-colors" 
                    />
                  </Label>
                </div>
                <div className="relative">
                  <Label
                    htmlFor="found"
                    className="flex items-center gap-6 rounded-3xl border-2 border-zinc-100 p-6 hover:bg-zinc-50 has-[button[data-state=checked]]:border-emerald-500 has-[button[data-state=checked]]:bg-emerald-50/30 cursor-pointer transition-all group"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">🎁</div>
                    <div className="flex-1">
                      <span className="block font-black text-lg uppercase leading-none mb-1">{t('found')}</span>
                      <span className="text-zinc-500 text-xs font-bold">{t('found_desc')}</span>
                    </div>
                    <RadioGroupItem 
                      value="found" 
                      id="found" 
                      className="w-6 h-6 border-2 border-zinc-200 data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500 [&_span]:hidden transition-colors" 
                    />
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Step 2: Basic Info */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 max-w-lg mx-auto w-full">
              <div className="space-y-2 group">
                <Input 
                  id="title"
                  name="title"
                  placeholder={t('titleLabel')}
                  className={cn(
                    "rounded-xl h-14 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-base font-medium focus-visible:border-emerald-500 focus-visible:ring-emerald-500/10 shadow-none transition-all placeholder:text-zinc-400/60",
                    formData.title.trim().length > 0 && "border-emerald-500 ring-emerald-500/5"
                  )}
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div className="space-y-2 group">
                <Select value={formData.category} onValueChange={(val) => setFormData(prev => ({ ...prev, category: val }))}>
                  <SelectTrigger 
                    id="category" 
                    className={cn(
                      "h-14 rounded-xl bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-base font-medium focus:border-emerald-500 focus:ring-emerald-500/10 shadow-none transition-all",
                      formData.category && "border-emerald-500 ring-emerald-500/5"
                    )}
                  >
                    <SelectValue placeholder={<span className="text-zinc-400/60">{t('categoryLabel')}</span>} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-zinc-200 dark:border-zinc-800 shadow-xl">
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name} className="rounded-lg py-3 font-medium">
                        <span className="mr-2">{cat.icon}</span> {t(`categories.${cat.id}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 group">
                <Textarea 
                  id="description"
                  name="description"
                  placeholder={t('description')}
                  className={cn(
                    "rounded-xl min-h-[160px] bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-base font-medium focus-visible:border-emerald-500 focus-visible:ring-emerald-500/10 shadow-none resize-none p-4 transition-all placeholder:text-zinc-400/60",
                    formData.description.trim().length > 0 && "border-emerald-500 ring-emerald-500/5"
                  )}
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* Step 3: Photos */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 max-w-lg mx-auto w-full">
              <div className="space-y-1.5 text-center mb-4">
                <h2 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white leading-none">
                  {t('addImages')}
                </h2>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                  {t('maxImages')}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {previews.map((src, i) => (
                  <div key={i} className="relative aspect-square rounded-[2rem] overflow-hidden group border-2 border-emerald-500/20 shadow-sm">
                    <Image src={src} alt="Preview" fill className="object-cover" />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
                    <button 
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute top-2.5 right-2.5 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md text-red-500 p-2 rounded-2xl shadow-xl active:scale-90 transition-all border border-red-500/10"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-2.5 left-2.5">
                      <div className="bg-emerald-500 text-white text-[8px] font-black uppercase px-2 py-1 rounded-lg tracking-widest shadow-lg shadow-emerald-500/20">
                        {i + 1}
                      </div>
                    </div>
                  </div>
                ))}
                {images.length < 5 && (
                  <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-[2rem] cursor-pointer hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10 transition-all active:scale-95 group relative overflow-hidden">
                    <div className="w-14 h-14 rounded-2xl bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center text-zinc-400 group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-sm">
                      <Plus className="w-7 h-7" />
                    </div>
                    <span className="mt-3 text-[9px] font-black uppercase tracking-widest text-zinc-400 group-hover:text-emerald-600 transition-colors">{t('pickImage')}</span>
                    <input type="file" className="hidden" accept="image/*" multiple onChange={handleImageChange} />
                  </label>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Contact & Reward */}
          {step === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 max-w-lg mx-auto w-full">
              <div className="space-y-1.5 text-center mb-6">
                <h2 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white leading-none">
                  {t('phoneRequiredTitle')}
                </h2>
              </div>

              <div className="space-y-4">
                <div className="space-y-2 group">
                  <div className="relative">
                    <Input 
                      id="phone"
                      name="phone"
                      placeholder={t('phoneLabel')}
                      className={cn(
                        "rounded-xl h-14 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-lg font-black px-5 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/10 shadow-none transition-all placeholder:text-zinc-400/60 placeholder:font-medium placeholder:text-base",
                        formData.phone.length > 0 && "border-emerald-500 ring-emerald-500/5 text-emerald-600"
                      )}
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value.replace(/[^0-9]/g, '') }))}
                      inputMode="numeric"
                      maxLength={9}
                    />
                  </div>
                </div>

                {formData.type === 'lost' && (
                  <div className="space-y-2 group">
                    <div className="relative">
                      <span className={cn(
                        "absolute right-5 top-1/2 -translate-y-1/2 font-black text-sm transition-colors",
                        formData.reward.length > 0 ? "text-emerald-600" : "text-zinc-400"
                      )}>
                        TJS
                      </span>
                      <Input 
                        id="reward"
                        name="reward"
                        placeholder={t('reward_gives_input')}
                        className={cn(
                          "rounded-xl h-14 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-lg font-black pr-14 pl-5 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/10 shadow-none transition-all placeholder:text-zinc-400/60 placeholder:font-medium placeholder:text-base",
                          formData.reward.length > 0 && "border-emerald-500 ring-emerald-500/5 text-emerald-600"
                        )}
                        value={formData.reward}
                        onChange={(e) => setFormData(prev => ({ ...prev, reward: e.target.value.replace(/[^0-9]/g, '') }))}
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
              step === 1 && formData.type && "bg-emerald-500 animate-[pulse_3s_cubic-bezier(0.4,0,0.6,1)_infinite] shadow-emerald-500/40 -translate-y-6 ring-8 ring-emerald-500/10"
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
                {formData.type === 'found' ? t('safetyPostModal.foundTitle') : t('safetyPostModal.lostTitle')}
              </DialogTitle>
              <p className="text-zinc-500 dark:text-zinc-400 font-bold text-sm leading-relaxed">
                {formData.type === 'found' ? t('safetyPostModal.foundDesc') : t('safetyPostModal.lostDesc')}
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
