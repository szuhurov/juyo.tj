/**
 * Саҳифаи ҷамъиятии профил (QR Scan View)
 * 
 * Ин файл барои намоиши маълумоти ҷамъиятии корбар ҳангоми сканер кардани QR-код хизмат мекунад.
 * Он имкон медиҳад, ки шахси ашёро ёфта бо соҳиби он тамос гирад ва дигар эълонҳои ӯро бубинад.
 */

"use client";

import { useEffect, useState, use } from "react";
import { Profile, ProfileService } from "@/lib/services/profile-service";
import { Item, ItemService } from "@/lib/services/item-service";
import { ItemCard } from "@/components/item-card";
import { createClient } from "@supabase/supabase-js";
import { useLanguage } from "@/lib/language-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, ShieldCheck, User, PackageSearch, QrCode, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const publicSupabase = createClient(supabaseUrl, supabaseAnonKey);

export default function PublicQRPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, locale } = useLanguage();
  
  const [profile, setProfile] = useState<any>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: profileData, error: profileError } = await publicSupabase
          .from('profiles')
          .select('first_name, last_name, avatar_url, phone, secondary_phone, is_qr_active')
          .eq('id', id)
          .single();

        if (profileError) throw profileError;
        setProfile(profileData);

        // Танҳо агар QR фаъол бошад, эълонҳоро бор мекунем
        if (profileData && profileData.is_qr_active) {
          const data = await ItemService.getItems({ user_id: id });
          setItems(data);
        }
      } catch (err) {
        console.error("Error loading public data:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-900" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-3xl flex items-center justify-center mb-6">
          <QrCode className="w-8 h-8 text-zinc-400" />
        </div>
        <h1 className="text-xl font-black uppercase tracking-tight mb-2">{t('noData')}</h1>
        <Button asChild className="mt-8 rounded-xl font-black uppercase tracking-widest text-[10px] h-12 px-8" variant="outline">
          <Link href="/">{t('home')}</Link>
        </Button>
      </div>
    );
  }

  // АГАР QR ҒАЙРИФАЪОЛ БОШАД - ТАНҲО МАТНИ ОГОҲИНОМА
  if (!profile.is_qr_active) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-zinc-50 dark:bg-zinc-950">
        <div className="max-w-md space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 bg-white dark:bg-zinc-900 rounded-[2rem] flex items-center justify-center mx-auto shadow-xl border border-zinc-100 dark:border-zinc-800">
            <ShieldCheck className="w-10 h-10 text-emerald-500" />
          </div>
          <div className="space-y-4">
            <h1 className="text-xl font-black uppercase tracking-[0.1em] text-zinc-900 dark:text-white leading-tight">
              {t('qrProfileInactive').replace('%{name}', `${profile.first_name} ${profile.last_name}`)}
            </h1>
            <div className="h-1 w-12 bg-emerald-500 mx-auto rounded-full" />
          </div>
          <p className="text-zinc-400 font-bold text-[10px] uppercase tracking-widest leading-relaxed">
            {locale === 'tg' ? 'Барои амнияти бештар маълумоти шахсӣ пинҳон аст.' : 
             locale === 'ru' ? 'Личные данные скрыты в целях безопасности.' : 
             'Personal data is hidden for security reasons.'}
          </p>
          <Button asChild className="mt-8 rounded-2xl font-black uppercase tracking-widest text-[10px] h-14 px-10 bg-zinc-900 text-white shadow-xl hover:bg-zinc-800 transition-all active:scale-95">
            <Link href="/">{t('home')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  // АГАР QR ФАЪОЛ БОШАД - САҲИФАИ ПУРРА
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-20">
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 pt-20 pb-12">
        <div className="container mx-auto px-4 text-center">
          <div className="relative inline-block mb-6">
            <Avatar className="w-32 h-32 border-4 border-white dark:border-zinc-800 shadow-2xl rounded-[2.5rem] overflow-hidden">
              <AvatarImage src={profile.avatar_url} />
              <AvatarFallback className="bg-zinc-900 text-white text-4xl font-black">
                {profile.first_name?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-2 rounded-2xl shadow-lg border-4 border-white dark:border-zinc-900">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>

          <h1 className="text-3xl font-black uppercase tracking-tighter mb-2">
            {profile.first_name} {profile.last_name}
          </h1>
          
          <div className="max-w-md mx-auto bg-zinc-50 dark:bg-zinc-800/50 p-8 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 mb-10 mt-6 relative">
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed font-bold text-lg italic">
              "{t('foundUserItem').replace('%{name}', profile.first_name)}"
            </p>
          </div>

          <div className="flex flex-col items-center justify-center gap-4">
            {profile.phone ? (
              <Button size="lg" className="w-full max-w-xs h-16 px-10 rounded-2xl bg-zinc-900 text-white hover:bg-zinc-800 font-black uppercase tracking-widest gap-3 shadow-xl transition-all active:scale-95" asChild>
                <a href={`tel:${profile.phone}`}>
                  <Phone className="w-5 h-5" />
                  {t('contactOwner')}
                </a>
              </Button>
            ) : (
              <div className="bg-amber-50 text-amber-600 px-6 py-4 rounded-2xl border border-amber-100 font-bold uppercase text-[10px] tracking-widest">
                {t('noPhoneWarning')}
              </div>
            )}

            {profile.secondary_phone && (
              <Button size="lg" variant="outline" className="w-full max-w-xs h-14 px-10 rounded-2xl border-2 border-zinc-200 dark:border-zinc-800 font-black uppercase tracking-widest gap-3 transition-all active:scale-95" asChild>
                <a href={`tel:${profile.secondary_phone}`}>
                  <Phone className="w-4 h-4" />
                  {t('contactSecondary')}
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pt-12">
        <div className="flex items-center gap-3 mb-8">
          <PackageSearch className="w-6 h-6 text-zinc-400" />
          <h3 className="text-xl font-black uppercase tracking-tight">{t('myPosts')}</h3>
          <div className="h-6 w-6 flex items-center justify-center rounded text-[12px] font-black bg-zinc-900 text-white">
            {items.length}
          </div>
        </div>

        {items.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white dark:bg-zinc-900/50 rounded-[3rem] border-2 border-dashed border-zinc-200 dark:border-zinc-800">
            <User className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
            <p className="text-zinc-400 font-black uppercase text-[10px] tracking-widest">
              {t('noPosts')}
            </p>
          </div>
        )}
      </div>

      <div className="mt-20 text-center opacity-30">
        <p className="text-2xl font-black tracking-tighter text-zinc-900 dark:text-white">JUYO.TJ</p>
        <p className="text-[10px] font-bold uppercase tracking-widest mt-1">{t('securityNote')}</p>
      </div>
    </div>
  );
}

function Badge({ children, className, variant = "default" }: any) {
  return (
    <span className={cn(
      "px-2 py-0.5 rounded text-[10px] font-bold inline-block",
      variant === "default" ? "bg-zinc-900 text-white" : "border border-zinc-200 text-zinc-500",
      className
    )}>
      {children}
    </span>
  );
}
