import { z } from "zod";
import { CATEGORIES, emptyFields, type InvoiceFields } from "./db";

const num = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v == null || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
  });
const str = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((v) => (v == null || String(v).trim() === "" || /^(null|n\/a|unknown)$/i.test(String(v).trim()) ? null : String(v).trim().slice(0, 200)));
const date = str.transform((v) => {
  if (!v) return null;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(v + "T00:00:00Z");
  return Number.isNaN(d.getTime()) ? null : v;
});

export const ExtractionSchema = z.object({
  vendor: str,
  invoiceNumber: str,
  invoiceDate: date,
  dueDate: date,
  subtotal: num,
  tax: num,
  total: num,
  currency: str.transform((v) => (v && /^[A-Za-z]{3}$/.test(v) ? v.toUpperCase() : null)),
  paymentStatus: z
    .any()
    .optional()
    .transform((v) => (v === "paid" || v === "unpaid" ? v : "unknown") as InvoiceFields["paymentStatus"]),
  category: str.transform((v) => (v && (CATEGORIES as readonly string[]).includes(v) ? v : v ? "Other" : null)),
  notes: str,
});

/** Validate model output and apply deterministic arithmetic checks. */
export function finalize(raw: unknown): { fields: InvoiceFields; reasons: string[] } {
  const parsed = ExtractionSchema.safeParse(raw ?? {});
  const fields: InvoiceFields = parsed.success ? { ...emptyFields(), ...parsed.data } : emptyFields();
  const reasons: string[] = [];
  if (!parsed.success) reasons.push("Extraction output did not match the schema");
  const { subtotal, tax, total } = fields;
  if (total == null && subtotal != null) {
    fields.total = Math.round((subtotal + (tax ?? 0)) * 100) / 100;
    reasons.push("Total was calculated from subtotal + tax");
  }
  if (subtotal != null && tax != null && total != null && Math.abs(subtotal + tax - total) > 0.01) {
    reasons.push(`Subtotal + tax (${(subtotal + tax).toFixed(2)}) doesn't match total (${total.toFixed(2)})`);
  }
  if (!fields.vendor) reasons.push("Vendor not found");
  if (fields.total == null) reasons.push("Total amount not found");
  if (!fields.invoiceDate) reasons.push("Invoice date not found");
  if (!fields.currency) reasons.push("Currency not detected");
  return { fields, reasons };
}
