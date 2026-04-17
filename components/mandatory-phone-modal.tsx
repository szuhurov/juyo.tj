"use client";

import { useEffect, useState } from "react";
import { useUser, useAuth } from "@clerk/nextjs";
import { useLanguage } from "@/lib/language-context";
import { ProfileService } from "@/lib/services/profile-service";
import { createClerkSupabaseClient } from "@/lib/supabase";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";

export function MandatoryPhoneModal() {
  const { user, isLoaded: userLoaded } = useUser();
  const { getToken, userId } = useAuth();
  const { t, locale, setLocale } = useLanguage();
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      if (!userId || !userLoaded) return;
      
      try {
        const token = await getToken({ template: 'supabase' });
        const supabase = createClerkSupabaseClient(token!);
        const data = await ProfileService.getProfile(supabase, userId);
        
        // СТРИКТ ТАФТИШ: Агар ҳатто яке аз инҳо набошад, модалро нишон деҳ
        const isMissingData = 
          !data?.phone || 
          !data?.secondary_phone || 
          data?.accepted_terms !== true || 
          !data?.accepted_at || 
          !data?.terms_version;

        if (data && isMissingData) {
          setShowModal(true);
        }
      } catch (err) {
        console.error("Error checking profile status:", err);
      }
    };

    checkStatus();
  }, [userId, userLoaded, getToken]);

  const handleSaveData = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!acceptedTerms) {
      toast.error(t('terms.error') || "Лутфан шартҳоро қабул кунед");
      return;
    }

    const formData = new FormData(e.currentTarget);
    const phone = (formData.get('phone') as string).trim();
    const secondary_phone = (formData.get('secondary_phone') as string).trim();
    
    if (phone.length < 9 || secondary_phone.length < 9) {
      toast.error(t('phoneMinLength'));
      return;
    }

    if (phone === secondary_phone) {
      toast.error(t('phonesMustBeDifferent') || "Рақами аввал ва дуюм бояд аз ҳам фарқ кунанд");
      return;
    }

    setLoading(true);
    try {
      const token = await getToken({ template: 'supabase' });
      const supabase = createClerkSupabaseClient(token!);
      
      await ProfileService.updateProfile(supabase, userId!, {
        phone,
        secondary_phone,
        accepted_terms: true,
        accepted_at: new Date().toISOString(),
        terms_version: "v1.0",
        first_name: user?.firstName || "",
        last_name: user?.lastName || "",
        avatar_url: user?.imageUrl || ""
      });
      
      setShowModal(false);
      toast.success(t('phoneSaved'));
      window.location.reload(); 
    } catch (err) {
      toast.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  if (!showModal) return null;

  return (
    <Dialog open={showModal} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md rounded-3xl p-8 gap-6 border-4 border-red-600 shadow-2xl bg-white dark:bg-zinc-950 z-[100]" 
        onPointerDownOutside={(e) => e.preventDefault()} 
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-3">
          <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 flex items-center justify-center mx-auto mb-2 animate-pulse">
            <Phone className="w-8 h-8" />
          </div>

          {/* Language Switcher */}
          <div className="flex justify-center gap-2 mb-2">
            {[
              { code: 'tg', label: 'TG' },
              { code: 'ru', label: 'RU' },
              { code: 'en', label: 'EN' }
            ].map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => setLocale(lang.code as any)}
                className={`px-3 py-1 rounded-full text-[10px] font-black transition-all ${
                  locale === lang.code 
                    ? 'bg-red-600 text-white' 
                    : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>

          <DialogTitle className="text-2xl font-black uppercase tracking-tight text-center text-red-600">
            {t('phoneRequiredTitle')}
          </DialogTitle>
          <DialogDescription className="text-zinc-500 font-medium text-center text-sm leading-relaxed">
            {t('phoneRequiredDesc')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSaveData} className="space-y-4 pt-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">
                {t('phoneLabel')}
              </Label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input 
                  name="phone" 
                  placeholder={t('phonePlaceholder')} 
                  className="h-14 pl-11 rounded-2xl bg-zinc-50 dark:bg-zinc-900 font-black text-lg tracking-widest border-2 border-zinc-100 focus:border-red-600 transition-all" 
                  required 
                  inputMode="numeric"
                  autoFocus
                  onChange={(e) => e.target.value = e.target.value.replace(/[^0-9]/g, '')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1 leading-tight block">
                {t('phoneSecondaryLabel')}
              </Label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input 
                  name="secondary_phone" 
                  placeholder={t('phoneSecondaryPlaceholder')} 
                  className="h-14 pl-11 rounded-2xl bg-zinc-50 dark:bg-zinc-900 font-black text-lg tracking-widest border-2 border-zinc-100 focus:border-red-600 transition-all placeholder:text-zinc-300 placeholder:text-sm placeholder:font-medium placeholder:tracking-normal" 
                  required 
                  inputMode="numeric"
                  onChange={(e) => e.target.value = e.target.value.replace(/[^0-9]/g, '')}
                />
              </div>
            </div>

            {/* Terms and Conditions Checkbox */}
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border-2 border-zinc-100 dark:border-zinc-800 space-y-3">
              <div className="flex items-start space-x-3">
                <Checkbox 
                  id="terms-check" 
                  checked={acceptedTerms} 
                  onCheckedChange={(val) => setAcceptedTerms(!!val)}
                  className="mt-1 border-2 border-red-600 data-[state=checked]:bg-red-600"
                />
                <Label 
                  htmlFor="terms-check" 
                  className="text-[11px] font-bold leading-tight cursor-pointer text-zinc-600 dark:text-zinc-400"
                >
                  {t('terms.checkbox')}
                </Label>
              </div>
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-100 dark:shadow-none transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
            disabled={loading || !acceptedTerms}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t('savePhone')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
