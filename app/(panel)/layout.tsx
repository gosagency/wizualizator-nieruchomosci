import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";

export default function PanelLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
