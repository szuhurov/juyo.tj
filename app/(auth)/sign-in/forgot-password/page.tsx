/**
 * Саҳифаи барқарорсозии парол (Forgot Password).
 * Ин файл барои иваз кардани пароли гумшуда бо ёрии Clerk хизмат мекунад.
 * Раванд: фиристодани код ба почта -> ворид кардани код ва пароли нав.
 */
"use client";

import { useSignIn, useClerk } from "@clerk/nextjs"; // Барои воридшавӣ ва идоракунии Clerk
import { useState } from "react"; // Барои нигоҳ доштани маълумот дар стейт
import { useRouter } from "next/navigation"; // Барои гузаштан ба саҳифаи дигар
import { Button } from "@/components/ui/button"; // Компоненти тугма
import { Input } from "@/components/ui/input"; // Компоненти воридкунии матн
import { Label } from "@/components/ui/label"; // Компоненти тамға
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"; // Компонентҳои корт
import { toast } from "sonner"; // Барои нишон додани хабарҳо
import Link from "next/link"; // Барои пайвандҳо
import { Loader2, Mail, Lock, Key, ArrowRight, ArrowLeft, Eye, EyeOff } from "lucide-react"; // Иконкаҳо
import { useLanguage } from "@/lib/language-context"; // Барои тарҷумаи забон

export default function ForgotPasswordPage() {
  // Хукҳои асосӣ
  const { t } = useLanguage();
  const { signIn } = useSignIn();
  const { setActive } = useClerk();

  // Состояниеҳо (States) барои идоракунии форма
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [successfulCreation, setSuccessfulCreation] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  if (!signIn) return null;

  /**
   * Функсия барои оғози раванди барқарорсозӣ (Шабакаи аввал).
   * Запрос барои фиристодани код ба почтаи электронӣ.
   */
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    await signIn
      ?.create({
        strategy: "reset_password_email_code" as any,
        identifier: email,
      })
      .then((_) => {
        setSuccessfulCreation(true);
        toast.success(t('auth.codeSent'));
      })
      .catch((err: any) => toast.error(err.errors[0].message))
      .finally(() => setPending(false));
  }

  /**
   * Функсия барои тасдиқи код ва пароли нав (Шабакаи дуюм).
   * Ин ҷо пароли нав дар система сабт мешавад.
   */
  async function reset(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    await (signIn as any)
      ?.attemptFirstFactor({
        strategy: "reset_password_email_code" as any,
        code,
        password,
      })
      .then((result: any) => {
        if (result.status === "complete") {
          setActive({ session: result.createdSessionId });
          toast.success(t('auth.passwordChangedSuccess'));
          router.push("/");
        } else {
          toast.error(t('error'));
        }
      })
      .catch((err: any) => toast.error(err.errors[0].message))
      .finally(() => setPending(false));
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      {/* Карточкаи асосии UI */}
      <Card className="w-full max-w-md border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl overflow-hidden bg-white dark:bg-zinc-950">
        <CardHeader className="space-y-1 bg-zinc-900 text-white p-8 text-center">
          <CardTitle className="text-2xl font-black uppercase tracking-tighter">{t('auth.resetPassword')}</CardTitle>
          <CardDescription className="text-zinc-400 font-medium">
            {successfulCreation ? t('auth.enterNewPassword') : t('auth.enterEmail')}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-8">
          {/* Логикаи иваз кардани форма: вобаста ба successfulCreation */}
          {!successfulCreation ? (
            // Формаи аввал: Ворид кардани почта
            <form onSubmit={create} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <Input
                    type="email"
                    placeholder={t('auth.emailPlaceholder')}
                    className="pl-10 h-11 rounded-md bg-zinc-50 dark:bg-zinc-900/50"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full h-11 rounded-md bg-zinc-900 text-white hover:bg-zinc-800 hover:text-white font-black uppercase tracking-widest text-xs group"
                disabled={pending}
              >
                {pending ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : (
                  <>
                    {t('forgotPass.btnNext')}
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </form>
          ) : (
            // Формаи дуюм: Ворид кардани код ва пароли нав
            <form onSubmit={reset} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">{t('verificationCode')}</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <Input
                    type="text"
                    placeholder={t('auth.codePlaceholder')}
                    className="pl-10 h-11 rounded-md bg-zinc-50 dark:bg-zinc-900/50"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">{t('newPassword')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder={t('auth.passwordPlaceholder')}
                    className="pl-10 pr-10 h-11 rounded-md bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  {/* Тугмаи нишон додани парол (Show/Hide) */}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full h-11 rounded-md bg-zinc-900 text-white hover:bg-zinc-800 hover:text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 font-black uppercase tracking-widest text-xs group"
                disabled={pending}
              >
                {pending ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : t('auth.changePassword')}
              </Button>
              <button
                type="button"
                onClick={() => setSuccessfulCreation(false)}
                className="w-full text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                {t('changeEmail')}
              </button>
            </form>
          )}
        </CardContent>
        
        <CardFooter className="p-8 pt-0 flex flex-col items-center justify-center border-t border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/30">
          <Link href="/sign-in" className="text-xs font-bold text-zinc-500 uppercase tracking-tight flex items-center hover:text-zinc-900 dark:hover:text-white transition-colors">
            <ArrowLeft className="mr-1 h-3 w-3" />
            {t('forgotPass.btnHome')}
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
