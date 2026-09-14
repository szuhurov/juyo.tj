/**
 * Icon for each category (lucide-react), shared between the main page filter
 * and ItemListRow — so the two places don't drift apart.
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
