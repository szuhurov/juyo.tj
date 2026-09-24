"use client";

/**
 * Mandatory phone number modal.
 * This component doesn't let the user use the app without a phone number and accepting the terms.
 */

import { useEffect, useState } from "react"; // React hooks
import { useUser, useAuth, useClerk } from "@clerk/nextjs"; // For getting user data and signing out
import { useLanguage, type Locale } from "@/lib/language-context"; // For language translation
import { ProfileService } from "@/lib/services/profile-service"; // For working with the user profile
import { createClerkSupabaseClient } from "@/lib/supabase"; // For connecting to the database
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"; // For dialog windows
import { Button } from "@/components/ui/button"; // Button component
import { PhoneInput } from "@/components/phone-input"; // Phone field with country code
import { Label } from "@/components/ui/label"; // Label component
import { Phone, Loader2 } from "lucide-react"; // Icons
import { toast } from "sonner"; // For short notifications
import { Checkbox } from "@/components/ui/checkbox"; // Checkbox component
import { cn } from "@/lib/utils"; // For combining styles

export function MandatoryPhoneModal() {
  const { user, isLoaded: userLoaded } = useUser();
  const { getToken, userId } = useAuth();
  const { signOut } = useClerk(); // Clerk sign-out function
  const { t, locale, setLocale } = useLanguage();
  
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsDetails, setShowTermsDetails] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      if (!userId || !userLoaded) return;
      
      try {
        const supabase = createClerkSupabaseClient(getToken);

        // Force it to fetch the latest data from the server (no cache)
        const { data, error } = await supabase
          .from('profiles')
          .select('phone, accepted_terms, accepted_at, terms_version')
          .eq('id', userId)
          .maybeSingle();

        if (error) return;

        // If the profile doesn't exist (data === null) or required data is missing, show the modal
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
      const supabase = createClerkSupabaseClient(getToken);

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
        className="sm:max-w-md rounded-md p-0 gap-0 border-none shadow-2xl bg-white dark:bg-zinc-950 z-[6000] max-h-[98vh] overflow-hidden flex flex-col [&>button]:hidden" 
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
                "px-3 py-2 rounded-md text-[9px] font-medium transition-all duration-300 flex-1 max-w-[100px]",
                locale === lang.code 
                  ? "bg-emerald-500 text-white shadow-md scale-105" 
                  : "bg-slate-100 dark:bg-zinc-800 text-slate-400 hover:text-zinc-600"
              )}
            >
              {lang.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 px-8 pt-6 pb-4 space-y-4 text-center">
          <div className="w-14 h-14 bg-white dark:bg-transparent rounded-md flex items-center justify-center mx-auto mb-1">
            <Phone className="w-7 h-7 text-emerald-500" />
          </div>
          
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-xl tracking-tight text-emerald-600 dark:text-emerald-400">
              {t('phoneRequiredTitle')}
            </DialogTitle>
            <p className="text-slate-400 font-medium text-[10px] tracking-widest leading-none">
              {t('phoneRequiredDesc')}
            </p>
          </DialogHeader>

          <form onSubmit={handleSaveData} id="mandatory-form" className="space-y-4 text-left">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-[8px] text-slate-400 tracking-widest ml-2">
                  {t('phoneLabel')}
                </Label>
                <PhoneInput
                  name="phone"
                  placeholder="XXXXXXXXX"
                  required
                />
              </div>

              <div className="flex items-start space-x-3 pt-2 px-1">
                <Checkbox 
                  id="terms" 
                  checked={acceptedTerms}
                  onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                  className="mt-1 border-2 border-slate-200 dark:border-zinc-800 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 rounded-md transition-all duration-300"
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor="terms"
                    className="text-[10px] text-slate-600 dark:text-zinc-400 leading-relaxed cursor-pointer select-none"
                  >
                    {t('terms.checkbox')}
                  </Label>
                  <button 
                    type="button"
                    className="text-[9px] font-medium tracking-widest text-emerald-500 hover:text-emerald-600 transition-colors text-left"
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
          <DialogContent className="sm:max-w-[400px] rounded-md p-8 border-none shadow-2xl bg-white dark:bg-zinc-950 z-[110]">
            <DialogHeader className="space-y-3">
              <DialogTitle className="text-lg tracking-tight text-emerald-600 dark:text-emerald-400">
                {t('terms.link')}
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-slate-600 dark:text-zinc-400 font-semibold text-sm leading-relaxed">
                {t('terms.content')}
              </p>
            </div>
            <Button 
              onClick={() => setShowTermsDetails(false)}
              className="w-full h-12 rounded-md font-medium tracking-widest text-[10px] bg-emerald-500 text-white hover:bg-emerald-600 transition-all"
            >
              {t('ok')}
            </Button>
          </DialogContent>
        </Dialog>

        <div className="px-8 pb-8 pt-2 bg-white dark:bg-zinc-950">
          <Button 
            type="submit" 
            form="mandatory-form"
            className="w-full h-14 rounded-md tracking-[0.2em] text-[10px] bg-emerald-500 hover:bg-emerald-600 text-white shadow-xl shadow-emerald-500/10 transition-all disabled:opacity-50 border-none"
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
            className="w-full mt-4 text-[8px] font-medium tracking-[0.3em] text-red-500 hover:text-red-600 transition-colors"
          >
            {t('signOut')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
