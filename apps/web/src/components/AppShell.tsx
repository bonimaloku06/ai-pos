import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import {
  Sidebar,
  SidebarProvider,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
} from "@/components/ui/sidebar";
import {
  Home,
  ShoppingCart,
  Package,
  Pill,
  Warehouse,
  Download,
  AlertTriangle,
  FileText,
  Building2,
  Bot,
  DollarSign,
  BarChart3,
  FileSpreadsheet,
  Settings,
  LogOut,
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/", icon: Home },
  { title: "POS", href: "/pos", icon: ShoppingCart },
  { title: "Products", href: "/products", icon: Package },
  { title: "Active Ingredients", href: "/active-ingredients", icon: Pill },
  { title: "Inventory", href: "/inventory", icon: Warehouse },
  { title: "Receive Stock", href: "/grn", icon: Download },
  { title: "Expiry", href: "/expiry", icon: AlertTriangle },
  { title: "Purchase Orders", href: "/purchase-orders", icon: FileText },
  { title: "Suppliers", href: "/suppliers", icon: Building2 },
  { title: "AI Replenishment", href: "/replenishment", icon: Bot },
  { title: "Pricing Rules", href: "/pricing", icon: DollarSign },
  { title: "Reports", href: "/reports", icon: BarChart3 },
  { title: "Audit Logs", href: "/audit-logs", icon: FileSpreadsheet },
  { title: "Settings", href: "/settings", icon: Settings },
];

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate({ to: "/login" });
  };

  return (
    <SidebarProvider>
      <Sidebar>
        {/* Logo/Header */}
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2">
            <Pill className="h-6 w-6" />
            <h1 className="text-xl font-bold">Pharmacy POS</h1>
          </div>
        </SidebarHeader>

        {/* Navigation */}
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link to={item.href}>
                          <Icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* User section */}
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="flex items-center gap-3 px-2 py-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  {user?.email?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.email}</p>
                  <p className="text-xs text-muted-foreground">{user?.role}</p>
                </div>
              </div>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={handleLogout}>
                <LogOut />
                <span>Logout</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      {/* Main content */}
      <SidebarInset>
        {/* Top bar */}
        <header className="flex h-16 items-center border-b bg-card px-6">
          <div className="flex-1">
            <h2 className="text-lg font-semibold">
              {navItems.find((item) => item.href === location.pathname)?.title || "Dashboard"}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
        </header>

        {/* Content area */}
        <div className="flex-1 overflow-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
