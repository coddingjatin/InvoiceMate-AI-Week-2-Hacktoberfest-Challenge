import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, FileText, LayoutDashboard, MessageSquare, Settings, Upload, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/upload", label: "Upload", icon: Upload },
  { to: "/library", label: "Library", icon: FileText },
  { to: "/assistant", label: "Assistant", icon: MessageSquare },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-sidebar-border bg-sidebar md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary font-display text-lg text-primary-foreground">i</div>
          <div>
            <div className="font-display text-lg leading-none">InvoiceMate</div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Local AI</div>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? path === "/" : path.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mx-4 mt-8 hidden rounded-xl border border-sidebar-border bg-card p-3 text-xs text-muted-foreground md:block">
          <ShieldCheck className="mb-1 h-4 w-4 text-primary" />
          Documents and records stay in this browser on your device. AI runs through your own Ollama.
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl md:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border border-border bg-card p-5 shadow-card", className)}>{children}</div>;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    saved: "bg-success-soft text-accent-foreground",
    review: "bg-warning-soft text-foreground",
    processing: "bg-muted text-muted-foreground",
    failed: "bg-destructive/10 text-destructive",
    paid: "bg-success-soft text-accent-foreground",
    unpaid: "bg-warning-soft text-foreground",
    unknown: "bg-muted text-muted-foreground",
  };
  return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize", map[status])}>{status}</span>;
}
