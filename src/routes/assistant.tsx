import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Send } from "lucide-react";
import { useState } from "react";
import { PageHeader, Panel } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDocs } from "@/hooks/use-docs";
import { meta } from "@/lib/meta";
import { ask, type Answer } from "@/lib/queries";

export const Route = createFileRoute("/assistant")({
  head: () => meta("Expense assistant", "Ask questions about your saved expenses, answered from on-device records."),
  component: Assistant,
});

const EXAMPLES = ["How much did I spend this month?", "Which vendor received the highest total payment?", "Show my expenses above ₹5,000", "Summarize my expenses by category", "Which invoices have upcoming due dates?"];

function Assistant() {
  const docs = useDocs();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<{ q: string; a: Answer }[]>([]);
  const run = async (question: string) => {
    if (!question.trim() || !docs) return;
    setBusy(true);
    setQ("");
    const a = await ask(question, docs);
    setLog((l) => [...l, { q: question, a }]);
    setBusy(false);
  };
  return (
    <>
      <PageHeader title="Assistant" subtitle="Numbers are calculated from saved records; the local model only picks a query and explains it." />
      <div className="mb-4 flex flex-wrap gap-2">
        {EXAMPLES.map((e) => <Button key={e} variant="outline" size="sm" onClick={() => run(e)}>{e}</Button>)}
      </div>
      <div className="space-y-4">
        {log.map(({ q, a }, i) => (
          <Panel key={i}>
            <div className="text-sm font-semibold">{q}</div>
            <p className="mt-2 text-sm">{a.text}</p>
            <div className="mt-2 text-xs text-muted-foreground">Query: {a.tool} · {a.usedModel ? "explained by local model" : "local model offline — keyword match"}</div>
            {a.result.rows.length > 0 && (
              <ul className="mt-3 divide-y divide-border text-sm">
                {a.result.rows.slice(0, 10).map((r, j) => <li key={j} className="flex justify-between py-1.5"><span>{r.vendor} · {r.date ?? "no date"}</span><span className="tabular">{r.currency} {r.total.toFixed(2)}</span></li>)}
              </ul>
            )}
          </Panel>
        ))}
      </div>
      <form className="mt-6 flex gap-2" onSubmit={(e) => { e.preventDefault(); run(q); }}>
        <Input aria-label="Question" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about your expenses…" />
        <Button type="submit" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
      </form>
    </>
  );
}
