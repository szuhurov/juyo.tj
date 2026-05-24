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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Plus, X, Upload, ArrowLeft, ShieldAlert, CheckCircle2, Search } from "lucide-react";
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
import { useQueryClient } from "@tanstack/react-query";
import { ITEM_KEYS } from "@/lib/hooks/use-items";

function AddItemForm() {
  const { t, language } = useLanguage();
  const router = useRouter();
  const { userId, getToken } = useAuth();
  const queryClient = useQueryClient();
  
  // Ҳолатҳои форма (Form States)
  const [step, setStep] = useState(1);
  const totalSteps = 6;
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
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);
  const [moderationStatus, setModerationStatus] = useState<'idle' | 'checking' | 'passed' | 'failed'>('idle');
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [showSearchChoice, setShowSearchChoice] = useState(false);

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

  // Санҷиши AI (AI Brain Check)
  const runAICheck = async () => {
    if (images.length === 0) return;
    
    setStep(5); // Қадами 5: Санҷиши амниятӣ
    setModerationStatus('checking');
    setModerationError(null);
    setShowSearchChoice(false);
    
    try {
      const token = await getToken({ template: 'supabase' });
      const supabase = createClerkSupabaseClient(token!);
      
      const formDataAI = new FormData();
      formDataAI.append('image', images[0]);
      formDataAI.append('type', formData.type || 'lost');
      formDataAI.append('title', formData.title);
      formDataAI.append('description', formData.description);
      formDataAI.append('lang', language);
      formDataAI.append('mode', 'moderation');

      const { data, error } = await supabase.functions.invoke('ai-brain', {
        body: formDataAI,
      });

      if (error || (data && data.is_safe === false)) {
        setModerationStatus('failed');
        const errorMsg = data?.reason || error?.message || t('error');
        setModerationError(errorMsg);
        return;
      }

      setModerationStatus('passed');
      
      // Нишон додани интихоби ҷустуҷӯ баъд аз 1 сония
      setTimeout(() => {
        setShowSearchChoice(true);
      }, 1000);

    } catch (error: any) {
      console.error("AI Check Error:", error);
      setModerationStatus('failed');
      setModerationError(error.message);
    }
  };

  // Ҷустуҷӯи монандҳо (Similarity Search)
  const runSimilaritySearch = async () => {
    setModerationStatus('checking');
    try {
      const token = await getToken({ template: 'supabase' });
      const supabase = createClerkSupabaseClient(token!);
      
      const formDataAI = new FormData();
      formDataAI.append('image', images[0]);
      formDataAI.append('type', formData.type || 'lost');
      formDataAI.append('title', formData.title);
      formDataAI.append('description', formData.description);
      formDataAI.append('lang', language);
      formDataAI.append('mode', 'similarity');

      const { data, error } = await supabase.functions.invoke('ai-brain', {
        body: formDataAI,
      });

      if (error) throw error;

      setAiSuggestions(data);
      
      // Авто-пуркунии категория ва тавсиф агар холӣ бошад
      if (data.analysis) {
        setFormData(prev => ({
          ...prev,
          category: prev.category || data.analysis.category,
          description: prev.description || data.analysis.description_tj
        }));
      }

      setModerationStatus('passed');
      setStep(6);
    } catch (error: any) {
      console.error("Similarity Search Error:", error);
      toast.error(error.message || t('error'));
      setModerationStatus('passed');
      setShowSearchChoice(true);
    }
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
    } else if (step === 4) {
      if (!formData.phone.trim()) {
        toast.error(t('fillAllFields'));
        return;
      }
      runAICheck();
    } else if (step === 6) {
      setShowSafetyModal(true);
    }
  };

  const prevStep = () => {
    if (step > 1 && step <= 4) setStep(step - 1);
    else if (step === 5 || (step === 6 && showSearchChoice)) setStep(5);
    else if (step === 6) setStep(4);
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
        moderation_status: 'approved',
        moderation_result: aiSuggestions?.analysis?.description_tj || "Approved by AI Brain"
      };

      const { data: item, error: itemError } = await supabase.from('items').insert([itemData]).select().single();
      if (itemError) throw itemError;

      if (imageUrls.length > 0) {
        // Гирифтани Embedding (кобани ҳамаи ҷойҳои имконпазир)
        let itemEmbedding = aiSuggestions?.embedding || aiSuggestions?.analysis?.embedding;
        
        console.log("AI Response Raw Data:", aiSuggestions);
        console.log("Detected Embedding:", itemEmbedding ? "YES (Length: " + itemEmbedding.length + ")" : "NO (null)");

        const imageRecords = imageUrls.map((url, index) => {
          // Барои Supabase JS Client мо бояд массив фиристем [0.1, 0.2, ...]
          // Танҳо ба сурати аввал Embedding-ро мечаспонем
          const vectorData = (index === 0 && Array.isArray(itemEmbedding)) ? itemEmbedding : null;

          return { 
            item_id: item.id, 
            image_url: url,
            embedding: vectorData
          };
        });

        console.log("Attempting to save image records with raw vector array...");
        const { error: imagesError } = await supabase.from('item_images').insert(imageRecords);
        
        if (imagesError) {
          console.error("CRITICAL DATABASE ERROR:", imagesError.message, imagesError.details);
          toast.error("Database rejected AI Vector: " + imagesError.message);
        } else {
          console.log("SUCCESS: Embedding vector saved to Supabase!");
        }
      }

      toast.success(t('imageModeration.submitted'));
      await queryClient.invalidateQueries({ queryKey: ITEM_KEYS.user() });
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
    <div className="container mx-auto px-0 sm:px-4 py-0 sm:py-6 max-w-xl md:max-w-4xl h-[calc(100vh-144px)] sm:h-auto flex flex-col">
      <Card className="flex-1 rounded-none sm:rounded-[3rem] overflow-hidden border-none sm:border shadow-none sm:shadow-2xl flex flex-col bg-white">
        {/* Step Indicator */}
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

        <CardContent className="p-6 sm:p-8 md:px-16 md:py-6 flex-1 flex flex-col justify-center overflow-y-auto scrollbar-none">
          {/* Step 1: Type Selection */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-lg mx-auto w-full">
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-black uppercase tracking-tight">{t('what_happened')}</h2>
              </div>
              <RadioGroup 
                value={formData.type || ""}
                onValueChange={(val) => setFormData(prev => ({ ...prev, type: val as 'lost' | 'found' }))}
                className="grid grid-cols-1 gap-3"
              >
                <div className="relative">
                  <Label
                    htmlFor="lost"
                    className="flex items-center gap-6 rounded-3xl border-2 border-zinc-100 p-5 hover:bg-zinc-50 has-[button[data-state=checked]]:border-emerald-500 has-[button[data-state=checked]]:bg-emerald-50/30 cursor-pointer transition-all group"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">🔍</div>
                    <div className="flex-1">
                      <span className="block font-black text-lg uppercase leading-none mb-1">{t('lost')}</span>
                      <span className="text-zinc-500 text-[10px] font-bold">{t('lost_desc')}</span>
                    </div>
                    <RadioGroupItem value="lost" id="lost" className="w-6 h-6 border-2 border-zinc-200 data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500 [&_span]:hidden transition-colors" />
                  </Label>
                </div>
                <div className="relative">
                  <Label
                    htmlFor="found"
                    className="flex items-center gap-6 rounded-3xl border-2 border-zinc-100 p-5 hover:bg-zinc-50 has-[button[data-state=checked]]:border-emerald-500 has-[button[data-state=checked]]:bg-emerald-50/30 cursor-pointer transition-all group"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">🎁</div>
                    <div className="flex-1">
                      <span className="block font-black text-lg uppercase leading-none mb-1">{t('found')}</span>
                      <span className="text-zinc-500 text-[10px] font-bold">{t('found_desc')}</span>
                    </div>
                    <RadioGroupItem value="found" id="found" className="w-6 h-6 border-2 border-zinc-200 data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500 [&_span]:hidden transition-colors" />
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Step 2: Details */}
          {step === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 animate-in fade-in slide-in-from-right-4 duration-500 w-full items-start">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">{t('titleLabel')}</Label>
                  <Input 
                    placeholder={t('titleLabel')}
                    className="rounded-xl h-12 bg-white dark:bg-zinc-950 border-zinc-200 text-sm font-medium focus-visible:border-emerald-500 shadow-none"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">{t('description')}</Label>
                  <Textarea 
                    placeholder={t('description')}
                    className="rounded-xl min-h-[140px] bg-white border-zinc-200 text-sm font-medium focus-visible:border-emerald-500 shadow-none resize-none"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">{t('categoryLabel')}</Label>
                <div className="grid grid-cols-2 gap-2.5">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, category: cat.name }))}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border-2 transition-all active:scale-95 text-left",
                        formData.category === cat.name ? "border-emerald-500 bg-emerald-50/30 text-emerald-700 shadow-sm" : "border-zinc-100 bg-white hover:border-zinc-200 text-zinc-600"
                      )}
                    >
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-lg shrink-0", formData.category === cat.name ? "bg-emerald-100" : "bg-zinc-50")}>
                        {cat.icon}
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-tight leading-tight">{t(`categories.${cat.id}`)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Photos */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 max-w-lg mx-auto w-full">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {previews.map((src, i) => (
                  <div key={i} className="relative aspect-square rounded-[2rem] overflow-hidden group border-2 border-emerald-500/20 shadow-sm">
                    <Image src={src} alt="Preview" fill className="object-cover" />
                    <button type="button" onClick={() => removeImage(i)} className="absolute top-2.5 right-2.5 bg-white/90 text-red-500 p-2 rounded-2xl shadow-xl active:scale-90 transition-all">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {images.length < 5 && (
                  <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 rounded-[2rem] cursor-pointer hover:bg-emerald-50/30 transition-all active:scale-95 group">
                    <div className="w-14 h-14 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-400 group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-sm">
                      <Plus className="w-7 h-7" />
                    </div>
                    <span className="mt-3 text-[9px] font-black uppercase tracking-widest text-zinc-400 group-hover:text-emerald-600 transition-colors">{t('pickImage')}</span>
                    <input type="file" className="hidden" accept="image/*" multiple onChange={handleImageChange} />
                  </label>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Contact */}
          {step === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 max-w-lg mx-auto w-full">
              <div className="space-y-4">
                <Input 
                  placeholder={t('phoneLabel')}
                  className="rounded-xl h-14 bg-white border-zinc-200 text-lg font-black px-5 focus-visible:border-emerald-500 transition-all"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value.replace(/[^0-9]/g, '') }))}
                  inputMode="numeric"
                  maxLength={9}
                />
                {formData.type === 'lost' && (
                  <div className="relative">
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 font-black text-sm text-zinc-400">TJS</span>
                    <Input 
                      placeholder={t('reward_gives_input')}
                      className="rounded-xl h-14 bg-white border-zinc-200 text-lg font-black pr-14 pl-5 focus-visible:border-emerald-500 transition-all"
                      value={formData.reward}
                      onChange={(e) => setFormData(prev => ({ ...prev, reward: e.target.value.replace(/[^0-9]/g, '') }))}
                      inputMode="numeric"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 5: Security Scan (New) */}
          {step === 5 && (
            <div className="space-y-8 text-center animate-in fade-in zoom-in duration-500 max-w-md mx-auto">
              {moderationStatus === 'checking' && (
                <>
                  <div className="w-24 h-24 rounded-[2.5rem] bg-zinc-900 flex items-center justify-center mx-auto shadow-2xl relative">
                    <Loader2 className="w-10 h-10 text-white animate-spin" />
                    <div className="absolute inset-0 border-4 border-emerald-500/20 border-t-emerald-500 rounded-[2.5rem] animate-spin" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-black uppercase tracking-tight">{t('ai_steps.step5_title')}</h2>
                    <p className="text-zinc-500 font-bold text-sm">{t('ai_steps.step5_desc')}</p>
                  </div>
                </>
              )}
              {moderationStatus === 'passed' && (
                <>
                  {!showSearchChoice ? (
                    <>
                      <div className="w-24 h-24 rounded-[2.5rem] bg-emerald-500 flex items-center justify-center mx-auto shadow-2xl">
                        <CheckCircle2 className="w-12 h-12 text-white" />
                      </div>
                      <div className="space-y-2">
                        <h2 className="text-2xl font-black uppercase tracking-tight text-emerald-600">{t('ai_steps.step5_passed')}</h2>
                        <p className="text-zinc-500 font-bold text-sm">{t('ai_steps.step5_passed_desc')}</p>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="w-24 h-24 rounded-[2.5rem] bg-emerald-100 flex items-center justify-center mx-auto text-3xl">🔎</div>
                      <div className="space-y-2">
                        <h2 className="text-2xl font-black uppercase tracking-tight">{t('ai_steps.ask_search_title')}</h2>
                        <p className="text-zinc-500 font-bold text-sm leading-relaxed">{t('ai_steps.ask_search_desc')}</p>
                      </div>
                      <div className="flex flex-col gap-3 pt-4">
                        <Button 
                          onClick={runSimilaritySearch}
                          className="h-14 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white font-black uppercase tracking-widest text-[10px] shadow-xl"
                        >
                          {t('ai_steps.btn_search_yes')}
                        </Button>
                        <Button 
                          variant="ghost"
                          onClick={() => setShowSafetyModal(true)}
                          className="h-12 font-bold uppercase tracking-widest text-[10px] text-zinc-400"
                        >
                          {t('ai_steps.btn_search_no')}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
              {moderationStatus === 'failed' && (
                <>
                  <div className="w-24 h-24 rounded-[2.5rem] bg-red-100 flex items-center justify-center mx-auto shadow-lg">
                    <ShieldAlert className="w-12 h-12 text-red-600" />
                  </div>
                  <div className="space-y-3">
                    <h2 className="text-2xl font-black uppercase tracking-tight text-red-600">{t('ai_steps.step5_failed')}</h2>
                    <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                      <p className="text-red-700 font-bold text-sm leading-relaxed">
                        {moderationError || t('error')}
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => setStep(4)} className="rounded-xl font-bold uppercase text-[10px] tracking-widest mt-4">{t('ai_steps.step5_fix_btn')}</Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 6: Similarity Search (New) */}
          {step === 6 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 w-full">
              <div className="text-center space-y-2 mb-6">
                <h2 className="text-2xl font-black uppercase tracking-tight">{t('ai_steps.step6_title')}</h2>
                <p className="text-zinc-500 font-bold text-sm">
                  {aiSuggestions?.similarItems?.length > 0 ? t('ai_steps.step6_found_desc') : t('ai_steps.step6_not_found_desc')}
                </p>
              </div>
              {aiSuggestions?.similarItems?.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto p-2 scrollbar-none">
                  {aiSuggestions.similarItems.map((item: any) => (
                    <div key={item.id} className="flex items-center gap-4 p-4 rounded-3xl border-2 border-zinc-100 hover:border-emerald-500 cursor-pointer transition-all bg-zinc-50/30 group" onClick={() => router.push(`/items/${item.id}`)}>
                      <div className="relative w-20 h-20 rounded-2xl overflow-hidden shrink-0 shadow-sm">
                        <Image src={item.item_images?.[0]?.image_url || "/placeholder.png"} alt={item.title} fill className="object-cover group-hover:scale-110 transition-transform" />
                        <div className="absolute top-1 right-1 bg-emerald-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-lg shadow-lg">{item.match_percentage}%</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-black uppercase text-xs truncate mb-1">{item.title}</h4>
                        <p className="text-[10px] font-bold text-zinc-400 line-clamp-2 leading-tight uppercase">{item.category}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {aiSuggestions?.similarItems?.length === 0 && (
                <div className="py-12 text-center">
                  <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-zinc-200">
                    <Search className="w-8 h-8 text-zinc-300" />
                  </div>
                  <p className="text-zinc-400 font-bold text-xs uppercase tracking-widest">{t('ai_steps.step6_no_matches')}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>

        {/* Navigation Footer */}
        <div className="p-6 sm:p-10 bg-white flex gap-3 sm:gap-4 items-center">
          {step > 1 && step <= 4 && (
            <Button variant="outline" size="lg" onClick={prevStep} className="rounded-2xl h-14 px-4 sm:px-8 border-2 font-black uppercase tracking-widest text-[10px] hover:bg-zinc-50 shrink-0">
              <ArrowLeft className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('back')}</span>
            </Button>
          )}
          {step <= 4 && (
            <Button size="lg" onClick={nextStep} className={cn("flex-1 rounded-2xl h-14 font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-all duration-700 overflow-hidden", step === 4 ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20" : "bg-zinc-900 hover:bg-zinc-800 shadow-zinc-900/20", step === 1 && formData.type && "bg-emerald-500 -translate-y-2 ring-8 ring-emerald-500/10")}>
              {step === 4 ? t('publishBtn') : t('next')}
            </Button>
          )}
          {step === 6 && (
            <div className="flex-1 flex gap-3">
              <Button variant="outline" onClick={() => setStep(4)} className="flex-1 rounded-2xl h-14 border-2 font-black uppercase tracking-widest text-[10px]">{t('back')}</Button>
              <Button onClick={() => setShowSafetyModal(true)} disabled={loading} className="flex-1 rounded-2xl h-14 bg-emerald-500 hover:bg-emerald-600 font-black uppercase tracking-widest text-[10px] shadow-xl shadow-emerald-500/20">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('ai_steps.publish_now')}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Safety Confirmation Modal */}
      <Dialog open={showSafetyModal} onOpenChange={setShowSafetyModal}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
          <div className="p-10 space-y-6 text-center">
            <div className="w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-2 bg-red-50 animate-in zoom-in duration-500">
              <ShieldAlert className="w-10 h-10 text-red-500" />
            </div>
            <div className="space-y-3">
              <DialogTitle className="text-2xl font-black uppercase tracking-tight">{formData.type === 'found' ? t('safetyPostModal.foundTitle') : t('safetyPostModal.lostTitle')}</DialogTitle>
              <p className="text-zinc-500 font-bold text-sm leading-relaxed">{formData.type === 'found' ? t('safetyPostModal.foundDesc') : t('safetyPostModal.lostDesc')}</p>
            </div>
          </div>
          <div className="px-10 pb-10">
            <Button onClick={onFinalSubmit} className="w-full h-16 rounded-[1.5rem] font-black uppercase tracking-widest text-xs text-white bg-emerald-500 hover:bg-emerald-600 shadow-xl">{t('safetyPostModal.confirmBtn')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AddItemPage() {
  return (
    <TooltipProvider>
      <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="w-10 h-10 animate-spin" /></div>}>
        <AddItemForm />
      </Suspense>
    </TooltipProvider>
  );
}
