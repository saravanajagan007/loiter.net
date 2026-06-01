import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { LayoutDashboard, Settings, Megaphone, Calendar, BarChart3, Layers } from "lucide-react";
import Link from "next/link";

import { type Session } from "next-auth";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Sources", url: "/sources", icon: Layers },
  { title: "AI Studio", url: "/studio", icon: Megaphone },
  { title: "Scheduler", url: "/scheduler", icon: Calendar },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Settings", url: "/settings", icon: Settings },
];

import { SidebarFooterUser } from "./sidebar-footer-user";

export function AppSidebar({ user }: { user: Session["user"] }) {
  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="font-bold text-xl tracking-tight">Loiter.net</div>
        <div className="text-xs text-muted-foreground uppercase mt-2">SaaS Automation</div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu className="px-2">
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                render={
                  <Link href={item.url}>
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </Link>
                }
              />
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t">
        <SidebarFooterUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
