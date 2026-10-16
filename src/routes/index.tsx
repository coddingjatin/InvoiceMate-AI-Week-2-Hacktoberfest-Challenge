import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, FileText, Upload, Wallet, CalendarClock } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useMemo } from "react";
import { PageHeader, Panel, StatusBadge } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocs } from "@/hooks/use-docs";
import { money } from "@/lib/format";
import { meta } from "@/lib/meta";
import { loadSettings } from "@/lib/settings";

export const Route = createFileRoute("/")({
  head: () => meta("Dashboard", "Your recorded expenses, monthly trend and documents needing review — computed on your device."),
  component: Dashboard,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function Dashboard() {
  const docs = useDocs();
  const cur = typeof window === "undefined" ? "INR" : loadSettings().defaultCurrency;
  const s = useMemo(() => {
    if (!docs) return null;
    const saved = docs.filter((d) => d.status === "saved");
    const total = saved.reduce((a, d) => a + (d.fields.total ?? 0), 0);
    const thisMonth = new Date().toISOString().slice(0, 7);
    const month = saved.filter((d) => d.fields.invoiceDate?.startsWith(thisMonth)).reduce((a, d) => a + (d.fields.total ?? 0), 0);
    const unpaid = saved.filter((d) => d.fields.paymentStatus === "unpaid");
    const cats = new Map<string, number>();
    const months = new Map<string, number>();
    for (const d of saved) {
      const c = d.fields.category ?? "Uncategorised";
      cats.set(c, (cats.get(c) ?? 0) + (d.fields.total ?? 0));
      if (d.fields.invoiceDate) {
        const m = d.fields.invoiceDate.slice(0, 7);
        months.set(m, (months.get(m) ?? 0) + (d.fields.total ?? 0));
      }
    }
    return {
      total,
      month,
      count: saved.length,
      unpaid,
      attention: docs.filter((d) => d.status === "review" || d.status === "failed"),
      recent: docs.slice(0, 6),
      cats: [...cats].map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value),
      months: [...months].sort().slice(-12).map(([m, v]) => ({ m, v: Math.round(v) })),
    };
  }, [docs]);

  if (!s) return <Skeleton className="h-96 w-full rounded-2xl" />;

  if (!docs!.length)
    return (
      <>
        <PageHeader title="Good to see you." subtitle="Your private expense desk." />
        <Panel className="py-16 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 text-2xl">No documents yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Upload an invoice or receipt. Text is read on your device and fields are extracted by your local model.
          </p>
          <Button asChild className="mt-6">
            <Link to="/upload"><Upload className="mr-2 h-4 w-4" />Upload first document</Link>
          </Button>
        </Panel>
      </>
    );

  const stats = [
    { label: "Total recorded", value: money(s.total, cur), icon: Wallet },
    { label: "This month", value: money(s.month, cur), icon: CalendarClock },
    { label: "Saved invoices", value: String(s.count), icon: FileText },
    { label: "Marked unpaid", value: `${s.unpaid.length} · ${money(s.unpaid.reduce((a, d) => a + (d.fields.total ?? 0), 0), cur)}`, icon: AlertTriangle },
  ];

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Figures from saved records only. Amounts shown in your default currency." action={<Button asChild><Link to="/upload"><Upload className="mr-2 h-4 w-4" />Upload</Link></Button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <Panel key={label}>
            <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">{label}<Icon className="h-4 w-4" /></div>
            <div className="mt-3 font-display text-2xl tabular">{value}</div>
          </Panel>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-3">
          <h3 className="text-lg">Monthly spending</h3>
          <div className="mt-4 h-64">
            {s.months.length ? (
              <ResponsiveContainer>
                <LineChart data={s.months}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="m" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={60} />
                  <Tooltip formatter={(v: number) => money(v, cur)} />
                  <Line type="monotone" dataKey="v" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <Empty text="Save records with dates to see a trend." />}
          </div>
        </Panel>
        <Panel className="lg:col-span-2">
          <h3 className="text-lg">By category</h3>
          <div className="mt-4 h-64">
            {s.cats.length ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={s.cats} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {s.cats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => money(v, cur)} />
                </PieChart>
              </ResponsiveContainer>
            ) : <Empty text="No saved records yet." />}
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {s.cats.slice(0, 5).map((c, i) => (
              <li key={c.name} className="flex justify-between"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{c.name}</span><span className="tabular text-muted-foreground">{money(c.value, cur)}</span></li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel>
          <h3 className="text-lg">Recent documents</h3>
          <ul className="mt-3 divide-y divide-border">
            {s.recent.map((d) => (
              <li key={d.id}>
                <Link to="/doc/$id" params={{ id: d.id }} className="flex items-center justify-between gap-3 py-3 hover:text-primary">
                  <div className="min-w-0"><div className="truncate font-medium">{d.fields.vendor ?? d.fileName}</div><div className="text-xs text-muted-foreground">{d.fields.invoiceDate ?? "No date"}</div></div>
                  <div className="flex items-center gap-3"><span className="tabular text-sm">{money(d.fields.total, d.fields.currency ?? cur)}</span><StatusBadge status={d.status} /></div>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <h3 className="text-lg">Needs attention</h3>
          {s.attention.length ? (
            <ul className="mt-3 divide-y divide-border">
              {s.attention.map((d) => (
                <li key={d.id}>
                  <Link to="/doc/$id" params={{ id: d.id }} className="flex items-center justify-between gap-3 py-3 hover:text-primary">
                    <div className="min-w-0"><div className="truncate font-medium">{d.fileName}</div><div className="truncate text-xs text-muted-foreground">{d.error ?? d.reviewReasons[0] ?? "Review extracted fields"}</div></div>
                    <StatusBadge status={d.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-muted-foreground">Everything is reviewed. Nice.</p>}
        </Panel>
      </div>
      <Panel className="mt-4">
        <h3 className="text-lg">Top categories</h3>
        <div className="mt-4 h-48">
          <ResponsiveContainer>
            <BarChart data={s.cats.slice(0, 8)}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => money(v, cur)} />
              <Bar dataKey="value" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </>
  );
}

const Empty = ({ text }: { text: string }) => <div className="grid h-full place-items-center text-sm text-muted-foreground">{text}</div>;
