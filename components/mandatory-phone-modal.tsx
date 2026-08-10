"use client";

/**
 * Модали ҳатмии рақами телефон.
 * Ин компонент намегузорад, ки корбар бе рақами телефон ва қабули шартҳо барномаро истифода барад.
 */

import { useEffect, useState } from "react"; // Хукҳои React
import { useUser, useAuth, useClerk } from "@clerk/nextjs"; // Барои гирифтани маълумоти корбар ва хуруҷ
import { useLanguage, type Locale } from "@/lib/language-context"; // Барои тарҷумаи забон
import { ProfileService } from "@/lib/services/profile-service"; // Барои кор бо профили корбар
import { createClerkSupabaseClient } from "@/lib/supabase"; // Барои пайваст шудан ба база
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"; // Барои тирезаҳои огоҳӣ
import { Button } from "@/components/ui/button"; // Компоненти тугма
import { Input } from "@/components/ui/input"; // Компоненти воридкунии матн
import { Label } from "@/components/ui/label"; // Компоненти тамға
import { Phone, Loader2 } from "lucide-react"; // Иконкаҳо
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
  const [showTermsDetails, setShowTermsDetails] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      if (!userId || !userLoaded) return;
      
      try {
        const token = await getToken({ template: 'supabase' });
        if (!token) return;

        const supabase = createClerkSupabaseClient(token);
        
        // Маҷбур мекунем, ки маълумоти охиринро аз сервер гирад (бе кэш)
        const { data, error } = await supabase
          .from('profiles')
          .select('phone, accepted_terms, accepted_at, terms_version')
          .eq('id', userId)
          .maybeSingle();

        if (error) return;

        // Агар профил нест (data === null) ё маълумоти ҳатмӣ намерасад, модалро нишон медиҳем
        const isMissingData = 
          !data ||
          !data.phone || 
          data.phone.trim() === "" ||
          data.accepted_terms !== true;

        setShowModal(isMissingData);
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

    setLoading(true);
    try {
      const token = await getToken({ template: 'supabase' });
      const supabase = createClerkSupabaseClient(token!);
      
      await ProfileService.updateProfile(supabase, userId!, {
        phone,
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
    } catch {
      toast.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  if (!showModal) return null;

  return (
    <Dialog open={showModal} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md rounded-3xl p-0 gap-0 border-none shadow-2xl bg-white dark:bg-zinc-950 z-[6000] max-h-[98vh] overflow-hidden flex flex-col [&>button]:hidden" 
        onPointerDownOutside={(e) => e.preventDefault()} 
        onEscapeKeyDown={(e) => e.preventDefault()}
      >

        {/* Language Switcher at the top */}
        <div className="flex justify-center gap-2 pt-6 px-4">
          {[
            { code: 'tg', label: 'Тоҷикӣ' },
            { code: 'ru', label: 'Русский' },
            { code: 'en', label: 'English' }
          ].map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                setLocale(lang.code as Locale);
              }}
              className={cn(
                "px-3 py-2 rounded-xl text-[9px] font-bold transition-all duration-300 flex-1 max-w-[100px]",
                locale === lang.code 
                  ? "bg-emerald-500 text-white shadow-md scale-105" 
                  : "bg-zinc-100 dark:bg-zinc-900 text-zinc-400 hover:text-zinc-600"
              )}
            >
              {lang.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 px-8 pt-6 pb-4 space-y-4 text-center">
          <div className="w-14 h-14 bg-white dark:bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-1">
            <Phone className="w-7 h-7 text-emerald-500" />
          </div>
          
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {t('phoneRequiredTitle')}
            </DialogTitle>
            <p className="text-zinc-400 font-bold text-[10px] tracking-widest leading-none">
              {t('phoneRequiredDesc')}
            </p>
          </DialogHeader>

          <form onSubmit={handleSaveData} id="mandatory-form" className="space-y-4 text-left">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-[8px] font-bold text-zinc-400 tracking-widest ml-2">
                  {t('phoneLabel')}
                </Label>
                <Input 
                  name="phone" 
                  placeholder="XXXXXXXXX" 
                  className="h-12 px-5 rounded-xl bg-zinc-50 dark:bg-zinc-900 font-bold text-lg tracking-wider border-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-all outline-none" 
                  required 
                  inputMode="numeric"
                  onChange={(e) => e.target.value = e.target.value.replace(/[^0-9]/g, '')}
                />
              </div>

              <div className="flex items-start space-x-3 pt-2 px-1">
                <Checkbox 
                  id="terms" 
                  checked={acceptedTerms}
                  onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                  className="mt-1 border-2 border-zinc-200 dark:border-zinc-800 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 rounded-md transition-all duration-300"
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor="terms"
                    className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 leading-relaxed cursor-pointer select-none"
                  >
                    {t('terms.checkbox')}
                  </Label>
                  <button 
                    type="button"
                    className="text-[9px] font-bold tracking-widest text-emerald-500 hover:text-emerald-600 transition-colors text-left"
                    onClick={() => setShowTermsDetails(true)}
                  >
                    {t('terms.link')}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Terms Details Dialog */}
        <Dialog open={showTermsDetails} onOpenChange={setShowTermsDetails}>
          <DialogContent className="sm:max-w-[400px] rounded-[2rem] p-8 border-none shadow-2xl bg-white dark:bg-zinc-950 z-[110]">
            <DialogHeader className="space-y-3">
              <DialogTitle className="text-lg font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {t('terms.link')}
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-zinc-600 dark:text-zinc-400 font-bold text-sm leading-relaxed">
                {t('terms.content')}
              </p>
            </div>
            <Button 
              onClick={() => setShowTermsDetails(false)}
              className="w-full h-12 rounded-xl font-bold tracking-widest text-[10px] bg-emerald-500 text-white hover:bg-emerald-600 transition-all"
            >
              {t('ok')}
            </Button>
          </DialogContent>
        </Dialog>

        <div className="px-8 pb-8 pt-2 bg-white dark:bg-zinc-950">
          <Button 
            type="submit" 
            form="mandatory-form"
            className="w-full h-14 rounded-2xl font-bold tracking-[0.2em] text-[10px] bg-emerald-500 hover:bg-emerald-600 text-white shadow-xl shadow-emerald-500/10 transition-all disabled:opacity-50 border-none"
            disabled={loading || !acceptedTerms}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t('savePhone')}
          </Button>
          
          <button
            type="button"
            onClick={async () => {
              setShowModal(false);
              await signOut();
            }}
            className="w-full mt-4 text-[8px] font-bold tracking-[0.3em] text-red-500 hover:text-red-600 transition-colors"
          >
            {t('signOut')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
