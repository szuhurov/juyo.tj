"use client";

/**
 * Модали ҳатмии рақами телефон.
 * Ин компонент намегузорад, ки корбар бе рақами телефон ва қабули шартҳо барномаро истифода барад.
 */

import { useEffect, useState } from "react"; // Хукҳои React
import { useUser, useAuth, useClerk } from "@clerk/nextjs"; // Барои гирифтани маълумоти корбар ва хуруҷ
import { useLanguage } from "@/lib/language-context"; // Барои тарҷумаи забон
import { ProfileService } from "@/lib/services/profile-service"; // Барои кор бо профили корбар
import { createClerkSupabaseClient } from "@/lib/supabase"; // Барои пайваст шудан ба база
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"; // Барои тирезаҳои огоҳӣ
import { Button } from "@/components/ui/button"; // Компоненти тугма
import { Input } from "@/components/ui/input"; // Компоненти воридкунии матн
import { Label } from "@/components/ui/label"; // Компоненти тамға
import { Phone, Loader2, LogOut } from "lucide-react"; // Иконкаҳо
import { toast } from "sonner"; // Барои хабарҳои кӯтоҳ
import { Checkbox } from "@/components/ui/checkbox"; // Компоненти чексбокс
import { cn } from "@/lib/utils"; // Барои пайваст кардани стилҳо

export function MandatoryPhoneModal() {
  const { user, isLoaded: userLoaded } = useUser();
  const { getToken, userId } = useAuth();
  const { signOut } = useClerk(); // Функсияи хуруҷ аз Clerk
  const { t, locale, setLocale } = useLanguage();
  
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [secondaryType, setSecondaryType] = useState<string>("");

  useEffect(() => {
    const checkStatus = async () => {
      if (!userId || !userLoaded) return;
      
      try {
        const token = await getToken({ template: 'supabase' });
        const supabase = createClerkSupabaseClient(token!);
        const data = await ProfileService.getProfile(supabase, userId);
        
        const isMissingData = 
          !data?.phone || 
          !data?.secondary_phone || 
          !data?.secondary_phone_type ||
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

    if (!secondaryType) {
      toast.error(t('fillAllFields'));
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
      toast.error(t('phonesMustBeDifferent'));
      return;
    }

    setLoading(true);
    try {
      const token = await getToken({ template: 'supabase' });
      const supabase = createClerkSupabaseClient(token!);
      
      await ProfileService.updateProfile(supabase, userId!, {
        phone,
        secondary_phone,
        secondary_phone_type: secondaryType,
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
        className="sm:max-w-md rounded-[2.5rem] p-0 gap-0 border-none shadow-2xl bg-white dark:bg-zinc-950 z-[100] max-h-[90vh] overflow-hidden flex flex-col" 
        onPointerDownOutside={(e) => e.preventDefault()} 
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* STICKY HEADER БО ИНТИХОБИ ЗАБОН ВА ХУРУҶ */}
        <div className="sticky top-0 z-50 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-100 dark:border-zinc-800 px-6 py-3 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={async () => {
              setShowModal(false);
              await signOut();
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-red-50 text-zinc-500 hover:text-red-600 transition-all group"
          >
            <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-tight">{t('signOut')}</span>
          </button>
          
          <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl shrink-0">
            {[
              { code: 'tg', label: 'TJ' },
              { code: 'ru', label: 'RU' },
              { code: 'en', label: 'EN' }
            ].map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => setLocale(lang.code as any)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-[10px] font-black transition-all duration-200",
                  locale === lang.code 
                    ? "bg-white dark:bg-zinc-800 text-red-600 shadow-sm" 
                    : "text-zinc-400 hover:text-zinc-600"
                )}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-8 py-6 space-y-6">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="text-xl font-black uppercase tracking-tight leading-tight text-zinc-900 dark:text-white">
              {t('phoneRequiredTitle')}
            </DialogTitle>
            <DialogDescription className="text-zinc-500 font-medium text-[13px] leading-relaxed">
              {t('phoneRequiredDesc')}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveData} id="mandatory-form" className="space-y-6">
            <div className="space-y-4">
              {/* РАҚАМИ АСОСӢ */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">
                  {t('phoneLabel')}
                </Label>
                <div className="relative group">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300 group-focus-within:text-red-600 transition-colors" />
                  <Input 
                    name="phone" 
                    placeholder={t('phonePlaceholder')} 
                    className="h-14 pl-11 rounded-2xl bg-zinc-50 dark:bg-zinc-900 font-black text-lg tracking-widest border-2 border-zinc-100 dark:border-zinc-800 focus:border-red-600 transition-all outline-none" 
                    required 
                    inputMode="numeric"
                    onChange={(e) => e.target.value = e.target.value.replace(/[^0-9]/g, '')}
                  />
                </div>
              </div>

              {/* РАҚАМИ ДУЮМ */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">
                  {t('phoneSecondaryLabel')}
                </Label>
                <div className="relative group">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300 group-focus-within:text-red-600 transition-colors" />
                  <Input 
                    name="secondary_phone" 
                    placeholder={t('phoneSecondaryPlaceholder')} 
                    className="h-14 pl-11 rounded-2xl bg-zinc-50 dark:bg-zinc-900 font-black text-lg tracking-widest border-2 border-zinc-100 dark:border-zinc-800 focus:border-red-600 transition-all outline-none" 
                    required 
                    inputMode="numeric"
                    onChange={(e) => e.target.value = e.target.value.replace(/[^0-9]/g, '')}
                  />
                </div>
              </div>
            </div>

            {/* ИНТИХОБИ СОҲИБИ РАҚАМ */}
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-zinc-900 dark:text-zinc-100 tracking-widest ml-1 leading-tight">
                {t('phoneSecondaryTypeLabel')}
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {['father', 'mother', 'brother', 'sister'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSecondaryType(type)}
                    className={cn(
                      "flex items-center justify-center py-3 px-2 rounded-xl border-2 transition-all duration-200",
                      secondaryType === type 
                        ? "border-red-600 bg-red-50 dark:bg-red-900/10 text-red-600 font-black" 
                        : "border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 hover:border-red-200"
                    )}
                  >
                    <span className="text-[11px] uppercase tracking-tight">
                      {t(`phoneSecondaryTypes.${type}`)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* ҚАБУЛИ ШАРТҲО */}
            <div className="flex items-center space-x-3 px-1 pt-2">
              <Checkbox 
                id="terms-check-compact" 
                checked={acceptedTerms} 
                onCheckedChange={(val) => setAcceptedTerms(!!val)}
                className="border-2 border-red-600 data-[state=checked]:bg-red-600 h-6 w-6 rounded-lg"
              />
              <Label 
                htmlFor="terms-check-compact" 
                className="text-[10px] font-extrabold leading-tight cursor-pointer text-zinc-400 uppercase tracking-tighter"
              >
                {t('terms.checkbox')}
              </Label>
            </div>
          </form>
        </div>

        {/* STICKY FOOTER БО ТУГМА */}
        <div className="px-6 py-5 bg-white dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800">
          <Button 
            type="submit" 
            form="mandatory-form"
            className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-sm bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-200 dark:shadow-none transition-all active:scale-95 disabled:opacity-50"
            disabled={loading || !acceptedTerms || !secondaryType}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t('savePhone')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
