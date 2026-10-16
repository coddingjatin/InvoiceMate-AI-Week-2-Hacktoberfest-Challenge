import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Loader2, RotateCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader, Panel, StatusBadge } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDocs } from "@/hooks/use-docs";
import { CATEGORIES, deleteDoc, patchDoc, type InvoiceFields } from "@/lib/db";
import { process } from "@/lib/extract";
import { meta } from "@/lib/meta";
import { finalize } from "@/lib/validate";

export const Route = createFileRoute("/doc/$id")({
  head: () => meta("Review document", "Check and correct extracted invoice fields before saving."),
  component: DocPage,
});

function DocPage() {
  const { id } = Route.useParams();
  const docs = useDocs();
  const doc = docs?.find((d) => d.id === id);
  const nav = useNavigate();
  const [f, setF] = useState<InvoiceFields | null>(null);
  const [url, setUrl] = useState<string>();

  useEffect(() => { if (doc && doc.status !== "processing") setF(doc.fields); }, [doc?.status, doc?.updatedAt]); // eslint-disable-line
  useEffect(() => {
    if (!doc) return;
    const u = URL.createObjectURL(doc.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [doc?.id]); // eslint-disable-line

  if (!docs) return <Loader2 className="h-6 w-6 animate-spin" />;
  if (!doc) return <p>Document not found. <Link to="/library" className="text-primary underline">Back to library</Link></p>;

  const u = <K extends keyof InvoiceFields>(k: K, v: InvoiceFields[K]) => setF((p) => (p ? { ...p, [k]: v } : p));
  const numIn = (k: "subtotal" | "tax" | "total") => (
    <Input id={k} type="number" step="0.01" value={f?.[k] ?? ""} onChange={(e) => u(k, e.target.value === "" ? null : Number(e.target.value))} className="tabular" />
  );
  const txt = (k: "vendor" | "invoiceNumber" | "currency") => <Input id={k} value={f?.[k] ?? ""} onChange={(e) => u(k, e.target.value || null)} />;
  const dt = (k: "invoiceDate" | "dueDate") => <Input id={k} type="date" value={f?.[k] ?? ""} onChange={(e) => u(k, e.target.value || null)} />;

  const save = async () => {
    if (!f) return;
    const { fields, reasons } = finalize(f);
    await patchDoc(doc.id, { fields, status: "saved", reviewReasons: reasons.filter((r) => r.startsWith("Subtotal")) });
    toast.success("Saved");
    nav({ to: "/library" });
  };

  return (
    <>
      <Link to="/library" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Library</Link>
      <PageHeader title={doc.fields.vendor ?? doc.fileName} subtitle={`${doc.fileName} · ${(doc.size / 1024).toFixed(0)} KB${doc.extractor ? ` · extracted by ${doc.extractor === "llm" ? "local model" : "basic rules"}` : ""}`} action={<StatusBadge status={doc.status} />} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="p-2">
          {url && (doc.mime === "application/pdf" ? <iframe title="Document preview" src={url} className="h-[70vh] w-full rounded-xl" /> : <img src={url} alt="Document preview" className="max-h-[70vh] w-full rounded-xl object-contain" />)}
        </Panel>
        <div className="space-y-4">
          {doc.status === "processing" && <Panel className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />{doc.stage}</Panel>}
          {doc.status === "failed" && <Panel className="text-sm text-destructive">{doc.error}</Panel>}
          {doc.reviewReasons.length > 0 && (
            <Panel className="bg-warning-soft">
              <div className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="h-4 w-4" />Please check</div>
              <ul className="mt-2 list-disc pl-5 text-sm">{doc.reviewReasons.map((r) => <li key={r}>{r}</li>)}</ul>
            </Panel>
          )}
          {f && (
            <Panel>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="vendor" label="Vendor" className="sm:col-span-2">{txt("vendor")}</Field>
                <Field id="invoiceNumber" label="Invoice / receipt no.">{txt("invoiceNumber")}</Field>
                <Field id="currency" label="Currency (e.g. INR)">{txt("currency")}</Field>
                <Field id="invoiceDate" label="Invoice date">{dt("invoiceDate")}</Field>
                <Field id="dueDate" label="Due date">{dt("dueDate")}</Field>
                <Field id="subtotal" label="Subtotal">{numIn("subtotal")}</Field>
                <Field id="tax" label="Tax">{numIn("tax")}</Field>
                <Field id="total" label="Total">{numIn("total")}</Field>
                <Field id="pay" label="Payment status">
                  <Select value={f.paymentStatus} onValueChange={(v) => u("paymentStatus", v as InvoiceFields["paymentStatus"])}>
                    <SelectTrigger id="pay"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="unknown">Unknown</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="unpaid">Unpaid</SelectItem></SelectContent>
                  </Select>
                </Field>
                <Field id="cat" label="Category" className="sm:col-span-2">
                  <Select value={f.category ?? ""} onValueChange={(v) => u("category", v)}>
                    <SelectTrigger id="cat"><SelectValue placeholder="Choose category" /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field id="notes" label="Notes" className="sm:col-span-2"><Textarea id="notes" value={f.notes ?? ""} onChange={(e) => u("notes", e.target.value || null)} /></Field>
              </div>
              {f.subtotal != null && f.tax != null && (
                <p className="mt-3 text-xs text-muted-foreground tabular">Check: subtotal + tax = {(f.subtotal + f.tax).toFixed(2)}{f.total != null && Math.abs(f.subtotal + f.tax - f.total) > 0.01 ? " — differs from total" : " ✓"}</p>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                <Button onClick={save}>Save record</Button>
                <Button variant="outline" onClick={() => { patchDoc(doc.id, { status: "processing", stage: "Reading text", error: undefined }); process(doc); }}><RotateCw className="mr-2 h-4 w-4" />Re-extract</Button>
                <Button variant="ghost" className="ml-auto text-destructive" onClick={async () => { if (confirm("Delete this document and its data?")) { await deleteDoc(doc.id); nav({ to: "/library" }); } }}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
              </div>
            </Panel>
          )}
          {doc.rawText && (
            <details className="rounded-2xl border border-border bg-card p-4 text-sm">
              <summary className="cursor-pointer font-medium">Extracted text</summary>
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">{doc.rawText}</pre>
            </details>
          )}
        </div>
      </div>
    </>
  );
}

function Field({ id, label, children, className }: { id: string; label: string; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-1.5 ${className ?? ""}`}><Label htmlFor={id}>{label}</Label>{children}</div>;
}
