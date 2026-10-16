import { CATEGORIES, emptyFields, patchDoc, putDoc, type DocRecord } from "./db";
import { chatJSON, LocalModelError } from "./ollama";
import { loadSettings } from "./settings";
import { finalize } from "./validate";

export const ACCEPTED = ["application/pdf", "image/png", "image/jpeg"];

export function safeName(n: string) {
  return n.replace(/[\\/]+/g, "_").replace(/[^\w.\- ]+/g, "").slice(0, 120) || "document";
}

async function sniff(file: File): Promise<string | null> {
  const b = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  return null;
}

async function ocrImage(src: Blob | HTMLCanvasElement): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const w = await createWorker("eng");
  try {
    const { data } = await w.recognize(src as never);
    return data.text;
  } finally {
    await w.terminate();
  }
}

async function pdfText(file: Blob): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  let text = "";
  const pages = Math.min(pdf.numPages, 5);
  for (let i = 1; i <= pages; i++) {
    const p = await pdf.getPage(i);
    const c = await p.getTextContent();
    text += c.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n";
  }
  if (text.replace(/\s/g, "").length > 40) return text;
  // scanned PDF -> render and OCR
  let out = "";
  for (let i = 1; i <= pages; i++) {
    const p = await pdf.getPage(i);
    const vp = p.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = vp.width;
    canvas.height = vp.height;
    await p.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
    out += (await ocrImage(canvas)) + "\n";
  }
  return out;
}

const SYSTEM = `You extract invoice/receipt data. Reply with ONLY a JSON object with keys:
vendor, invoiceNumber, invoiceDate (YYYY-MM-DD), dueDate (YYYY-MM-DD), subtotal (number), tax (number), total (number),
currency (ISO 4217 code like INR, USD, EUR), paymentStatus ("paid" | "unpaid" | "unknown"), category (one of: ${CATEGORIES.join(", ")}), notes (short string).
Rules: use null for anything not clearly present. NEVER guess or invent values. paymentStatus is "paid"/"unpaid" only if the document says so explicitly.`;

/** Local, rule-based fallback used only when the local model is unavailable. Results always need review. */
export function heuristic(text: string) {
  const f = emptyFields();
  const amt = (re: RegExp) => {
    const m = text.match(re);
    return m?.[1] ? Number(m[1].replace(/,/g, "")) : null;
  };
  f.total = amt(/(?:grand\s*total|total\s*due|amount\s*due|total)[^\d]{0,15}([\d,]+\.?\d{0,2})/i);
  f.subtotal = amt(/sub\s*-?total[^\d]{0,15}([\d,]+\.?\d{0,2})/i);
  f.tax = amt(/(?:tax|gst|vat)[^\d]{0,15}([\d,]+\.?\d{0,2})/i);
  const inv = text.match(/(?:invoice|receipt|bill)\s*(?:no\.?|number|#)\s*[:#]?\s*([A-Z0-9\-\/]{3,})/i);
  f.invoiceNumber = inv?.[1] ?? null;
  const d = text.match(/(\d{4})-(\d{2})-(\d{2})/) || null;
  f.invoiceDate = d ? d[0] : null;
  if (/₹|\bINR\b|\bRs\.?/i.test(text)) f.currency = "INR";
  else if (/\$|\bUSD\b/.test(text)) f.currency = "USD";
  else if (/€|\bEUR\b/.test(text)) f.currency = "EUR";
  f.vendor = text.split("\n").map((l) => l.trim()).find((l) => l.length > 2 && /[a-z]/i.test(l))?.slice(0, 80) ?? null;
  if (/\bpaid\b/i.test(text) && !/\bunpaid\b/i.test(text)) f.paymentStatus = "paid";
  return f;
}

export async function ingest(file: File): Promise<string> {
  const s = loadSettings();
  if (file.size > s.maxUploadMb * 1024 * 1024) throw new Error(`File is larger than ${s.maxUploadMb} MB`);
  const mime = await sniff(file);
  if (!mime || !ACCEPTED.includes(mime)) throw new Error("Unsupported file. Use PDF, PNG or JPG.");
  const id = crypto.randomUUID();
  const now = Date.now();
  const rec: DocRecord = {
    id,
    fileName: safeName(file.name),
    mime,
    size: file.size,
    blob: file.slice(0, file.size, mime),
    status: "processing",
    stage: "Reading text",
    fields: emptyFields(),
    reviewReasons: [],
    createdAt: now,
    updatedAt: now,
  };
  await putDoc(rec);
  void process(rec);
  return id;
}

export async function process(rec: DocRecord) {
  try {
    const text = rec.mime === "application/pdf" ? await pdfText(rec.blob) : await ocrImage(rec.blob);
    if (text.replace(/\s/g, "").length < 10) throw new Error("No readable text found in the document");
    await patchDoc(rec.id, { rawText: text, stage: "Extracting fields with local model" });
    let raw: unknown;
    let extractor: "llm" | "heuristic" = "llm";
    const extra: string[] = [];
    try {
      raw = await chatJSON(SYSTEM, `Document text:\n"""\n${text.slice(0, 6000)}\n"""`);
    } catch (e) {
      if (!(e instanceof LocalModelError)) throw e;
      raw = heuristic(text);
      extractor = "heuristic";
      extra.push(`Local model unavailable (${e.message}); used basic on-device rules`);
    }
    const { fields, reasons } = finalize(raw);
    await patchDoc(rec.id, {
      fields,
      extractor,
      reviewReasons: [...extra, ...reasons],
      status: "review",
      stage: undefined,
    });
  } catch (e) {
    await patchDoc(rec.id, { status: "failed", stage: undefined, error: (e as Error).message });
  }
}
