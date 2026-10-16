import { z } from "zod";
import type { DocRecord } from "./db";
import { chatJSON, chatText, LocalModelError } from "./ollama";

/** Predefined, validated query functions. The model may only pick one of these — it never runs code. */
export type Row = { vendor: string; date: string | null; total: number; currency: string; category: string; status: string; due?: string | null };

const saved = (docs: DocRecord[]) => docs.filter((d) => d.status === "saved");
const inRange = (d: DocRecord, from?: string | null, to?: string | null) => {
  const x = d.fields.invoiceDate;
  if (!x) return !from && !to;
  return (!from || x >= from) && (!to || x <= to);
};
const row = (d: DocRecord): Row => ({
  vendor: d.fields.vendor ?? "Unknown",
  date: d.fields.invoiceDate,
  total: d.fields.total ?? 0,
  currency: d.fields.currency ?? "—",
  category: d.fields.category ?? "Uncategorised",
  status: d.fields.paymentStatus,
  due: d.fields.dueDate,
});

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish();

export const TOOLS = {
  total_spend: {
    desc: "Total spent in a date range. args: {from?: YYYY-MM-DD, to?: YYYY-MM-DD}",
    args: z.object({ from: dateStr, to: dateStr }),
    run: (docs: DocRecord[], a: { from?: string | null; to?: string | null }) => {
      const r = saved(docs).filter((d) => inRange(d, a.from, a.to));
      const missing = r.filter((d) => d.fields.total == null).length;
      return { summary: { total: sum(r), count: r.length, missingTotals: missing, from: a.from ?? null, to: a.to ?? null }, rows: r.map(row) };
    },
  },
  top_vendors: {
    desc: "Vendors ranked by total paid. args: {limit?: number}",
    args: z.object({ limit: z.number().int().min(1).max(20).nullish() }),
    run: (docs: DocRecord[], a: { limit?: number | null }) => {
      const m = group(saved(docs), (d) => d.fields.vendor ?? "Unknown");
      return { summary: { vendors: m.slice(0, a.limit ?? 5) }, rows: [] };
    },
  },
  expenses_above: {
    desc: "Records with total above an amount. args: {amount: number}",
    args: z.object({ amount: z.number().min(0) }),
    run: (docs: DocRecord[], a: { amount: number }) => {
      const r = saved(docs).filter((d) => (d.fields.total ?? 0) > a.amount);
      return { summary: { amount: a.amount, count: r.length, total: sum(r) }, rows: r.map(row) };
    },
  },
  by_category: {
    desc: "Spending grouped by category. args: {from?, to?}",
    args: z.object({ from: dateStr, to: dateStr }),
    run: (docs: DocRecord[], a: { from?: string | null; to?: string | null }) => ({
      summary: { categories: group(saved(docs).filter((d) => inRange(d, a.from, a.to)), (d) => d.fields.category ?? "Uncategorised") },
      rows: [],
    }),
  },
  upcoming_due: {
    desc: "Invoices with due dates in the next N days that aren't marked paid. args: {days?: number}",
    args: z.object({ days: z.number().int().min(1).max(365).nullish() }),
    run: (docs: DocRecord[], a: { days?: number | null }) => {
      const today = new Date().toISOString().slice(0, 10);
      const lim = new Date(Date.now() + (a.days ?? 30) * 864e5).toISOString().slice(0, 10);
      const r = saved(docs).filter((d) => d.fields.dueDate && d.fields.dueDate >= today && d.fields.dueDate <= lim && d.fields.paymentStatus !== "paid");
      return { summary: { days: a.days ?? 30, count: r.length, total: sum(r) }, rows: r.map(row) };
    },
  },
  unpaid: {
    desc: "Invoices explicitly marked unpaid. args: {}",
    args: z.object({}),
    run: (docs: DocRecord[]) => {
      const r = saved(docs).filter((d) => d.fields.paymentStatus === "unpaid");
      return { summary: { count: r.length, total: sum(r) }, rows: r.map(row) };
    },
  },
} as const;
export type ToolName = keyof typeof TOOLS;

function sum(r: DocRecord[]) {
  return Math.round(r.reduce((s, d) => s + (d.fields.total ?? 0), 0) * 100) / 100;
}
function group(r: DocRecord[], key: (d: DocRecord) => string) {
  const m = new Map<string, { name: string; total: number; count: number }>();
  for (const d of r) {
    const k = key(d);
    const e = m.get(k) ?? { name: k, total: 0, count: 0 };
    e.total = Math.round((e.total + (d.fields.total ?? 0)) * 100) / 100;
    e.count++;
    m.set(k, e);
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}

function monthRange(offset = 0) {
  const d = new Date();
  const a = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  const b = new Date(d.getFullYear(), d.getMonth() + offset + 1, 0);
  const f = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  return { from: f(a), to: f(b) };
}

/** Keyword router used when the local model is offline. */
export function routeByKeywords(q: string): { tool: ToolName; args: Record<string, unknown> } {
  const s = q.toLowerCase();
  const n = s.match(/(?:above|over|more than|greater than)\s*[₹$€]?\s*([\d,]+)/);
  if (n) return { tool: "expenses_above", args: { amount: Number(n[1]!.replace(/,/g, "")) } };
  if (/vendor|merchant|supplier|highest/.test(s)) return { tool: "top_vendors", args: {} };
  if (/categor/.test(s)) return { tool: "by_category", args: {} };
  if (/due|upcoming/.test(s)) return { tool: "upcoming_due", args: {} };
  if (/unpaid|outstanding/.test(s)) return { tool: "unpaid", args: {} };
  if (/last month/.test(s)) return { tool: "total_spend", args: monthRange(-1) };
  if (/this month/.test(s)) return { tool: "total_spend", args: monthRange(0) };
  return { tool: "total_spend", args: {} };
}

export interface Answer {
  text: string;
  tool: ToolName;
  args: Record<string, unknown>;
  result: ReturnType<(typeof TOOLS)[ToolName]["run"]>;
  usedModel: boolean;
}

export async function ask(question: string, docs: DocRecord[]): Promise<Answer> {
  const today = new Date().toISOString().slice(0, 10);
  let choice: { tool: ToolName; args: Record<string, unknown> };
  let usedModel = true;
  try {
    const raw = (await chatJSON(
      `Today is ${today}. Pick ONE tool to answer the user's question about their expenses. Reply JSON {"tool": name, "args": {...}}.\nTools:\n${Object.entries(TOOLS)
        .map(([k, v]) => `- ${k}: ${v.desc}`)
        .join("\n")}`,
      question.slice(0, 500),
    )) as { tool?: string; args?: Record<string, unknown> };
    if (!raw.tool || !(raw.tool in TOOLS)) throw new LocalModelError("bad tool");
    choice = { tool: raw.tool as ToolName, args: raw.args ?? {} };
  } catch {
    choice = routeByKeywords(question);
    usedModel = false;
  }
  const spec = TOOLS[choice.tool];
  const parsed = spec.args.safeParse(choice.args);
  const args = parsed.success ? parsed.data : routeByKeywords(question).args;
  const result = (spec.run as (d: DocRecord[], a: unknown) => Answer["result"])(docs, args);

  let text = "";
  if (usedModel) {
    try {
      text = await chatText(
        "You explain expense query results. Use ONLY the numbers given — never compute new ones or invent data. Be brief (2-4 sentences). Mention if some records lack totals.",
        `Question: ${question}\nTool: ${choice.tool}\nResult: ${JSON.stringify(result.summary)}`,
      );
    } catch {
      usedModel = false;
    }
  }
  if (!text) text = describe(choice.tool, result.summary as Record<string, unknown>);
  return { text, tool: choice.tool, args: args as Record<string, unknown>, result, usedModel };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function describe(tool: ToolName, s: any) {
  const f = (n: unknown) => Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  switch (tool) {
    case "total_spend":
      return `Recorded spend${s.from ? ` from ${s.from} to ${s.to}` : ""}: ${f(s.total)} across ${s.count} records${Number(s.missingTotals) ? ` (${s.missingTotals} without a total)` : ""}.`;
    case "top_vendors": {
      const v = s.vendors as { name: string; total: number }[];
      return v.length ? `Top vendor is ${v[0].name} with ${f(v[0].total)} recorded.` : "No saved records yet.";
    }
    case "expenses_above":
      return `${s.count} records above ${f(s.amount)}, totalling ${f(s.total)}.`;
    case "by_category":
      return `Spending across ${(s.categories as unknown[]).length} categories is shown below.`;
    case "upcoming_due":
      return `${s.count} invoices due in the next ${s.days} days, totalling ${f(s.total)}.`;
    case "unpaid":
      return `${s.count} invoices are marked unpaid, totalling ${f(s.total)}.`;
  }
}
