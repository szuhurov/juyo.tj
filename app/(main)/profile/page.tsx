/**
 * Ин саҳифаи Профили корбар ҳаст.
 * Дар ин ҷо корбар метавонад эълонҳои худро идора кунад, маълумоти шахсиашро иваз кунад,
 * QR-коди худро созад ва ашёҳояшро дар "Қуттии бехатарӣ" (Safety Box) нигоҳ дорад.
 */

"use client";

import { useEffect, useState, useRef, Suspense } from "react"; // Барои идоракунии вақт, ҳолат ва боргирии саҳифа
import { useUser, SignOutButton, useAuth } from "@clerk/nextjs"; // Барои кор бо маълумоти корбари воридшуда ва баромад аз сайт
import { useLanguage } from "@/lib/language-context"; // Барои идоракунии забони интерфейс
import { Item, ItemService, CATEGORIES } from "@/lib/services/item-service"; // Барои кор бо хизматрасониҳои эълонҳо ва категорияҳо
import { Profile, ProfileService } from "@/lib/services/profile-service"; // Барои идоракунии маълумоти шахсии корбар
import { ItemCard } from "@/components/item-card"; // Барои нишон додани карточкаҳои эълонҳо
import { Button } from "@/components/ui/button"; // Компоненти тугма
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Барои сохтани блокҳои иттилоотӣ
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // Барои нишон додани сурати корбар
import { Skeleton } from "@/components/ui/skeleton"; // Барои ҳолати боргирии муваққатӣ
import { Input } from "@/components/ui/input"; // Майдони воридкунии матн
import { Label } from "@/components/ui/label"; // Сарлавҳаҳо барои майдонҳои форма
import { Textarea } from "@/components/ui/textarea"; // Майдони воридкунии матни калон
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Рӯйхати интихобшаванда
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"; // Гурӯҳи интихобкунандаҳо
import { createClerkSupabaseClient } from "@/lib/supabase"; // Барои пайваст шудан ба базаи Supabase
import {
  User,
  Bookmark,
  LogOut,
  ChevronRight,
  Briefcase,
  PackageSearch,
  Mail,
  LayoutGrid,
  Trash2,
  Loader2,
  Clock,
  Upload,
  X,
  Send,
  ShieldCheck,
  ShieldAlert,
  PlusCircle,
  AlertTriangle,
  Phone,
  Pencil,
  QrCode,
  Menu as MenuIcon,
  Download,
  Share2,
  RefreshCw,
  Palette,
  Type,
  ChevronLeft,
  Search,
  HelpCircle,
  } from "lucide-react";
 // Иконкаҳои гуногун барои интерфейс
import Link from "next/link"; // Барои пайвандҳо ба саҳифаҳои дигар
import Image from "next/image"; // Барои нишон додани суратҳои оптимизатсияшуда
import { useRouter, useSearchParams } from "next/navigation"; // Барои идоракунии адрес ва параметрҳои URL
import { cn } from "@/lib/utils"; // Барои пайваст кардани классҳои CSS
import { toast } from "sonner"; // Барои нишон додани огоҳиномаҳо
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"; // Барои нишон додани маслиҳатҳои кӯтоҳ
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"; // Барои тирезаҳои тасдиқкунанда (модалкаҳо)
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// Интеграцияи QR
import { QRCard } from "@/components/qr-editor/qr-card"; // Компонент барои сохтани QR-код
import { toPng } from "html-to-image"; // Барои табдил додани HTML ба сурати PNG
import { HexColorPicker } from "react-colorful"; // Барои интихоби ранги QR-код
import { compressImage } from "@/lib/image-utils"; // Барои фишурдани суратҳо

import { Checkbox } from "@/components/ui/checkbox";
import {
  useUserItems,
  useSavedItems,
  useSafetyItems,
  ITEM_KEYS,
} from "@/lib/hooks/use-items"; // Хукҳои махсус барои гирифтани ашёҳо аз база
import { useQueryClient } from "@tanstack/react-query"; // Барои идоракунии кэши маълумотҳо

function ProfileContent() {
  // Хукҳо барои гирифтани маълумоти корбар ва забони сайт
  const { user, isLoaded: userLoaded } = useUser();
  const { getToken, userId } = useAuth();
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Стейтҳо барои идоракунии табҳо (вкладки) ва танзимоти QR
  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") || "posts",
  );
  const qrRef = useRef<HTMLDivElement | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [activePicker, setActivePicker] = useState<"qr" | "bg" | "all" | null>(
    null,
  );
  const [showWhyQRModal, setShowWhyQRModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);

  // Стейтҳо барои нигоҳ доштани маълумоти профил ва нишон додани модалҳо
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [showSecurityInfo, setShowSecurityInfo] = useState(false);
  const [showSecondaryPhoneModal, setShowSecondaryPhoneModal] = useState(false);
  const [secondaryLoading, setSecondaryLoading] = useState(false);
  const [secondaryType, setSecondaryType] = useState<string>("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsDetails, setShowTermsDetails] = useState(false);

  // Стейт барои танзимоти намуди зоҳирии QR-код (рангҳо ва текст)
  const [qrSettings, setQrSettings] = useState({
    qrColor: "#26ba90",
    bgColor: "#eefbf5",
    text: t("qrScanMe"),
    dotsType: "extra-rounded" as any,
    cornersSquareType: "dot" as any,
    cornersDotType: "dot" as any,
  });

  // Гирифтани токени базаи додаҳо ва маълумоти профил дар як вақт барои кам кардани ре-рендерҳо
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    const loadData = async () => {
      if (!userId) return;
      try {
        const supabaseToken = await getToken({ template: "supabase" });
        if (!supabaseToken) return;

        setToken(supabaseToken);

        const supabase = createClerkSupabaseClient(supabaseToken);
        const data = await ProfileService.getProfile(supabase, userId);
        setProfile(data);

        // Агар рақами телефон набошад, тирезаи махсусро нишон медиҳем (ТАНҲО рақами асосӣ)
        if (data && (!data.phone || data.phone.trim() === "")) {
          setShowPhoneModal(true);
        }
      } catch (err) {
        console.error("Error loading profile/token:", err);
      } finally {
        setProfileLoading(false);
      }
    };
    loadData();
  }, [userId]);

  // Гирифтани рӯйхати эълонҳо, ашёҳои захирашуда ва ашёҳои "Қуттии бехатарӣ"
  const { data: myItems = [], isLoading: postsLoading } = useUserItems(
    userId || undefined,
    token,
  );
  const { data: savedItems = [], isLoading: savedLoading } = useSavedItems(
    userId || undefined,
    token,
  );
  const { data: safetyItems = [], isLoading: safetyLoading } = useSafetyItems(
    userId || undefined,
    token,
  );

  // Стейтҳо барои идоракунии ашёҳо дар "Қуттии бехатарӣ" (Safety Box)
  const [safetySubmitting, setSafetySubmitting] = useState(false);
  const [safetyType, setSafetyType] = useState<"lost" | "found">("lost");
  const [safetyCategory, setSafetyCategory] = useState("");
  const [safetyImages, setSafetyImages] = useState<File[]>([]);
  const [safetyPreviews, setSafetyPreviews] = useState<string[]>([]);
  const [isAddingSafetyItem, setIsAddingSafetyItem] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [selectedSafetyItem, setSelectedSafetyItem] = useState<any>(null);
  const [editingSafetyItem, setEditingSafetyItem] = useState<any>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Синхронизатсия кардани таби фаъол бо URL
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (
      tab &&
      ["posts", "info", "saved", "safety", "qr", "guide"].includes(tab)
    ) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  /**
   * Функсия барои иваз кардани таб (вкладка) ва нав кардани URL
   */
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    const params = new URLSearchParams(searchParams);
    params.set("tab", tabId);
    router.push(`/profile?${params.toString()}`, { scroll: false });
  };

  // Стейт барои тирезаи тасдиқи амалҳо (Confirm Dialog)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    variant: "default" | "destructive" | "warning";
    isLoading?: boolean;
  }>({
    open: false,
    title: "",
    description: "",
    onConfirm: () => {},
    variant: "default",
  });

  // Элементҳои менюи паҳлӯӣ (Sidebar Menu)
  const menuItems = [
    {
      id: "posts",
      title: t("myPosts"),
      icon: LayoutGrid,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      id: "info",
      title: t("personalInfo"),
      icon: User,
      color: "text-indigo-600",
      bg: "bg-indigo-50 dark:bg-indigo-900/20",
    },
    {
      id: "qr",
      title: t("qrMyCode"),
      icon: QrCode,
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-900/20",
    },
    {
      id: "saved",
      title: t("savedItems"),
      icon: Bookmark,
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-950/20",
    },
    {
      id: "safety",
      title: t("mySafe"),
      icon: Briefcase,
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-900/20",
    },
    {
      id: "guide",
      title: t("aboutApp"),
      icon: MenuIcon,
      color: "text-zinc-600",
      bg: "bg-zinc-50 dark:bg-zinc-900/20",
    },
  ];

  // Вақте ки маълумот дар ягон ҷо нав мешавад, ин ҷо ҳам кэшро тоза мекунем
  useEffect(() => {
    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
    };
    window.addEventListener("saved-items-updated", handleUpdate);
    window.addEventListener("items-updated", handleUpdate);
    return () => {
      window.removeEventListener("saved-items-updated", handleUpdate);
      window.removeEventListener("items-updated", handleUpdate);
    };
  }, [queryClient]);

  // Click outside to close color picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (activePicker && !target.closest('.color-picker-container') && !target.closest('.color-trigger')) {
        setActivePicker(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activePicker]);

  /**
   * Функсия барои коркарди суратҳо дар Қуттии бехатарӣ
   */
  const handleSafetyImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (safetyImages.length + files.length > 5) {
      toast.error(t("maxImagesReached"));
      return;
    }
    setSafetyImages((prev) => [...prev, ...files]);
    const newPreviews = files.map((file) => URL.createObjectURL(file));
    setSafetyPreviews((prev) => [...prev, ...newPreviews]);
  };

  /**
   * Функсия барои нест кардани сурат аз пешнамоиши Қуттии бехатарӣ
   */
  const removeSafetyImage = (index: number) => {
    setSafetyImages((prev) => prev.filter((_, i) => i !== index));
    setSafetyPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  /**
   * Функсия барои бақайдгирии ашёи нав дар Қуттии бехатарӣ
   */
  const handleRegisterSafetyItem = async (
    e: React.FormEvent<HTMLFormElement>,
  ) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = ((formData.get("name") as string) || "").trim();
    const description = ((formData.get("description") as string) || "").trim();
    const phone = ((formData.get("phone") as string) || "").trim();
    const reward = ((formData.get("reward") as string) || "").trim();

    if (!name || !description || !safetyCategory || !phone) {
      toast.error(t("fillAllFields"));
      return;
    }

    setSafetySubmitting(true);
    try {
      const imageUrls = [];
      for (const file of safetyImages) {
        const uploadToken = await getToken({ template: "supabase" });
        const uploadSupabase = createClerkSupabaseClient(uploadToken!);

        const compressedFile = await compressImage(file);

        const ext = compressedFile.name.split(".").pop();
        const fileName = `safety-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        const { error: uploadError } = await uploadSupabase.storage
          .from("items")
          .upload(fileName, compressedFile);
        if (uploadError) throw uploadError;
        const {
          data: { publicUrl },
        } = uploadSupabase.storage.from("items").getPublicUrl(fileName);
        imageUrls.push(publicUrl);
      }

      const dbToken = await getToken({ template: "supabase" });
      const supabase = createClerkSupabaseClient(dbToken!);

      const { data, error } = await supabase
        .from("safety_box")
        .insert([
          {
            user_id: userId,
            item_name: name,
            category: safetyCategory,
            type: safetyType,
            description,
            phone_number: phone,
            reward: reward ? `${reward}` : null,
            images: imageUrls,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      queryClient.invalidateQueries({
        queryKey: ITEM_KEYS.safetyItems(userId || ""),
      });

      toast.success(t("success"));
      setSafetyImages([]);
      setSafetyPreviews([]);
      setSafetyCategory("");
      setSafetyType("lost");
      setIsAddingSafetyItem(false);
    } catch (error: any) {
      console.error("Detailed Safety Box Error:", error);
      const errorMsg = error.message || "Unknown error";
      toast.error(`Хатогӣ: ${errorMsg}`);
    } finally {
      setSafetySubmitting(false);
    }
  };

  /**
   * Функсия барои нав кардани маълумоти ашё дар Қуттии бехатарӣ
   */
  const handleUpdateSafetyItem = async (
    e: React.FormEvent<HTMLFormElement>,
  ) => {
    e.preventDefault();
    if (!editingSafetyItem) return;

    const formData = new FormData(e.currentTarget);
    const name = (formData.get("name") as string).trim();
    const description = (formData.get("description") as string).trim();
    const phone = (formData.get("phone") as string).trim();
    const reward = (formData.get("reward") as string).trim();

    setSafetySubmitting(true);
    try {
      const supabaseToken = await getToken({ template: "supabase" });
      if (!supabaseToken) throw new Error("No authentication token");

      const supabase = createClerkSupabaseClient(supabaseToken);

      const originalImages =
        safetyItems.find((it: any) => it.id === editingSafetyItem.id)?.images ||
        [];
      const currentImagesInState = editingSafetyItem.images || [];
      const removedUrls = originalImages.filter(
        (url: string) => !currentImagesInState.includes(url),
      );

      if (removedUrls.length > 0) {
        const filePaths = removedUrls
          .map((urlStr: string) => {
            try {
              const url = new URL(urlStr);
              const pathParts = url.pathname.split("/public/items/");
              return pathParts.length > 1 ? pathParts[1] : null;
            } catch (e) {
              const parts = urlStr.split("/public/items/");
              return parts.length > 1 ? parts[1].split("?")[0] : null;
            }
          })
          .filter(Boolean) as string[];

        if (filePaths.length > 0) {
          await supabase.storage.from("items").remove(filePaths);
        }
      }

      let imageUrls = [...currentImagesInState];

      if (safetyImages.length > 0) {
        for (const file of safetyImages) {
          const compressedFile = await compressImage(file);
          const ext = compressedFile.name.split(".").pop();
          const fileName = `safety-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("items")
            .upload(fileName, compressedFile);
          if (uploadError) throw uploadError;
          const {
            data: { publicUrl },
          } = supabase.storage.from("items").getPublicUrl(fileName);
          imageUrls.push(publicUrl);
        }
      }

      const { data, error } = await supabase
        .from("safety_box")
        .update({
          item_name: name,
          category: safetyCategory,
          type: safetyType,
          description,
          phone_number: phone,
          reward: reward ? `${reward}` : null,
          images: imageUrls,
        })
        .eq("id", editingSafetyItem.id)
        .select()
        .single();

      if (error) throw error;

      queryClient.invalidateQueries({
        queryKey: ITEM_KEYS.safetyItems(userId || ""),
      });

      toast.success(t("success"));
      setEditingSafetyItem(null);
      setSafetyImages([]);
      setSafetyPreviews([]);
    } catch (error: any) {
      console.error("Detailed Safety Box Error:", error);
      toast.error(`Хатогӣ: ${error.message}`);
    } finally {
      setSafetySubmitting(false);
    }
  };

  /**
   * Функсия барои нашри эълон аз Қуттии бехатарӣ ба рӯйхати умумӣ (Publish)
   */
  const handlePublishSafetyItem = async (safetyItem: any) => {
    setConfirmDialog({
      open: true,
      title: t("publishItem"),
      description: t("publishFromSafeConfirm"),
      variant: "default",
      isLoading: false,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          const token = await getToken({ template: "supabase" });
          const supabase = createClerkSupabaseClient(token!);

          const item = await ItemService.publishFromSafetyBox(
            supabase,
            safetyItem,
            userId!,
          );

          if (safetyItem.images && safetyItem.images.length > 0) {
            const moderationImages = Array.isArray(safetyItem.images)
              ? safetyItem.images
              : [safetyItem.images];

            fetch("/api/moderate", {
              method: "POST",
              body: JSON.stringify({
                imageUrls: moderationImages,
                itemId: item.id,
              }),
              headers: { "Content-Type": "application/json" },
            }).catch((err) => console.error("Moderation trigger error:", err));
          }

          queryClient.invalidateQueries({
            queryKey: ITEM_KEYS.safetyItems(userId || ""),
          });
          queryClient.invalidateQueries({
            queryKey: ITEM_KEYS.userItems(userId || ""),
          });

          toast.success(t("imageModeration.submitted"));
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        } catch (error: any) {
          toast.error(error.message || t("error"));
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isLoading: false }));
        }
      },
    });
  };

  /**
   * Функсия барои нест кардани ашё аз Қуттии бехатарӣ
   */
  const deleteSafetyItem = async (id: string) => {
    setConfirmDialog({
      open: true,
      title: t("deleteConfirmTitle"),
      description: t("removeFromSafeConfirm"),
      variant: "destructive",
      isLoading: false,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          const token = await getToken({ template: "supabase" });
          const supabase = createClerkSupabaseClient(token!);

          const { data: item } = await supabase
            .from("safety_box")
            .select("images")
            .eq("id", id)
            .single();

          if (item?.images && item.images.length > 0) {
            const filePaths = item.images
              .map((urlStr: string) => {
                try {
                  const url = new URL(urlStr);
                  const pathParts = url.pathname.split("/public/items/");
                  return pathParts.length > 1 ? pathParts[1] : null;
                } catch (e) {
                  const parts = urlStr.split("/public/items/");
                  return parts.length > 1 ? parts[1].split("?")[0] : null;
                }
              })
              .filter(Boolean) as string[];

            if (filePaths.length > 0) {
              await supabase.storage.from("items").remove(filePaths);
            }
          }

          const { error } = await supabase
            .from("safety_box")
            .delete()
            .eq("id", id);
          if (error) throw error;

          queryClient.invalidateQueries({
            queryKey: ITEM_KEYS.safetyItems(userId || ""),
          });

          toast.success(t("success"));
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        } catch (error) {
          toast.error(t("error"));
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isLoading: false }));
        }
      },
    });
  };

  /**
   * Омода кардани ашё барои таҳрир кардан
   */
  const startEditing = (item: any) => {
    setEditingSafetyItem(item);
    setSafetyType(item.type || "lost");
    setSafetyCategory(item.category);
    setSafetyPreviews(item.images || []);
    setSafetyImages([]);
  };

  /**
   * Логикаи асосии боргирии QR-код (барои он ки аз ду ҷой истифода барем)
   */
  const executeQRDownload = async () => {
    if (!qrRef.current) return;

    setIsDownloading(true);
    try {
      // Интизори хурд барои боварӣ аз он ки ҳама элементҳо дуруст рендер шудаанд
      await new Promise((resolve) => setTimeout(resolve, 300));

      const dataUrl = await toPng(qrRef.current, {
        cacheBust: true,
        pixelRatio: 4, // Баланд бардоштани сифат барои чоп
        skipFonts: false,
        backgroundColor: undefined, // Ин имкон медиҳад, ки кунҷҳои rounded шаффоф монанд
        style: {
          transform: "scale(1)",
          transformOrigin: "top left",
          borderRadius: "0.8rem", // Боварӣ ҳосил мекунем, ки кунҷҳо мудаввар мемонанд (medium)
        },
      });

      // Агар дар дохили React Native WebView бошад
      if (typeof window !== "undefined" && (window as any).ReactNativeWebView) {
        (window as any).ReactNativeWebView.postMessage(
          JSON.stringify({ type: "DOWNLOAD_QR", payload: dataUrl })
        );
        toast.success(t("qrSavedSuccess"));
        return;
      }

      // Стандарт боргирӣ (Desktop ва Mobile Web Browser)
      const link = document.createElement("a");
      link.download = `juyo-qr-sticker.png`;
      link.href = dataUrl;
      link.click();
      toast.success(t("qrSavedSuccess"));
    } catch (err) {
      console.error("Download error:", err);
      toast.error(t("error"));
    } finally {
      setIsDownloading(false);
    }
  };

  /**
   * Функсия барои боргирии QR-код ҳамчун сурат (Download)
   */
  const handleDownloadQR = async () => {
    const isMissingData = 
      !profile?.phone || 
      !profile?.secondary_phone || 
      !profile?.secondary_phone_type || 
      profile?.accepted_terms !== true;

    if (isMissingData) {
      setShowSecondaryPhoneModal(true);
      return;
    }

    await executeQRDownload();
  };

  /**
   * Функсия барои захира кардани маълумоти амниятӣ ва давом додани боргирӣ
   */
  const handleSaveSecondaryPhone = async (
    e: React.FormEvent<HTMLFormElement>,
  ) => {
    e.preventDefault();
    
    const needsPhone = !profile?.phone;
    const needsSecondary = !profile?.secondary_phone || !profile?.secondary_phone_type;
    const needsTerms = profile?.accepted_terms !== true;

    if (needsTerms && !acceptedTerms) {
      toast.error(t('terms.error') || "Лутфан шартҳоро қабул кунед");
      return;
    }

    if (needsSecondary && !secondaryType) {
      toast.error(t("fillAllFields"));
      return;
    }

    const formData = new FormData(e.currentTarget);
    const phone = ((formData.get("phone") as string) || "").trim();
    const secondary_phone = ((formData.get("secondary_phone") as string) || "").trim();

    if (needsPhone && phone.length < 9) {
      toast.error(t("phoneMinLength"));
      return;
    }

    if (needsSecondary && secondary_phone.length < 9) {
      toast.error(t("phoneMinLength"));
      return;
    }

    if (needsPhone && needsSecondary && phone === secondary_phone) {
      toast.error(t("phonesMustBeDifferent"));
      return;
    }

    setSecondaryLoading(true);
    try {
      const supabaseToken = await getToken({ template: "supabase" });
      const supabase = createClerkSupabaseClient(supabaseToken!);

      const updates: any = {};
      if (needsPhone) updates.phone = phone;
      if (needsSecondary) {
        updates.secondary_phone = secondary_phone;
        updates.secondary_phone_type = secondaryType;
      }
      if (needsTerms) {
        updates.accepted_terms = true;
        updates.accepted_at = new Date().toISOString();
        updates.terms_version = "v1.0";
      }

      const updated = await ProfileService.updateProfile(supabase, userId!, updates);

      setProfile(updated);
      setShowSecondaryPhoneModal(false);
      toast.success(t("success"));

      // Пас аз захира, мустақиман боргириро иҷро мекунем бе тафтиши иловагӣ
      await executeQRDownload();
    } catch (err) {
      console.error("Error saving profile setup:", err);
      toast.error(t("error"));
    } finally {
      setSecondaryLoading(false);
    }
  };

  /**
   * Функсияи паҳн кардани QR-код (Share)
   */
  const handleShareQR = () => {
    const url = `${window.location.origin}/qr/${userId}`;
    const shareData = {
      title: "JUYO QR",
      text: t("foundUserItem").replace("%{name}", user?.firstName || ""),
      url: url,
    };

    if (navigator.share) {
      navigator.share(shareData).catch((error) => {
        if (error.name !== 'AbortError') {
          navigator.clipboard.writeText(url);
          toast.success(t("success"));
        }
      });
    } else {
      navigator.clipboard.writeText(url);
      toast.success(t("success"));
    }
  };

  if (!userLoaded) return null;

  // Нишон додани мӯҳтаво вобаста ба таби интихобшуда
  const renderContent = () => {
    switch (activeTab) {
      case "posts":
        return (
          <div className="space-y-6">
            {/* Рӯйхати эълонҳои шахсӣ */}
            <div className="animate-in fade-in duration-500">
              {postsLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4 lg:gap-6 -mx-2 sm:mx-0">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="aspect-square rounded-2xl" />
                  ))}
                </div>
              ) : myItems.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4 lg:gap-6 -mx-2 sm:mx-0">
                  {myItems.map((item) => (
                    <ItemCard key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 mx-1">
                  <PackageSearch className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                  <h4 className="font-bold text-zinc-400 uppercase text-xs tracking-widest">
                    {t("noItemsFound")}
                  </h4>
                </div>
              )}
            </div>
          </div>
        );

      case "posts2":
        return (
          <div className="space-y-6">
            {/* Рӯйхати эълонҳои шахсӣ */}
            <div className="animate-in fade-in duration-500">
              {postsLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4 lg:gap-6 -mx-2 sm:mx-0">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="aspect-square rounded-2xl" />
                  ))}
                </div>
              ) : myItems.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4 lg:gap-6 -mx-2 sm:mx-0">
                  {myItems.map((item) => (
                    <ItemCard key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 mx-1">
                  <PackageSearch className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                  <h4 className="font-bold text-zinc-400 uppercase text-xs tracking-widest">
                    {t("noItemsFound")}
                  </h4>
                </div>
              )}
            </div>
          </div>
        );

      case "qr":
        return (
          <div className="space-y-8 pb-32">
            {/* Сарлавҳаи таби QR-код */}
            <div className="hidden sm:block sticky top-0 sm:top-[64px] z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md pt-4 pb-4 px-4 mb-6 -mx-4 border-b border-zinc-100 dark:border-zinc-900">
              <div className="flex items-start gap-4">
                <h3 className="text-lg font-black uppercase tracking-tight">
                  {t("qrMyCode")}
                </h3>
                
                <div className="flex flex-col items-end gap-1 mt-1">
                  <button
                    onClick={async () => {
                      if (!profile) return;
                      const previousState = profile.is_qr_active;
                      const newState = !previousState;
                      
                      // Optimistic update
                      setProfile({ ...profile, is_qr_active: newState });
                      
                      try {
                        const token = await getToken({
                          template: "supabase",
                        });
                        const supabase = createClerkSupabaseClient(token!);
                        
                        // Background update
                        ProfileService.updateProfile(
                          supabase,
                          userId!,
                          { is_qr_active: newState }
                        ).then(updated => {
                          setProfile(updated);
                          toast.success(
                            newState
                              ? t("qrActivatedSuccess")
                              : t("qrDeactivatedSuccess"),
                          );
                        }).catch(err => {
                          console.error(err);
                          setProfile({ ...profile, is_qr_active: previousState });
                          toast.error(t("error"));
                        });
                      } catch (err) {
                        console.error(err);
                        setProfile({ ...profile, is_qr_active: previousState });
                        toast.error(t("error"));
                      }
                    }}
                    className={cn(
                      "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                      profile?.is_qr_active
                        ? "bg-emerald-500"
                        : "bg-zinc-300 dark:bg-zinc-700",
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        profile?.is_qr_active
                          ? "translate-x-4"
                          : "translate-x-0",
                      )}
                    />
                  </button>
                  
                  <button
                    onClick={() => setShowSecurityModal(true)}
                    className="text-[9px] font-bold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors underline decoration-dotted underline-offset-2 text-left"
                  >
                    {t("qrSecurityStatusWhy") || "Барои чӣ QR-код статус лозим?"}
                  </button>
                </div>
              </div>
            </div>

            {/* Танзимоти намуди зоҳирии QR */}
            <div className="animate-in fade-in duration-500 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-start px-2">
                {/* Пешнамоиши QR (Preview) */}
                <div className="flex flex-col sticky top-[60px] sm:top-[130px] z-30 md:relative md:top-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md -mx-4 px-1.5 py-1 md:p-0 md:bg-transparent md:backdrop-blur-none transition-all duration-300">
                  
                  {/* Тугмаҳои амалиёт - дар болои QR */}
                  <div className="flex justify-between gap-1.5 mb-2 sm:mb-6 w-full">
                    <Button
                      onClick={() => setShowWhyQRModal(true)}
                      className="flex-1 h-9 sm:h-10 rounded-lg bg-emerald-500 text-white border-none font-black uppercase text-[8px] sm:text-[9px] tracking-widest hover:bg-emerald-600 transition-all active:scale-95 gap-1.5 px-2 shadow-sm"
                    >
                      <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                      {t("qrSecurityQuestion") || "Барои чӣ лозим?"}
                    </Button>
                    <Button
                      onClick={handleDownloadQR}
                      disabled={isDownloading}
                      className="flex-1 h-9 sm:h-10 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-none font-black uppercase text-[8px] sm:text-[9px] tracking-widest hover:opacity-90 transition-all active:scale-95 gap-1.5 px-2 shadow-sm"
                    >
                      {isDownloading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      )}
                      {t("download")}
                    </Button>
                  </div>

                  <div className="relative group bg-transparent sm:bg-zinc-100 sm:dark:bg-zinc-900 rounded-xl md:rounded-[3rem] p-0 sm:p-8 md:p-12 flex items-center justify-center border-0 sm:border-2 sm:border-dashed border-zinc-200 dark:border-zinc-800 w-full sm:max-w-sm mx-auto overflow-hidden shadow-none sm:shadow-sm md:shadow-none transition-all duration-300">
                    <div className="scale-[0.9] sm:scale-100 origin-center transition-transform duration-300 shrink-0">
                      <QRCard
                        id={user?.id || ""}
                        settings={{
                          qrColor: qrSettings.qrColor,
                          bgColor: qrSettings.bgColor,
                          borderRadius: "medium",
                          shadow: "soft",
                          hasBorder: false,
                          pattern: "none",
                          text: qrSettings.text,
                          dotsType: qrSettings.dotsType,
                          cornersSquareType: qrSettings.cornersSquareType,
                          cornersDotType: qrSettings.cornersDotType,
                        }}
                        className="qr-card-mobile-hide-text"
                        innerRef={qrRef}
                      />
                    </div>
                  </div>
                </div>

                {/* Панели танзимоти QR - Full Width ва Compact */}
                <div className="space-y-5 px-1 pb-10">
                  {/* Стил ва Шаклҳо */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 ml-1">
                        <LayoutGrid className="w-3 h-3 text-zinc-400" />
                        <Label className="text-[10px] font-bold text-zinc-500">
                          {t("qrDotsStyle") || "Нуқтаҳо"}
                        </Label>
                      </div>
                      <Select
                        value={qrSettings.dotsType}
                        onValueChange={(val) => setQrSettings({ ...qrSettings, dotsType: val as any })}
                      >
                        <SelectTrigger className="h-11 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-[11px] font-bold px-4 shadow-sm hover:bg-zinc-50 transition-all">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-zinc-100 dark:border-zinc-800">
                          <SelectItem value="square">{t("qrDotSquare")}</SelectItem>
                          <SelectItem value="dots">{t("qrDotDots")}</SelectItem>
                          <SelectItem value="rounded">{t("qrDotRounded")}</SelectItem>
                          <SelectItem value="extra-rounded">{t("qrDotExtraRounded")}</SelectItem>
                          <SelectItem value="classy">{t("qrDotClassy")}</SelectItem>
                          <SelectItem value="classy-rounded">{t("qrDotClassyRounded")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 ml-1">
                        <RefreshCw className="w-3 h-3 text-zinc-400" />
                        <Label className="text-[10px] font-bold text-zinc-500">
                          {t("qrCornersStyle") || "Кунҷҳо"}
                        </Label>
                      </div>
                      <Select
                        value={qrSettings.cornersSquareType}
                        onValueChange={(val) => {
                          const cornerStyle = val as any;
                          const dotStyle = cornerStyle === "square" ? "square" : "dot";
                          setQrSettings({ 
                            ...qrSettings, 
                            cornersSquareType: cornerStyle,
                            cornersDotType: dotStyle as any
                          });
                        }}
                      >
                        <SelectTrigger className="h-11 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-[11px] font-bold px-4 shadow-sm hover:bg-zinc-50 transition-all">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-zinc-100 dark:border-zinc-800">
                          <SelectItem value="square">{t("qrCornerSquare")}</SelectItem>
                          <SelectItem value="dot">{t("qrCornerDot")}</SelectItem>
                          <SelectItem value="extra-rounded">{t("qrCornerRounded")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Рангҳо */}
                  <div className="grid grid-cols-2 gap-3 relative">
                    <div className="space-y-2 relative">
                      <div className="flex items-center gap-1.5 ml-1">
                        <Palette className="w-3 h-3 text-zinc-400" />
                        <Label className="text-[10px] font-bold text-zinc-500">
                          {t("qrColorLabel")}
                        </Label>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActivePicker(activePicker === "qr" ? null : "qr");
                        }}
                        className="w-full h-11 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-1 flex items-center gap-3 transition-all active:scale-95 color-trigger px-2 shadow-sm hover:bg-zinc-50"
                      >
                        <div 
                          className="w-7 h-7 rounded-xl shadow-sm border border-black/5" 
                          style={{ backgroundColor: qrSettings.qrColor }}
                        />
                        <span className="font-mono text-[11px] font-bold text-zinc-500 uppercase">
                          {qrSettings.qrColor}
                        </span>
                      </button>
                    </div>

                    <div className="space-y-2 relative">
                      <Label className="text-[10px] font-bold text-zinc-500 ml-1">
                        {t("qrBgLabel")}
                      </Label>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActivePicker(activePicker === "bg" ? null : "bg");
                        }}
                        className="w-full h-11 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-1 flex items-center gap-3 transition-all active:scale-95 color-trigger px-2 shadow-sm hover:bg-zinc-50"
                      >
                        <div 
                          className="w-7 h-7 rounded-xl shadow-sm border border-black/5" 
                          style={{ backgroundColor: qrSettings.bgColor }}
                        />
                        <span className="font-mono text-[11px] font-bold text-zinc-500 uppercase">
                          {qrSettings.bgColor}
                        </span>
                      </button>
                    </div>

                    {(activePicker === "qr" || activePicker === "bg") && (
                      <div className="fixed inset-x-0 bottom-[56px] sm:bottom-auto sm:absolute sm:inset-0 z-40 sm:z-[60] p-0 bg-white dark:bg-zinc-950 sm:rounded-[2rem] shadow-2xl border-t sm:border border-zinc-100 dark:border-zinc-800 animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 color-picker-container overflow-hidden">
                        <div className="flex flex-row p-0 gap-0 justify-center items-stretch h-full">
                          <div className="flex-1 flex flex-col bg-white dark:bg-zinc-950">
                            <div className="p-0 flex justify-center flex-1 items-center">
                              <HexColorPicker
                                color={qrSettings.qrColor}
                                onChange={(color) =>
                                  setQrSettings({
                                    ...qrSettings,
                                    qrColor: color,
                                  })
                                }
                                className="!w-full !h-48 sm:!w-[180px] sm:!h-[180px]"
                              />
                            </div>
                          </div>
                          <div className="flex-1 flex flex-col bg-white dark:bg-zinc-950 border-l border-zinc-100 dark:border-zinc-800">
                            <div className="p-0 flex justify-center flex-1 items-center">
                              <HexColorPicker
                                color={qrSettings.bgColor}
                                onChange={(color) =>
                                  setQrSettings({
                                    ...qrSettings,
                                    bgColor: color,
                                  })
                                }
                                className="!w-full !h-48 sm:!w-[180px] sm:!h-[180px]"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 pb-8 sm:pb-4 border-t border-zinc-100 dark:border-zinc-800">
                          <Button
                            className="w-full h-12 sm:h-12 rounded-xl font-black uppercase tracking-widest text-[11px] bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90 shadow-lg transition-all active:scale-[0.98]"
                            onClick={() => {
                              setActivePicker(null);
                              handleDownloadQR();
                            }}
                          >
                            {t("download")}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Текст */}
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest ml-1">
                      {t("qrFooterText")}
                    </Label>
                    <Input
                      value={qrSettings.text}
                      onChange={(e) =>
                        setQrSettings({
                          ...qrSettings,
                          text: e.target.value,
                        })
                      }
                      className="h-12 rounded-xl bg-zinc-50 dark:bg-zinc-900 border-none font-bold text-sm focus-visible:ring-2 focus-visible:ring-zinc-200"
                      placeholder={t("qrInputPlaceholder")}
                    />
                  </div>

                  {/* Статус - Танҳо дар мобил */}
                  <div className="pt-2 sm:hidden">
                    <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-4 rounded-2xl border border-emerald-100/50 dark:border-emerald-900/20 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-900 dark:text-white">
                            {t("qrStatus")}
                          </span>
                          <button
                            onClick={() => setShowSecurityModal(true)}
                            className="text-[9px] font-bold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors underline decoration-dotted underline-offset-2 text-left"
                          >
                            {t("qrSecurityStatusWhy") || "Барои чӣ QR-код статус лозим?"}
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          if (!profile) return;
                          const previousState = profile.is_qr_active;
                          const newState = !previousState;
                          
                          // Optimistic update
                          setProfile({ ...profile, is_qr_active: newState });
                          
                          try {
                            const token = await getToken({ template: "supabase" });
                            const supabase = createClerkSupabaseClient(token!);
                            
                            // Background update
                            ProfileService.updateProfile(supabase, userId!, { is_qr_active: newState }).then(updated => {
                              setProfile(updated);
                              toast.success(newState ? t("qrActivatedSuccess") : t("qrDeactivatedSuccess"));
                            }).catch(err => {
                              console.error(err);
                              setProfile({ ...profile, is_qr_active: previousState });
                              toast.error(t("error"));
                            });
                          } catch (err) {
                            console.error(err);
                            setProfile({ ...profile, is_qr_active: previousState });
                            toast.error(t("error"));
                          }
                        }}
                        className={cn(
                          "relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                          profile?.is_qr_active ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700",
                        )}
                      >
                        <span className={cn("pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out", profile?.is_qr_active ? "translate-x-5" : "translate-x-0")} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "guide":
        return (
          <div className="space-y-8 pb-20">
            <div className="sticky top-0 sm:top-[64px] z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md pt-4 pb-4 px-4 mb-6 -mx-4 border-b border-zinc-100 dark:border-zinc-900">
              <h3 className="text-lg font-black uppercase tracking-tight">
                {t("aboutApp") || "Оид ба JUYU"}
              </h3>
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-10 px-2">
              {/* Mission */}
              <section className="space-y-6">
                <div className="bg-zinc-900 text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 blur-3xl rounded-full -mr-16 -mt-16" />
                  <h4 className="text-2xl font-black uppercase tracking-tight mb-4 relative z-10">
                    {t("guide.problemTitle")}
                  </h4>
                  <div className="text-zinc-400 font-bold leading-relaxed relative z-10 space-y-4">
                    <p>{t("guide.problemDesc")}</p>
                  </div>
                </div>
              </section>

              {/* Solution */}
              <section className="space-y-6">
                <h4 className="text-2xl font-black uppercase tracking-tight px-4">
                  {t("guide.solutionTitle")}
                </h4>
                <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 p-8 rounded-[2.5rem] space-y-4">
                  <p className="text-zinc-600 dark:text-zinc-400 font-bold">
                    {t("guide.solutionDesc1")}
                    <span className="text-emerald-600">
                      {t("guide.solutionDesc2")}
                    </span>
                    {t("guide.solutionDesc3")}
                    <span className="text-red-600">
                      {t("guide.solutionDesc4")}
                    </span>
                    {t("guide.solutionDesc5")}
                  </p>
                </div>
              </section>

              {/* How it works */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-8 rounded-[2.5rem] bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 space-y-4">
                  <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center">
                    <PackageSearch className="w-6 h-6 text-emerald-600" />
                  </div>
                  <h5 className="font-black uppercase text-sm tracking-wider">
                    {t("guide.foundTitle")}
                  </h5>
                  <ol className="text-[12px] text-zinc-500 font-medium leading-relaxed space-y-2 list-decimal list-inside">
                    <li>{t("guide.foundStep1")}</li>
                    <li>{t("guide.foundStep2")}</li>
                    <li>{t("guide.foundStep3")}</li>
                  </ol>
                </div>

                <div className="p-8 rounded-[2.5rem] bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 space-y-4">
                  <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center">
                    <Search className="w-6 h-6 text-red-600" />
                  </div>
                  <h5 className="font-black uppercase text-sm tracking-wider">
                    {t("guide.lostTitle")}
                  </h5>
                  <ol className="text-[12px] text-zinc-500 font-medium leading-relaxed space-y-2 list-decimal list-inside">
                    <li>{t("guide.lostStep1")}</li>
                    <li>{t("guide.lostStep2")}</li>
                    <li>{t("guide.lostStep3")}</li>
                  </ol>
                </div>
              </div>

              {/* QR System */}
              <section className="space-y-6">
                <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-3xl rounded-full -mr-32 -mt-32" />
                  <h4 className="text-2xl font-black uppercase tracking-tight mb-4 relative z-10">
                    {t("guide.qrSystemTitle")}
                  </h4>
                  <p className="text-zinc-400 font-bold mb-8 relative z-10">
                    {t("guide.qrSystemDesc")}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 relative z-10">
                    {(t("guide.qrItems") as string[]).map((item, i) => (
                      <div
                        key={i}
                        className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl text-center border border-white/10"
                      >
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-300">
                          {item}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-12 p-6 bg-white/5 rounded-3xl border border-white/5 space-y-4 relative z-10">
                    <h5 className="font-black uppercase text-xs tracking-[0.2em] text-emerald-400">
                      {t("guide.qrHowTitle")}
                    </h5>
                    <ul className="space-y-3">
                      <li className="flex gap-3 text-sm text-zinc-300 font-medium">
                        <span className="text-emerald-500 font-black">1.</span>
                        {t("guide.qrHowStep1")}
                      </li>
                      <li className="flex gap-3 text-sm text-zinc-300 font-medium">
                        <span className="text-emerald-500 font-black">2.</span>
                        {t("guide.qrHowStep2")}
                      </li>
                      <li className="flex gap-3 text-sm text-zinc-300 font-medium">
                        <span className="text-emerald-500 font-black">3.</span>
                        {t("guide.qrHowStep3")}
                      </li>
                    </ul>
                  </div>

                  <div className="mt-6 flex justify-center relative z-10">
                    <div className="bg-emerald-500/20 text-emerald-400 px-6 py-3 rounded-2xl border border-emerald-500/20 font-black uppercase text-[10px] tracking-widest">
                      {t("guide.qrAdvantage")}
                    </div>
                  </div>
                </div>
              </section>

              {/* Goal */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
                <div className="p-8 rounded-[2.5rem] bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 space-y-4">
                  <h5 className="font-black uppercase text-sm tracking-wider text-amber-600">
                    {t("guide.safetyBoxGoalTitle")}
                  </h5>
                  <p className="text-sm text-amber-700/70 dark:text-amber-500/70 font-bold leading-relaxed">
                    {t("guide.safetyBoxGoalDesc")}
                  </p>
                </div>
                <div className="p-8 rounded-[2.5rem] bg-zinc-900 text-white space-y-4 shadow-xl">
                  <h5 className="font-black uppercase text-sm tracking-wider text-emerald-400">
                    {t("guide.mainGoalTitle")}
                  </h5>
                  <p className="text-sm text-zinc-400 font-bold leading-relaxed">
                    {t("guide.mainGoalDesc")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case "info":
        return (
          <div className="space-y-12 pb-20">
            {/* Сарлавҳаи таби Маълумоти шахсӣ */}
            <div className="sticky top-0 sm:top-[64px] z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md pt-4 pb-4 px-4 mb-6 -mx-4 border-b border-zinc-100 dark:border-zinc-900">
              <h3 className="text-lg font-black uppercase tracking-tight">
                {t("personalInfo")}
              </h3>
            </div>

            <div className="animate-in slide-in-from-right-4 duration-500 max-w-2xl px-2 space-y-12">
              {/* Бахши Аватар ва Ному насаб */}
              <section className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-4 h-4 text-zinc-400" />
                  <h4 className="font-black uppercase text-[10px] tracking-[0.2em] text-zinc-400">
                    {t("avatarAndName")}
                  </h4>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-8 bg-zinc-50 dark:bg-zinc-900/30 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-900">
                  <div className="relative group shrink-0">
                    <Avatar className="w-24 h-24 border-4 border-white dark:border-zinc-800 shadow-xl rounded-2xl overflow-hidden">
                      <AvatarImage src={user?.imageUrl} />
                      <AvatarFallback className="bg-zinc-900 text-white text-3xl font-black">
                        {user?.firstName?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 cursor-pointer rounded-2xl transition-all">
                      <Upload className="w-6 h-6 text-white" />
                      <span className="text-[8px] font-black text-white uppercase mt-1 opacity-80">
                        {t("changePhoto")}
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              toast.loading(t("uploading"));
                              await user?.setProfileImage({ file });
                              toast.dismiss();
                              toast.success(t("photoUpdated"));
                            } catch (err) {
                              toast.dismiss();
                              toast.error(t("error"));
                            }
                          }
                        }}
                      />
                    </label>
                  </div>
                  {/* Формаи таҳрири маълумоти профил */}
                  <form
                    key={profile?.id || "new"}
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const firstName = formData.get("firstName") as string;
                      const lastName = formData.get("lastName") as string;
                      const phone = (
                        (formData.get("phone") as string) || ""
                      ).trim();
                      const secondaryPhone = (
                        (formData.get("secondaryPhone") as string) || ""
                      ).trim();

                      if (phone.length < 9 || secondaryPhone.length < 9) {
                        toast.error(t("phoneMinLength"));
                        return;
                      }

                      if (phone === secondaryPhone) {
                        toast.error(t("phonesMustBeDifferent"));
                        return;
                      }

                      setSafetySubmitting(true);
                      try {
                        try {
                          await user?.update({ firstName, lastName });
                        } catch (clerkErr) {
                          console.error("Clerk Update Error:", clerkErr);
                        }

                        const token = await getToken({ template: "supabase" });
                        if (!token)
                          throw new Error("Authentication token not found");

                        const supabase = createClerkSupabaseClient(token);
                        const updated = await ProfileService.updateProfile(
                          supabase,
                          userId!,
                          {
                            first_name: firstName,
                            last_name: lastName,
                            phone,
                            secondary_phone: secondaryPhone,
                            avatar_url: user?.imageUrl || "",
                          },
                        );
                        setProfile(updated);

                        toast.success(t("profileUpdated"));
                      } catch (err: any) {
                        console.error("Profile Update Error:", err);
                        toast.error(err.message || t("error"));
                      } finally {
                        setSafetySubmitting(false);
                      }
                    }}
                    className="flex-1 space-y-4 w-full"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest ml-1">
                          {t("firstName")}
                        </Label>
                        <Input
                          name="firstName"
                          defaultValue={user?.firstName || ""}
                          className="h-10 rounded-xl bg-white dark:bg-zinc-950 font-bold"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest ml-1">
                          {t("lastName")}
                        </Label>
                        <Input
                          name="lastName"
                          defaultValue={user?.lastName || ""}
                          className="h-10 rounded-xl bg-white dark:bg-zinc-950 font-bold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest ml-1">
                          {t("phoneLabel")}
                        </Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                          <Input
                            name="phone"
                            placeholder={t("phonePlaceholder")}
                            defaultValue={profile?.phone || ""}
                            className="h-10 pl-9 rounded-xl bg-white dark:bg-zinc-950 font-bold text-xs"
                            inputMode="numeric"
                            required
                            onChange={(e) =>
                              (e.target.value = e.target.value.replace(
                                /[^0-9]/g,
                                "",
                              ))
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest ml-1">
                          {t("phoneSecondaryLabel")}
                        </Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                          <Input
                            name="secondaryPhone"
                            placeholder={t("phoneSecondaryPlaceholder")}
                            defaultValue={profile?.secondary_phone || ""}
                            className="h-10 pl-9 rounded-xl bg-white dark:bg-zinc-950 font-bold text-xs"
                            inputMode="numeric"
                            required
                            onChange={(e) =>
                              (e.target.value = e.target.value.replace(
                                /[^0-9]/g,
                                "",
                              ))
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      size="sm"
                      disabled={safetySubmitting}
                      className="rounded-lg bg-zinc-900 text-white font-black uppercase text-[9px] tracking-widest px-6 w-full sm:w-auto"
                    >
                      {safetySubmitting ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        t("save")
                      )}
                    </Button>
                  </form>
                </div>
              </section>

              {/* Бахши Почтаи электронӣ (Email) */}
              <section className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <Mail className="w-4 h-4 text-zinc-400" />
                  <h4 className="font-black uppercase text-[10px] tracking-[0.2em] text-zinc-400">
                    {t("email")}
                  </h4>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-900/30 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-900 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest ml-1">
                      {t("currentEmail")}
                    </Label>
                    <div className="h-10 flex items-center px-4 rounded-xl bg-zinc-100/50 dark:bg-zinc-900/50 text-zinc-500 font-bold text-sm">
                      {user?.primaryEmailAddress?.emailAddress}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        );

      case "saved":
        return (
          <div className="space-y-6">
            {/* Сарлавҳаи таби Захирашудаҳо */}
            <div className="sticky top-0 sm:top-[64px] z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md pt-4 pb-4 px-4 mb-6 -mx-4 border-b border-zinc-100 dark:border-zinc-900">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black uppercase tracking-tight">
                  {t("savedItems")}
                </h3>
                <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-900 text-white">
                  {savedItems.length}
                </div>
              </div>
            </div>

            {/* Рӯйхати ашёҳои захирашуда */}
            <div className="">
              {savedLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6 px-1">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="aspect-square rounded-2xl" />
                  ))}
                </div>
              ) : savedItems.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6 px-1">
                  {savedItems.map((item) => (
                    <ItemCard key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 mx-1">
                  <Bookmark className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                  <h4 className="font-bold text-zinc-400 uppercase text-xs tracking-widest">
                    {t("savedItemsEmpty")}
                  </h4>
                  <Button
                    asChild
                    size="sm"
                    className="mt-6 rounded-md font-black uppercase text-[10px] tracking-wider"
                  >
                    <Link href="/">{t("home")}</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        );

      case "safety":
        return (
          <div className="space-y-8">
            {/* Сарлавҳаи таби Қуттии бехатарӣ */}
            <div className="sticky top-[64px] z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md pt-4 pb-4 px-4 mb-6 -mx-4 border-b border-zinc-100 dark:border-zinc-900">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black uppercase tracking-tight">
                  {t("mySafe")}
                </h3>
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 flex items-center justify-center rounded text-[12px] font-black bg-zinc-900 text-white">
                    {safetyItems.length}
                  </div>
                  <Button
                    onClick={() => setIsAddingSafetyItem(!isAddingSafetyItem)}
                    size="icon"
                    className={cn(
                      "h-6 w-6 rounded transition-all shadow-sm",
                      isAddingSafetyItem
                        ? "bg-red-500 text-white hover:bg-red-600"
                        : "bg-zinc-900 text-white hover:bg-zinc-100 hover:text-zinc-900 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white",
                    )}
                  >
                    {isAddingSafetyItem ? (
                      <X className="h-3.5 w-3.5" />
                    ) : (
                      <PlusCircle className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Идоракунии Қуттии бехатарӣ (Safety Box) */}
            <div className="animate-in fade-in duration-500 max-w-4xl mx-auto px-2">
              {isAddingSafetyItem || editingSafetyItem ? (
                /* Формаи илова кардан ё таҳрир кардани ашё */
                <Card className="rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-xl overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                  <CardHeader className="bg-zinc-50 dark:bg-zinc-900/50 p-6 border-b border-zinc-100 dark:border-zinc-800">
                    <CardTitle className="text-lg font-black uppercase tracking-wider flex items-center gap-3">
                      <Briefcase className="w-5 h-5 text-amber-500" />
                      {editingSafetyItem ? t("edit") : t("registerNewItem")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8">
                    <form
                      onSubmit={
                        editingSafetyItem
                          ? handleUpdateSafetyItem
                          : handleRegisterSafetyItem
                      }
                      className="space-y-6"
                    >
                      <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">
                          {t("what_happened")}
                        </Label>
                        <RadioGroup
                          value={safetyType}
                          onValueChange={(val) =>
                            setSafetyType(val as "lost" | "found")
                          }
                          className="grid grid-cols-2 gap-4"
                        >
                          <div>
                            <RadioGroupItem
                              value="lost"
                              id="safety-lost"
                              className="peer sr-only"
                            />
                            <Label
                              htmlFor="safety-lost"
                              className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-zinc-50 peer-data-[state=checked]:border-red-600 peer-data-[state=checked]:bg-red-50 cursor-pointer transition-all"
                            >
                              <span className="text-2xl mb-1">🔍</span>
                              <span className="font-bold text-xs uppercase">
                                {t("lost")}
                              </span>
                            </Label>
                          </div>
                          <div>
                            <RadioGroupItem
                              value="found"
                              id="safety-found"
                              className="peer sr-only"
                            />
                            <Label
                              htmlFor="safety-found"
                              className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-zinc-50 peer-data-[state=checked]:border-emerald-600 peer-data-[state=checked]:bg-emerald-50 cursor-pointer transition-all"
                            >
                              <span className="text-2xl mb-1">🎁</span>
                              <span className="font-bold text-xs uppercase">
                                {t("found")}
                              </span>
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label
                            htmlFor="name"
                            className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1"
                          >
                            {t("titleLabel")}
                          </Label>
                          <Input
                            id="name"
                            name="name"
                            defaultValue={editingSafetyItem?.item_name || ""}
                            placeholder={t("safetyItemNamePlaceholder")}
                            className="rounded-xl h-12 text-sm bg-zinc-50/50 dark:bg-zinc-900/50"
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">
                            {t("categoryLabel")}
                          </Label>
                          <Select
                            onValueChange={setSafetyCategory}
                            required
                            value={safetyCategory}
                          >
                            <SelectTrigger className="h-12 rounded-xl text-sm bg-zinc-50/50 dark:bg-zinc-900/50">
                              <SelectValue placeholder={t("categoryLabel")} />
                            </SelectTrigger>
                            <SelectContent>
                              {CATEGORIES.map((cat) => (
                                <SelectItem key={cat.id} value={cat.name}>
                                  {cat.icon} {t(`categories.${cat.id}`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="description"
                          className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1"
                        >
                          {t("description")}
                        </Label>
                        <Textarea
                          id="description"
                          name="description"
                          defaultValue={editingSafetyItem?.description || ""}
                          placeholder={t("safetyItemDescPlaceholder")}
                          className="rounded-xl min-h-[100px] text-sm bg-zinc-50/50 dark:bg-zinc-900/50"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label
                            htmlFor="phone"
                            className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1"
                          >
                            {t("phoneLabel")}
                          </Label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                            <Input
                              id="phone"
                              name="phone"
                              placeholder={t("phonePlaceholder")}
                              defaultValue={
                                editingSafetyItem?.phone_number ||
                                profile?.phone ||
                                ""
                              }
                              className="rounded-xl h-12 pl-10 text-sm bg-zinc-50/50 dark:bg-zinc-900/50"
                              required
                            />
                          </div>
                        </div>

                        {safetyType === "lost" && (
                          <div className="space-y-2 animate-in fade-in slide-in-from-left-2 duration-300">
                            <Label
                              htmlFor="reward"
                              className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1"
                            >
                              {t("rewardLabel")}
                            </Label>
                            <Input
                              id="reward"
                              name="reward"
                              defaultValue={editingSafetyItem?.reward || ""}
                              placeholder={t("rewardPlaceholder")}
                              className="rounded-xl h-12 text-sm bg-zinc-50/50 dark:bg-zinc-900/50"
                            />
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">
                          {t("addImages")} ({safetyPreviews.length}/5)
                        </Label>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
                          {safetyPreviews.map((preview, index) => (
                            <div
                              key={index}
                              className="relative aspect-square rounded-2xl overflow-hidden border-2 border-zinc-100 dark:border-zinc-800 shadow-sm group"
                            >
                              <Image
                                src={preview}
                                alt="preview"
                                fill
                                className="object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (editingSafetyItem) {
                                    // Агар таҳрир бошад, аз стейти editingSafetyItem.images нест мекунем
                                    const newImages =
                                      editingSafetyItem.images.filter(
                                        (_: any, i: number) => i !== index,
                                      );
                                    setEditingSafetyItem({
                                      ...editingSafetyItem,
                                      images: newImages,
                                    });
                                    setSafetyPreviews(newImages);
                                  } else {
                                    removeSafetyImage(index);
                                  }
                                }}
                                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                          {safetyPreviews.length < 5 && (
                            <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-900/50 cursor-pointer transition-all group">
                              <PlusCircle className="w-6 h-6 text-zinc-300 group-hover:text-zinc-400 transition-colors" />
                              <span className="text-[8px] font-black uppercase text-zinc-400 mt-2">
                                {t("add")}
                              </span>
                              <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                multiple
                                onChange={handleSafetyImageChange}
                              />
                            </label>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-4 pt-4">
                        <Button
                          type="submit"
                          className="flex-1 rounded-xl h-14 font-black uppercase tracking-wider text-xs bg-zinc-900 text-white hover:bg-zinc-800 shadow-lg shadow-zinc-100 dark:shadow-none"
                          disabled={safetySubmitting}
                        >
                          {safetySubmitting ? (
                            <Loader2 className="animate-spin w-5 h-5" />
                          ) : editingSafetyItem ? (
                            t("updateBtn")
                          ) : (
                            t("saveItem")
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsAddingSafetyItem(false);
                            setEditingSafetyItem(null);
                            setSafetyPreviews([]);
                            setSafetyImages([]);
                          }}
                          className="rounded-xl h-14 px-8 font-black uppercase tracking-wider text-xs"
                        >
                          {t("cancel")}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              ) : (
                /* Намоиши ашёҳои бойгонӣ (Safety Box Items) */
                <div className="space-y-6">
                  {safetyLoading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton
                          key={i}
                          className="aspect-square rounded-2xl"
                        />
                      ))}
                    </div>
                  ) : safetyItems.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                      {safetyItems.map((item: any) => (
                        <Card
                          key={item.id}
                          className="overflow-hidden hover:shadow-md transition-shadow duration-300 group flex flex-col h-full rounded-xl border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 cursor-pointer"
                          onClick={() => {
                            setSelectedSafetyItem(item);
                            setCurrentImageIndex(0);
                          }}
                        >
                          {/* Сурати ашё дар бойгонӣ */}
                          <div className="relative aspect-square overflow-hidden rounded-t-xl bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center">
                            {item.images?.[0] ? (
                              <Image
                                src={item.images[0]}
                                alt={item.item_name}
                                fill
                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                              />
                            ) : (
                              <PackageSearch className="w-12 h-12 text-zinc-200" />
                            )}

                            <div className="absolute top-2 left-2 right-2 flex justify-between items-center">
                              <Badge
                                className={cn(
                                  "backdrop-blur text-white text-[9px] font-black rounded px-2 py-0.5 border-none shadow-sm uppercase tracking-tighter",
                                  item.type === "lost"
                                    ? "bg-red-500/80"
                                    : "bg-emerald-500/80",
                                )}
                              >
                                {t(
                                  `categories.${CATEGORIES.find((c) => c.name === item.category)?.id || "6"}`,
                                )}
                              </Badge>

                              <div className="flex gap-1">
                                <Button
                                  variant="secondary"
                                  size="icon"
                                  className="h-7 w-7 rounded-lg bg-white/90 backdrop-blur text-blue-600 hover:bg-blue-600 hover:text-white shadow-sm border-none transition-all"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePublishSafetyItem(item);
                                  }}
                                  disabled={isActionLoading}
                                >
                                  <Send className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="icon"
                                  className="h-7 w-7 rounded-lg bg-white/90 backdrop-blur text-amber-600 hover:bg-amber-600 hover:text-white shadow-sm border-none transition-all"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEditing(item);
                                  }}
                                  disabled={isActionLoading}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="icon"
                                  className="h-7 w-7 rounded-lg bg-white/90 backdrop-blur text-red-600 hover:bg-red-600 hover:text-white shadow-sm border-none transition-all"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteSafetyItem(item.id);
                                  }}
                                  disabled={isActionLoading}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                          <CardContent className="p-3 flex-1 flex flex-col">
                            <h4 className="font-black text-[11px] line-clamp-1 leading-tight uppercase tracking-tight mb-1 group-hover:text-emerald-500 transition-colors">
                              {item.item_name}
                            </h4>
                            <div className="mt-auto pt-2 border-t border-zinc-50 dark:border-zinc-900 flex justify-between items-center">
                              <div className="flex items-center gap-1.5 text-[8px] font-bold text-zinc-400 uppercase tracking-wider">
                                <Clock className="w-2 h-2" />{" "}
                                {new Date(item.created_at).toLocaleDateString()}
                              </div>
                              {item.reward && (
                                <div className="text-[10px] font-black text-emerald-600">
                                  {item.reward}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-24 border-2 border-dashed rounded-[40px] border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/10">
                      <p className="text-zinc-400 text-[11px] font-black uppercase tracking-[0.2em]">
                        {t("safetyBoxEmpty")}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Модалкаи тафсилоти ашёи Сандуқча (Detailed View) */}
            <Dialog
              open={!!selectedSafetyItem}
              onOpenChange={(open) => !open && setSelectedSafetyItem(null)}
            >
              <DialogContent className="max-w-2xl p-0 overflow-hidden border-none rounded-[2rem] bg-white dark:bg-zinc-950 shadow-2xl max-h-[90vh] flex flex-col">
                {selectedSafetyItem && (
                  <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
                    {/* Карусели суратҳо */}
                    <div className="relative aspect-[4/3] bg-zinc-100 dark:bg-zinc-900 shrink-0">
                      {selectedSafetyItem.images &&
                      selectedSafetyItem.images.length > 0 ? (
                        <>
                          <Image
                            src={selectedSafetyItem.images[currentImageIndex]}
                            alt={selectedSafetyItem.item_name}
                            fill
                            className="object-cover"
                          />
                          {selectedSafetyItem.images.length > 1 && (
                            <div className="absolute inset-x-4 bottom-4 flex justify-center gap-1.5">
                              {selectedSafetyItem.images.map(
                                (_: any, i: number) => (
                                  <button
                                    key={i}
                                    onClick={() => setCurrentImageIndex(i)}
                                    className={cn(
                                      "h-1.5 rounded-full transition-all",
                                      currentImageIndex === i
                                        ? "w-6 bg-white"
                                        : "w-1.5 bg-white/50",
                                    )}
                                  />
                                ),
                              )}
                            </div>
                          )}
                          <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-4 opacity-0 hover:opacity-100 transition-opacity">
                            <Button
                              size="icon"
                              variant="secondary"
                              className="h-8 w-8 rounded-full bg-white/80 backdrop-blur"
                              onClick={() =>
                                setCurrentImageIndex((prev) =>
                                  prev === 0
                                    ? selectedSafetyItem.images.length - 1
                                    : prev - 1,
                                )
                              }
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="secondary"
                              className="h-8 w-8 rounded-full bg-white/80 backdrop-blur"
                              onClick={() =>
                                setCurrentImageIndex((prev) =>
                                  prev === selectedSafetyItem.images.length - 1
                                    ? 0
                                    : prev + 1,
                                )
                              }
                            >
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-zinc-300 gap-4">
                          <PackageSearch className="w-20 h-20 opacity-20" />
                          <span className="text-[10px] font-black uppercase tracking-widest">
                            {t("noData")}
                          </span>
                        </div>
                      )}

                      <button
                        onClick={() => setSelectedSafetyItem(null)}
                        className="absolute top-4 right-4 h-8 w-8 rounded-full bg-black/20 hover:bg-black/40 backdrop-blur flex items-center justify-center text-white transition-all z-10"
                      >
                        <X className="w-4 h-4" />
                      </button>

                      <div className="absolute top-4 left-4">
                        <Badge
                          className={cn(
                            "px-3 py-1 text-[10px] font-black uppercase tracking-tight border-none shadow-lg",
                            selectedSafetyItem.type === "lost"
                              ? "bg-red-600"
                              : "bg-emerald-600",
                          )}
                        >
                          {t(selectedSafetyItem.type || "lost")}
                        </Badge>
                      </div>
                    </div>

                    {/* Маълумот ва Тугмаҳо */}
                    <div className="p-6 sm:p-8 space-y-6">
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 rounded text-[8px] font-black bg-zinc-100 dark:bg-zinc-800 text-zinc-500 uppercase tracking-wider">
                              {t(
                                `categories.${CATEGORIES.find((c) => c.name === selectedSafetyItem.category)?.id || "6"}`,
                              )}
                            </span>
                            <span className="text-[10px] font-bold text-zinc-400">
                              {new Date(
                                selectedSafetyItem.created_at,
                              ).toLocaleDateString()}
                            </span>
                          </div>
                          <DialogTitle className="text-xl sm:text-2xl font-black uppercase tracking-tight leading-none text-zinc-900 dark:text-white">
                            {selectedSafetyItem.item_name}
                          </DialogTitle>
                        </div>
                        {selectedSafetyItem.reward && (
                          <div className="text-right shrink-0">
                            <div className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">
                              {t("reward")}
                            </div>
                            <div className="text-lg sm:text-xl font-black text-emerald-600">
                              {selectedSafetyItem.reward}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800">
                          <div className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-2">
                            {t("description")}
                          </div>
                          <DialogDescription className="text-sm font-medium text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap">
                            {selectedSafetyItem.description || t("noData")}
                          </DialogDescription>
                        </div>

                        <div className="flex items-center gap-3 p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-900/20">
                          <div className="h-10 w-10 rounded-xl bg-blue-500 text-white flex items-center justify-center shadow-sm">
                            <Phone className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-[8px] font-black text-blue-400 uppercase tracking-widest">
                              {t("phoneLabel")}
                            </div>
                            <div className="text-sm font-black text-blue-700 dark:text-blue-400">
                              +{selectedSafetyItem.phone_number}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-2">
                        <Button
                          onClick={() => {
                            const item = selectedSafetyItem;
                            setSelectedSafetyItem(null);
                            handlePublishSafetyItem(item);
                          }}
                          className="flex-1 h-12 sm:h-14 rounded-2xl bg-zinc-900 text-white font-black uppercase tracking-widest text-[9px] sm:text-[10px] gap-2 shadow-xl hover:bg-zinc-800"
                        >
                          <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />{" "}
                          {t("publish")}
                        </Button>
                        <Button
                          onClick={() => {
                            const item = selectedSafetyItem;
                            setSelectedSafetyItem(null);
                            startEditing(item);
                          }}
                          variant="outline"
                          className="h-12 sm:h-14 rounded-2xl border-zinc-200 text-zinc-700 font-black uppercase tracking-widest text-[9px] sm:text-[10px] gap-2"
                        >
                          <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" />{" "}
                          {t("edit")}
                        </Button>
                        <Button
                          onClick={() => {
                            const id = selectedSafetyItem.id;
                            setSelectedSafetyItem(null);
                            deleteSafetyItem(id);
                          }}
                          variant="ghost"
                          className="h-12 sm:h-14 rounded-2xl text-red-500 hover:bg-red-50 font-black uppercase tracking-widest text-[9px] sm:text-[10px] gap-2"
                        >
                          <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />{" "}
                          {t("delete")}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <TooltipProvider>
      <div className="container mx-auto px-0 sm:px-4 py-0 sm:py-8 min-h-[90vh]">
        {/* Mobile Profile Header (Instagram Style) */}
        {activeTab === "posts" && (
          <div className="block lg:hidden border-b border-zinc-100 dark:border-zinc-900 bg-white dark:bg-zinc-950 px-4 pt-6 pb-8">
            <div className="flex items-center gap-6 mb-6">
              <Avatar className="w-20 h-20 border-2 border-zinc-100 dark:border-zinc-800 p-0.5">
                <AvatarImage
                  src={user?.imageUrl}
                  className="rounded-full object-cover"
                />
                <AvatarFallback className="bg-zinc-100 dark:bg-zinc-800 text-xl font-black">
                  {user?.firstName?.charAt(0)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 flex flex-col gap-1">
                <h2 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white uppercase leading-none">
                  {user?.firstName} {user?.lastName}
                </h2>
                <p className="text-xs font-bold text-zinc-500 truncate max-w-[200px]">
                  {user?.primaryEmailAddress?.emailAddress}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => handleTabChange("info")}
                className="flex-1 h-9 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white font-black uppercase text-[10px] tracking-wider border-none shadow-none"
              >
                <Pencil className="w-3.5 h-3.5 mr-2" />
                {t("edit") || "Edit"}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="flex-1 h-9 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white font-black uppercase text-[10px] tracking-wider border-none shadow-none gap-2">
                    <MenuIcon className="w-4 h-4" />
                    {t("settings") || "Settings"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 rounded-xl shadow-xl p-2 border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950"
                >
                  {menuItems.map((item) => (
                    <DropdownMenuItem
                      key={item.id}
                      onClick={() => handleTabChange(item.id)}
                      className={cn(
                        "flex items-center gap-3 py-2.5 px-3 rounded-lg cursor-pointer font-bold text-[11px] uppercase tracking-wider",
                        activeTab === item.id
                          ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                          : "text-zinc-500",
                      )}
                    >
                      <div className={cn("p-1.5 rounded-md", item.bg, item.color)}>
                        <item.icon className="w-3.5 h-3.5" />
                      </div>
                      {item.title}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800 mx-1 my-1" />
                  <DropdownMenuItem className="p-0">
                    <SignOutButton>
                      <button className="w-full flex items-center gap-3 py-2.5 px-3 rounded-lg text-red-500 font-bold text-[11px] uppercase tracking-wider">
                        <div className="p-1.5 rounded-md bg-red-50 dark:bg-red-900/20">
                          <LogOut className="w-3.5 h-3.5" />
                        </div>
                        {t("signOut")}
                      </button>
                    </SignOutButton>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 lg:gap-12 px-4 sm:px-0">
          {/* Менюи Sidebar (Менюи паҳлӯӣ) */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-[100px] h-fit z-20 space-y-6">
              <div className="flex flex-col gap-3">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id)}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-xl transition-all group shadow-sm border",
                      activeTab === item.id
                        ? "bg-zinc-900 border-zinc-900 text-white dark:bg-zinc-100 dark:border-zinc-100 dark:text-zinc-900 scale-[1.02] shadow-md"
                        : "bg-white border-zinc-100 text-zinc-700 hover:border-zinc-300 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          activeTab === item.id
                            ? "bg-white/20 text-white dark:bg-zinc-900/10 dark:text-zinc-900"
                            : cn(item.bg, item.color),
                        )}
                      >
                        <item.icon className="w-4 h-4" />
                      </div>
                      <span className="font-black text-[10px] uppercase tracking-wider">
                        {item.title}
                      </span>
                    </div>
                    <ChevronRight
                      className={cn(
                        "w-4 h-4 transition-transform",
                        activeTab === item.id
                          ? "translate-x-1"
                          : "text-zinc-300 group-hover:translate-x-0.5",
                      )}
                    />
                  </button>
                ))}
              </div>

              {/* Тугмаи баромад (Log out) */}
              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-900">
                <SignOutButton>
                  <Button
                    variant="ghost"
                    className="w-full h-11 rounded-xl font-black text-[10px] uppercase tracking-widest text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20 transition-all gap-2 justify-start px-4"
                  >
                    <LogOut className="w-4 h-4" />
                    {t("signOut")}
                  </Button>
                </SignOutButton>
              </div>
            </div>
          </div>

          {/* Мӯҳтавои асосии табҳо */}
          <div className="lg:col-span-3">
            <div className="min-h-[60vh]">{renderContent()}</div>
          </div>
        </div>
      </div>

      {/* Тирезаҳои тасдиқ (Dialogs/Modals) */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          !open && setConfirmDialog((prev) => ({ ...prev, open: false }))
        }
      >
        <DialogContent className="sm:max-w-md rounded-3xl p-8 gap-6 border-none shadow-2xl">
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">
              {confirmDialog.title}
            </DialogTitle>
            <DialogDescription className="text-zinc-500 font-medium text-sm leading-relaxed">
              {confirmDialog.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-3 sm:justify-start pt-2">
            <Button
              type="button"
              className={cn(
                "flex-1 h-12 rounded-xl font-black uppercase tracking-widest text-[10px]",
                confirmDialog.variant === "destructive"
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-zinc-900 hover:bg-zinc-800 text-white",
              )}
              onClick={() => confirmDialog.onConfirm()}
              disabled={confirmDialog.isLoading}
            >
              {confirmDialog.isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : confirmDialog.variant === "destructive" ? (
                t("delete")
              ) : (
                t("confirm")
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-12 rounded-xl font-black uppercase tracking-widest text-[10px] border-zinc-200"
              onClick={() =>
                setConfirmDialog((prev) => ({ ...prev, open: false }))
              }
            >
              {t("cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Модалкаи ҳатмии рақами телефон ва амният ҳангоми насби QR */}
      <Dialog
        open={showSecondaryPhoneModal}
        onOpenChange={setShowSecondaryPhoneModal}
      >
        <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 gap-0 border-none shadow-2xl bg-white dark:bg-zinc-950 z-[100] max-h-[98vh] overflow-hidden flex flex-col">
          <div className="overflow-y-auto flex-1 px-8 pt-8 pb-4 space-y-6 text-center">
            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center mx-auto mb-1 animate-in zoom-in duration-500">
              <ShieldCheck className="w-8 h-8 text-emerald-500" />
            </div>

            <DialogHeader className="space-y-2">
              <DialogTitle className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                {t("qrSecondaryModal.title")}
              </DialogTitle>
              <DialogDescription className="text-zinc-500 font-bold text-[11px] leading-relaxed">
                {t("qrSecondaryModal.desc")}
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={handleSaveSecondaryPhone}
              id="secondary-phone-form"
              className="space-y-6 text-left"
            >
              <div className="space-y-6">
                {/* Рақами асосӣ (агар набошад) */}
                {(!profile?.phone || profile.phone.trim() === "") && (
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest ml-1">
                      {t("phoneLabel")}
                    </Label>
                    <div className="relative">
                      <Input
                        name="phone"
                        placeholder="XXXXXXXXX"
                        className="h-12 px-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 font-black text-lg tracking-wider border-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-all outline-none"
                        required
                        inputMode="numeric"
                        onChange={(e) =>
                          (e.target.value = e.target.value.replace(/[^0-9]/g, ""))
                        }
                      />
                    </div>
                  </div>
                )}

                {/* Рақами дуюм (агар набошад) */}
                {(!profile?.secondary_phone || !profile?.secondary_phone_type) && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest ml-1">
                        {t("qrSecondaryModal.label")}
                      </Label>
                      <div className="relative">
                        <Input
                          name="secondary_phone"
                          placeholder={t("qrSecondaryModal.placeholder")}
                          className="h-12 px-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 font-black text-lg tracking-wider border-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-all outline-none"
                          required
                          inputMode="numeric"
                          onChange={(e) =>
                            (e.target.value = e.target.value.replace(/[^0-9]/g, ""))
                          }
                        />
                      </div>
                      <p className="text-[8px] font-bold text-zinc-400 px-1 leading-tight uppercase tracking-wider">
                        {t("phoneSecondaryDescription") || "Дар ҳолати гум шудани телефони шумо, ёбанда ба ин рақам занг мезанад."}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest ml-1">
                        {t("qrSecondaryModal.ownerQuestion")}
                      </Label>
                      <div className="grid grid-cols-2 gap-2">
                        {["father", "mother", "brother", "sister", "spouse"].map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setSecondaryType(type)}
                            className={cn(
                              "flex items-center justify-center py-3 rounded-xl transition-all duration-300 font-black uppercase text-[10px] tracking-wider",
                              secondaryType === type
                                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-md scale-[1.02]"
                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200",
                            )}
                          >
                            {t(`phoneSecondaryTypes.${type}`)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Қабули шартҳо (агар қабул нашуда бошад) */}
                {profile?.accepted_terms !== true && (
                  <div className="flex items-start space-x-3 pt-2 px-1">
                    <Checkbox 
                      id="terms-profile" 
                      checked={acceptedTerms}
                      onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                      className="mt-1 border-2 border-zinc-200 dark:border-zinc-800 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 rounded-md transition-all duration-300"
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label
                        htmlFor="terms-profile"
                        className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 leading-relaxed cursor-pointer select-none"
                      >
                        {t('terms.checkbox')}
                      </Label>
                      <button 
                        type="button"
                        className="text-[9px] font-black uppercase tracking-widest text-emerald-500 hover:text-emerald-600 transition-colors text-left"
                        onClick={() => setShowTermsDetails(true)}
                      >
                        {t('terms.link')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </form>
          </div>

          <div className="px-8 pb-8 pt-2">
            <Button
              type="submit"
              form="secondary-phone-form"
              className="w-full h-14 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] bg-emerald-500 hover:bg-emerald-600 text-white shadow-xl shadow-emerald-500/10 transition-all active:scale-95 disabled:opacity-50 border-none"
              disabled={secondaryLoading || ( (!profile?.secondary_phone || !profile?.secondary_phone_type) && !secondaryType ) || (profile?.accepted_terms !== true && !acceptedTerms)}
            >
              {secondaryLoading ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                t("saveAndDownload") || "Захира ва боргирӣ"
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowSecondaryPhoneModal(false)}
              className="w-full mt-2 text-[9px] font-black uppercase tracking-widest text-zinc-400"
            >
              {t("cancel")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Terms Details Dialog */}
      <Dialog open={showTermsDetails} onOpenChange={setShowTermsDetails}>
        <DialogContent className="w-[96%] sm:max-w-[400px] rounded-3xl p-8 border-none shadow-2xl bg-white dark:bg-zinc-950 z-[110]">
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white">
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
            className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-[10px] bg-zinc-900 text-white hover:bg-zinc-800 transition-all active:scale-95"
          >
            {t('ok')}
          </Button>
        </DialogContent>
      </Dialog>
      {/* Why QR Modal */}
      <Dialog open={showWhyQRModal} onOpenChange={setShowWhyQRModal}>
        <DialogContent className="w-[96%] sm:max-w-md rounded-3xl p-8 border-none shadow-2xl bg-white dark:bg-zinc-950 z-[120]">
          <DialogHeader className="space-y-4 text-center">
            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-3xl flex items-center justify-center mx-auto mb-2">
              <QrCode className="w-8 h-8 text-emerald-500" />
            </div>
            <DialogTitle className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white leading-tight">
              {t("qrWhyGuideTitle") || "Чӣ тавр QR-код ба шумо кӯмак мекунад?"}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-zinc-600 dark:text-zinc-400 font-bold text-sm leading-relaxed space-y-4 text-left mt-4">
                <p className="text-center mb-6">
                  {t("qrWhyGuideDesc") || "Ин стикери махсусест, ки ашёҳои шуморо муҳофизат мекунад. Тарзи кораш хеле оддӣ аст:"}
                </p>
                
                <div className="space-y-5 mt-4 bg-zinc-50 dark:bg-zinc-900/50 p-5 rounded-3xl border border-zinc-100 dark:border-zinc-800">
                  {/* Step 1 */}
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-2xl bg-white dark:bg-zinc-800 flex items-center justify-center shrink-0 shadow-sm border border-zinc-100 dark:border-zinc-700">
                      <span className="font-black text-zinc-900 dark:text-white text-xs">1</span>
                    </div>
                    <div className="space-y-1 mt-1">
                      <h5 className="font-black text-[11px] uppercase tracking-wider text-zinc-900 dark:text-white">
                        {t("qrWhyStep1Title") || "Дизайн ва скачат кунед"}
                      </h5>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                        {t("qrWhyStep1Desc") || "Аввал QR-кодро бо услуби худ дизайн кунед, сипас онро скачат карда, чоп кунед ва ба ашёҳоятон часпонед."}
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-2xl bg-white dark:bg-zinc-800 flex items-center justify-center shrink-0 shadow-sm border border-zinc-100 dark:border-zinc-700">
                      <span className="font-black text-zinc-900 dark:text-white text-xs">2</span>
                    </div>
                    <div className="space-y-1 mt-1">
                      <h5 className="font-black text-[11px] uppercase tracking-wider text-zinc-900 dark:text-white">
                        {t("qrWhyStep2Title") || "Ёбанда скан мекунад"}
                      </h5>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                        {t("qrWhyStep2Desc") || "Ашё гум шавад, шахси ёфтагӣ танҳо камераи телефонашро ба QR-код наздик мекунад."}
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-2xl bg-white dark:bg-zinc-800 flex items-center justify-center shrink-0 shadow-sm border border-zinc-100 dark:border-zinc-700">
                      <span className="font-black text-zinc-900 dark:text-white text-xs">3</span>
                    </div>
                    <div className="space-y-1 mt-1">
                      <h5 className="font-black text-[11px] uppercase tracking-wider text-zinc-900 dark:text-white">
                        {t("qrWhyStep3Title") || "Алоқаи фаврӣ ва бехатар"}
                      </h5>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                        {t("qrWhyStep3Desc") || "Саҳифаи шумо кушода мешавад ва ёбанда бевосита ба шумо занг мезанад. Рақамҳои эҳтиётӣ низ дастрас мешаванд."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="mt-8 flex flex-col gap-2">
            <Button 
              onClick={() => setShowWhyQRModal(false)}
              className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-[11px] bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
            >
              {t("ok") || "Фаҳмо"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Security Mode Modal */}
      <Dialog open={showSecurityModal} onOpenChange={setShowSecurityModal}>
        <DialogContent className="w-[96%] sm:max-w-md rounded-3xl p-8 border-none shadow-2xl bg-white dark:bg-zinc-950 z-[120]">
          <DialogHeader className="space-y-4 text-center">
            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-3xl flex items-center justify-center mx-auto mb-2">
              <ShieldCheck className="w-8 h-8 text-emerald-500" />
            </div>
            <DialogTitle className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white leading-tight">
              {t("qrSecurityTitle") || "Реҷаи амниятӣ"}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-zinc-600 dark:text-zinc-400 font-bold text-sm leading-relaxed space-y-4 text-left mt-4">
                <div className="bg-emerald-50 dark:bg-emerald-900/10 p-6 rounded-3xl border border-emerald-100/50 dark:border-emerald-900/20">
                  <p className="text-[12px] text-emerald-700 dark:text-emerald-400 leading-relaxed font-medium">
                    {t("qrSecurityLong")}
                  </p>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 text-center px-2">
                  {t("qrSecurityQuestionDescription") || "Ин тугма танҳо барои он лозим аст, ки маълумоти шуморо ҳангоми зарурат муҳофизат кунад."}
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="mt-8">
            <Button 
              onClick={() => setShowSecurityModal(false)}
              className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-[11px] bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
            >
              {t("ok") || "Фаҳмо"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

/**
 * Саҳифаи асосии Профил бо Suspense
 */
export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-20 flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-10 h-10 animate-spin text-zinc-900" />
        </div>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}

/**
 * Компоненти хурд барои нишонҳо (Badge)
 */
function Badge({ children, className, variant = "default" }: any) {
  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded text-[10px] font-bold",
        variant === "default"
          ? "bg-zinc-900 text-white"
          : "border border-zinc-200 text-zinc-500",
        className,
      )}
    >
      {children}
    </span>
  );
}
