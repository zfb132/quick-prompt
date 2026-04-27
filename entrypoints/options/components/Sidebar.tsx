import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Braces,
  Cloud,
  Database,
  FolderKanban,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  Sparkles,
  Tags,
  X,
} from "lucide-react";

import Logo from "~/assets/icon.png";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { t } from "../../../utils/i18n";

const SIDEBAR_COLLAPSED_KEY = "sidebar_collapsed";

interface SidebarProps {
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ className = "" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return saved === "true";
  });

  useEffect(() => {
    const checkScreenSize = () => {
      const nextIsMobile = window.innerWidth < 768;
      setIsMobile(nextIsMobile);
      setIsOpen(!nextIsMobile);
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  const primaryItems = [
    {
      path: "/",
      name: t("promptManagement"),
      icon: FolderKanban,
      description: t("promptManagementDescription"),
      resetDocumentUrl: true,
    },
    {
      path: "/categories",
      name: t("categoryManagement"),
      icon: Tags,
      description: t("promptCategoryManagement"),
    },
    {
      path: "/settings",
      name: t("globalSettings"),
      icon: Settings2,
      description: t("globalSettingsDescription"),
    },
  ];

  const integrationItems = [
    { path: "/integrations/gist", name: t("gistSync"), icon: Braces },
    { path: "/integrations/notion", name: t("notionSync"), icon: Database },
    { path: "/integrations/webdav", name: t("webdavSync"), icon: Cloud },
  ];

  const closeSidebar = () => {
    if (isMobile) setIsOpen(false);
  };

  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newState));
  };

  const collapsed = isCollapsed && !isMobile;
  const width = isMobile ? "268px" : collapsed ? "72px" : "240px";

  return (
    <TooltipProvider delayDuration={120}>
      {isMobile && !isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed left-4 top-3 z-50 shadow-lg md:hidden"
          size="icon"
          variant="outline"
          aria-label={t("openMenu")}
        >
          <Menu className="size-5" />
        </Button>
      )}

      {isMobile && isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/45 backdrop-blur-sm md:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "border-r border-border bg-card/95 text-card-foreground backdrop-blur transition-all duration-300",
          isMobile ? "fixed z-40 h-full shadow-2xl" : "relative z-0 h-auto",
          isMobile && !isOpen ? "-translate-x-full" : "translate-x-0",
          className,
        )}
        style={{ width }}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2 border-b border-border p-4">
            <NavLink
              to="/"
              onClick={closeSidebar}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-3 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring",
                collapsed && "justify-center",
              )}
              title="Quick Prompt"
            >
              <img src={Logo} alt="Quick Prompt Logo" className="size-9 rounded-2xl shadow-sm" />
              {!collapsed && (
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">Quick Prompt</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Sparkles className="size-3" />
                    /p
                  </div>
                </div>
              )}
            </NavLink>

            {isMobile && (
              <Button
                onClick={closeSidebar}
                size="icon-sm"
                variant="ghost"
                aria-label={t("closeMenu")}
              >
                <X className="size-4" />
              </Button>
            )}
          </div>

          <nav className="flex-1 space-y-1 p-3">
            {primaryItems.map((item) => (
              <SidebarLink
                key={item.path}
                {...item}
                collapsed={collapsed}
                onClick={closeSidebar}
              />
            ))}

            {!isMobile && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={toggleCollapse}
                    variant="ghost"
                    size="icon-sm"
                    className={cn(
                      "w-full justify-center text-muted-foreground hover:text-foreground",
                      collapsed && "mx-auto w-10",
                    )}
                    title={collapsed ? t("expandSidebar") : t("collapseSidebar")}
                    aria-label={collapsed ? t("expandSidebar") : t("collapseSidebar")}
                  >
                    {collapsed ? (
                      <PanelLeftOpen className="size-4" />
                    ) : (
                      <PanelLeftClose className="size-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {collapsed ? t("expandSidebar") : t("collapseSidebar")}
                </TooltipContent>
              </Tooltip>
            )}
          </nav>

          <div className="border-t border-border p-3">
            <div className="mb-3 space-y-1">
              {integrationItems.map((item) => (
                <SidebarLink
                  key={item.path}
                  {...item}
                  collapsed={collapsed}
                  onClick={closeSidebar}
                  subtle
                />
              ))}
            </div>
            {!collapsed && (
              <a
                href="https://quick-prompt.wenyuanw.me/"
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg px-2 py-1 text-center text-[10px] text-muted-foreground transition-colors hover:text-foreground"
              >
                © {new Date().getFullYear()} Quick Prompt
              </a>
            )}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
};

interface SidebarLinkProps {
  path: string;
  name: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  collapsed: boolean;
  subtle?: boolean;
  resetDocumentUrl?: boolean;
  onClick: () => void;
}

function SidebarLink({
  path,
  name,
  description,
  icon: Icon,
  collapsed,
  subtle,
  resetDocumentUrl,
  onClick,
}: SidebarLinkProps) {
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    onClick();

    if (!resetDocumentUrl) return;

    event.preventDefault();
    const cleanUrl = window.location.pathname;
    if (window.location.search || window.location.hash) {
      window.history.replaceState({}, document.title, cleanUrl);
      const hashChangeEvent = typeof HashChangeEvent === "function"
        ? new HashChangeEvent("hashchange")
        : new Event("hashchange");
      const popStateEvent = typeof PopStateEvent === "function"
        ? new PopStateEvent("popstate", { state: window.history.state })
        : new Event("popstate");
      window.dispatchEvent(hashChangeEvent);
      window.dispatchEvent(popStateEvent);
    }
  };

  const link = (
    <NavLink
      to={path}
      onClick={handleClick}
      className={({ isActive }) =>
        cn(
          "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
          collapsed && "justify-center px-2",
          subtle && "py-1.5 text-xs",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )
      }
      title={collapsed ? name : description}
    >
      <Icon className={cn("size-4 shrink-0", !subtle && "size-5")} />
      {!collapsed && <span className="truncate">{name}</span>}
    </NavLink>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{name}</TooltipContent>
    </Tooltip>
  );
}

export default Sidebar;
