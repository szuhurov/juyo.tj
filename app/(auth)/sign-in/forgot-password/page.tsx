"use client";

import { useSignIn } from "@clerk/nextjs";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import Link from "next/link";
import { Loader2, Mail, Lock, Key, ArrowRight, ArrowLeft, Eye, EyeOff } from "lucide-react";

export default function ForgotPasswordPage() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [successfulCreation, setSuccessfulCreation] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  if (!isLoaded) return null;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    await signIn
      ?.create({
        strategy: "reset_password_email_code",
        identifier: email,
      })
      .then((_) => {
        setSuccessfulCreation(true);
        toast.success("Коди тасдиқ ба почтаи шумо фиристода шуд");
      })
      .catch((err) => toast.error(err.errors[0].message))
      .finally(() => setPending(false));
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    await signIn
      ?.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code,
        password,
      })
      .then((result) => {
        if (result.status === "complete") {
          setActive({ session: result.createdSessionId });
          toast.success("Парол бомуваффақият иваз шуд!");
          router.push("/");
        } else {
          console.log(result);
        }
      })
      .catch((err) => toast.error(err.errors[0].message))
      .finally(() => setPending(false));
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl overflow-hidden bg-white dark:bg-zinc-950">
        <CardHeader className="space-y-1 bg-zinc-900 text-white p-8 text-center">
          <CardTitle className="text-2xl font-black uppercase tracking-tighter">Барқароркунӣ</CardTitle>
          <CardDescription className="text-zinc-400 font-medium">
            {successfulCreation ? "Пароли навро ворид кунед" : "E-mail-и худро ворид кунед"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          {!successfulCreation ? (
            <form onSubmit={create} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <Input
                    type="email"
                    placeholder="E-mail-и худро ворид кунед"
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
                    Фиристодани код
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={reset} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Коди тасдиқ</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <Input
                    type="text"
                    placeholder="Кодро ворид кунед"
                    className="pl-10 h-11 rounded-md bg-zinc-50 dark:bg-zinc-900/50"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Пароли нав</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Пароли навро ворид кунед"
                    className="pl-10 pr-10 h-11 rounded-md bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
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
                {pending ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "Иваз кардани парол"}
              </Button>
              <button
                type="button"
                onClick={() => setSuccessfulCreation(false)}
                className="w-full text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                E-mail-ро иваз кардан
              </button>
            </form>
          )}
        </CardContent>
        <CardFooter className="p-8 pt-0 flex flex-col items-center justify-center border-t border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/30">
          <Link href="/sign-in" className="text-xs font-bold text-zinc-500 uppercase tracking-tight flex items-center hover:text-zinc-900 dark:hover:text-white transition-colors">
            <ArrowLeft className="mr-1 h-3 w-3" />
            Бозгашт ба воридшавӣ
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
