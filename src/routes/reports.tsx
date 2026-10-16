import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader, Panel } from "@/components/AppShell";
import { FilterBar } from "@/components/FilterBar";
import { Button } from "@/components/ui/button";
import { useDocs } from "@/hooks/use-docs";
import { applyFilters, EMPTY_FILTERS, toRow } from "@/lib/filters";
import { download, toCSV } from "@/lib/format";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/reports")({
  head: () => meta("Reports & exports", "Export filtered invoice records and monthly summaries as CSV."),
  component: Reports,
});

function Reports() {
  const docs = useDocs();
  const [f, setF] = useState({ ...EMPTY_FILTERS, status: "saved" });
  const rows = useMemo(() => applyFilters(docs ?? [], f), [docs, f]);
  const monthly = useMemo(() => {
    const m = new Map<string, { month: string; currency: string; count: number; total: number }>();
    for (const d of rows) {
      const k = `${d.fields.invoiceDate?.slice(0, 7) ?? "undated"}|${d.fields.currency ?? ""}`;
      const e = m.get(k) ?? { month: k.split("|")[0]!, currency: d.fields.currency ?? "", count: 0, total: 0 };
      e.count++;
      e.total = Math.round((e.total + (d.fields.total ?? 0)) * 100) / 100;
      m.set(k, e);
    }
    return [...m.values()].sort((a, b) => a.month.localeCompare(b.month));
  }, [rows]);
  return (
    <>
      <PageHeader title="Reports" subtitle={`${rows.length} records match. Exports use exactly these filters.`} />
      <FilterBar f={f} set={setF} />
      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={!rows.length} onClick={() => download("invoices.csv", toCSV(rows.map(toRow)))}><Download className="mr-2 h-4 w-4" />Records CSV</Button>
        <Button variant="outline" disabled={!monthly.length} onClick={() => download("monthly-summary.csv", toCSV(monthly))}><Download className="mr-2 h-4 w-4" />Monthly summary CSV</Button>
      </div>
      <Panel className="mt-4">
        <h3 className="text-lg">Monthly summary</h3>
        <ul className="mt-3 divide-y divide-border text-sm">
          {monthly.map((m) => <li key={m.month + m.currency} className="flex justify-between py-2"><span>{m.month} · {m.count} records</span><span className="tabular">{m.currency} {m.total.toFixed(2)}</span></li>)}
          {!monthly.length && <li className="py-2 text-muted-foreground">No records match.</li>}
        </ul>
      </Panel>
    </>
  );
}
