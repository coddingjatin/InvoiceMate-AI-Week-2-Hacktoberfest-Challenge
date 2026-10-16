import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpDown, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader, Panel, StatusBadge } from "@/components/AppShell";
import { FilterBar } from "@/components/FilterBar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocs } from "@/hooks/use-docs";
import { deleteDoc, type DocRecord } from "@/lib/db";
import { applyFilters, EMPTY_FILTERS } from "@/lib/filters";
import { money } from "@/lib/format";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/library")({
  head: () => meta("Library", "Search, filter, sort and manage every invoice and receipt stored on your device."),
  component: Library,
});

type Key = "vendor" | "date" | "total" | "category";
const PAGE = 12;
const get = (d: DocRecord, k: Key) =>
  k === "vendor" ? d.fields.vendor ?? "" : k === "date" ? d.fields.invoiceDate ?? "" : k === "total" ? d.fields.total ?? -1 : d.fields.category ?? "";

function Library() {
  const docs = useDocs();
  const [f, setF] = useState(EMPTY_FILTERS);
  const [sort, setSort] = useState<{ k: Key; dir: 1 | -1 }>({ k: "date", dir: -1 });
  const [page, setPage] = useState(0);
  const rows = useMemo(() => {
    const r = applyFilters(docs ?? [], f);
    return r.sort((a, b) => (get(a, sort.k) > get(b, sort.k) ? 1 : get(a, sort.k) < get(b, sort.k) ? -1 : 0) * sort.dir);
  }, [docs, f, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);

  const th = (k: Key, label: string, right = false) => (
    <th className={`px-4 py-3 font-medium ${right ? "text-right" : "text-left"}`}>
      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setSort((s) => ({ k, dir: s.k === k ? (s.dir === 1 ? -1 : 1) : 1 }))}>
        {label}<ArrowUpDown className="h-3 w-3" />
      </button>
    </th>
  );

  return (
    <>
      <PageHeader title="Library" subtitle={docs ? `${rows.length} of ${docs.length} documents` : " "} />
      <FilterBar f={f} set={(v) => { setF(v); setPage(0); }} />
      <Panel className="mt-4 overflow-x-auto p-0">
        {!docs ? <Skeleton className="m-4 h-64" /> : !rows.length ? (
          <p className="p-10 text-center text-sm text-muted-foreground">{docs.length ? "No documents match these filters." : <>Nothing here yet. <Link to="/upload" className="text-primary underline">Upload a document</Link>.</>}</p>
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
              <tr>{th("vendor", "Vendor")}<th className="px-4 py-3 text-left font-medium">Number</th>{th("date", "Date")}{th("category", "Category")}{th("total", "Total", true)}<th className="px-4 py-3 text-left font-medium">Payment</th><th className="px-4 py-3 text-left font-medium">Status</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((d) => (
                <tr key={d.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3"><Link to="/doc/$id" params={{ id: d.id }} className="font-medium hover:text-primary">{d.fields.vendor ?? d.fileName}</Link></td>
                  <td className="px-4 py-3 text-muted-foreground">{d.fields.invoiceNumber ?? "—"}</td>
                  <td className="px-4 py-3 tabular">{d.fields.invoiceDate ?? "—"}</td>
                  <td className="px-4 py-3">{d.fields.category ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular">{money(d.fields.total, d.fields.currency ?? "INR")}</td>
                  <td className="px-4 py-3"><StatusBadge status={d.fields.paymentStatus} /></td>
                  <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                  <td className="px-2 py-3">
                    <Button variant="ghost" size="icon" aria-label="Delete" onClick={async () => { if (confirm(`Delete ${d.fileName} and its data?`)) { await deleteDoc(d.id); toast.success("Deleted"); } }}><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="text-muted-foreground">Page {page + 1} of {pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
    </>
  );
}
