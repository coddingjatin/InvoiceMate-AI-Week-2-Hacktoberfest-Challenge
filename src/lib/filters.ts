import type { DocRecord } from "./db";

export interface Filters {
  q: string;
  from: string;
  to: string;
  min: string;
  max: string;
  category: string;
  payment: string;
  status: string;
}
export const EMPTY_FILTERS: Filters = { q: "", from: "", to: "", min: "", max: "", category: "all", payment: "all", status: "all" };

export function applyFilters(docs: DocRecord[], f: Filters) {
  const q = f.q.trim().toLowerCase();
  return docs.filter((d) => {
    const x = d.fields;
    if (q && ![x.vendor, x.invoiceNumber, x.invoiceDate, x.category, d.fileName].some((v) => v?.toLowerCase().includes(q))) return false;
    if (f.from && (!x.invoiceDate || x.invoiceDate < f.from)) return false;
    if (f.to && (!x.invoiceDate || x.invoiceDate > f.to)) return false;
    if (f.min && (x.total ?? -1) < Number(f.min)) return false;
    if (f.max && (x.total ?? Infinity) > Number(f.max)) return false;
    if (f.category !== "all" && x.category !== f.category) return false;
    if (f.payment !== "all" && x.paymentStatus !== f.payment) return false;
    if (f.status !== "all" && d.status !== f.status) return false;
    return true;
  });
}

export const toRow = (d: DocRecord) => ({
  vendor: d.fields.vendor,
  invoice_number: d.fields.invoiceNumber,
  invoice_date: d.fields.invoiceDate,
  due_date: d.fields.dueDate,
  subtotal: d.fields.subtotal,
  tax: d.fields.tax,
  total: d.fields.total,
  currency: d.fields.currency,
  payment_status: d.fields.paymentStatus,
  category: d.fields.category,
  notes: d.fields.notes,
  record_status: d.status,
  file_name: d.fileName,
});
