/**
 * Icon-и ҳар категория (lucide-react), якхела барои филтри саҳифаи асосӣ
 * ва ItemListRow — то ду ҷо аз ҳам дур наравад.
 */
import {
  Cpu,
  IdCard,
  KeyRound,
  Shirt,
  PawPrint,
  Package,
  Car,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Electronics: Cpu,
  Documents: IdCard,
  Keys: KeyRound,
  Clothing: Shirt,
  Pets: PawPrint,
  Other: Package,
  LicensePlate: Car,
  Wallet: Wallet,
};
