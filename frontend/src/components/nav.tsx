"use client";

import { Archive, BookOpen, ChevronRight, Clapperboard, FileOutput, Gauge, Home, Music2, Settings, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", icon: Home, label: "Dashboard" },
  { href: "/library", icon: Archive, label: "Library" },
  { href: "/review", icon: SlidersHorizontal, label: "Review Queue" },
  { href: "/exports", icon: FileOutput, label: "Exports" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

const mediaIcons = { movie: Clapperboard, book: BookOpen, music: Music2 };

export function Nav() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-52 shrink-0 lg:block">
        <nav className="sticky top-6 space-y-1">
          <div className="mb-5 flex items-center gap-2.5 px-3">
            <Gauge className="h-5 w-5 text-primary" />
            <span className="font-semibold tracking-tight">DoubanRefugee</span>
          </div>
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
                {active && <ChevronRight className="ml-auto h-3 w-3" />}
              </Link>
            );
          })}

          <div className="mt-6 rounded-md border bg-card/60 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Extension ready</p>
            <p className="mt-1 leading-relaxed">Install the browser extension to auto-scrape your Douban history.</p>
          </div>
        </nav>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-lg">
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 px-1 py-2 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                {label.split(" ")[0]}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

// Re-export for convenience
export { mediaIcons };
