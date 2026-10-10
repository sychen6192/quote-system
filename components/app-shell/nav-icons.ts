import { FileText, LayoutDashboard, Settings, Users, type LucideIcon } from "lucide-react";
import type { NavKey } from "./nav-config";

export const NAV_ICONS: Record<NavKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  quotes: FileText,
  customers: Users,
  settings: Settings,
};
