import { openDB, type IDBPDatabase } from "idb";

export type PaymentStatus = "paid" | "unpaid" | "unknown";
export const CATEGORIES = [
  "Software",
  "Hardware",
  "Travel",
  "Meals",
  "Office",
  "Utilities",
  "Marketing",
  "Professional services",
  "Rent",
  "Other",
] as const;

export interface InvoiceFields {
  vendor: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null; // YYYY-MM-DD
  dueDate: string | null;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  currency: string | null;
  paymentStatus: PaymentStatus;
  category: string | null;
  notes: string | null;
}

export type DocStatus = "processing" | "review" | "saved" | "failed";

export interface DocRecord {
  id: string;
  fileName: string;
  mime: string;
  size: number;
  blob: Blob;
  status: DocStatus;
  stage?: string | undefined;
  rawText?: string;
  fields: InvoiceFields;
  reviewReasons: string[];
  extractor?: "llm" | "heuristic";
  error?: string | undefined;
  createdAt: number;
  updatedAt: number;
}

export const emptyFields = (): InvoiceFields => ({
  vendor: null,
  invoiceNumber: null,
  invoiceDate: null,
  dueDate: null,
  subtotal: null,
  tax: null,
  total: null,
  currency: null,
  paymentStatus: "unknown",
  category: null,
  notes: null,
});

let dbp: Promise<IDBPDatabase> | null = null;
function db() {
  if (!dbp)
    dbp = openDB("invoicemate", 1, {
      upgrade(d) {
        d.createObjectStore("docs", { keyPath: "id" });
      },
    });
  return dbp;
}

const listeners = new Set<() => void>();
export const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const emit = () => listeners.forEach((f) => f());

export async function listDocs(): Promise<DocRecord[]> {
  const all = (await (await db()).getAll("docs")) as DocRecord[];
  return all.sort((a, b) => b.createdAt - a.createdAt);
}
export async function getDoc(id: string) {
  return (await (await db()).get("docs", id)) as DocRecord | undefined;
}
export async function putDoc(d: DocRecord) {
  await (await db()).put("docs", { ...d, updatedAt: Date.now() });
  emit();
}
export async function patchDoc(id: string, patch: Partial<DocRecord>) {
  const d = await getDoc(id);
  if (!d) return;
  await putDoc({ ...d, ...patch });
}
export async function deleteDoc(id: string) {
  await (await db()).delete("docs", id);
  emit();
}
export async function deleteAll() {
  await (await db()).clear("docs");
  emit();
}
