import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader, Panel, StatusBadge } from "@/components/AppShell";
import { useDocs } from "@/hooks/use-docs";
import { ingest } from "@/lib/extract";
import { meta } from "@/lib/meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/upload")({
  head: () => meta("Upload documents", "Drop PDFs or photos of invoices and receipts. Read and extracted entirely on your device."),
  component: UploadPage,
});

function UploadPage() {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const docs = useDocs();
  const active = (docs ?? []).filter((d) => d.status === "processing" || Date.now() - d.createdAt < 10 * 60e3).slice(0, 10);

  const handle = async (files: FileList | null) => {
    for (const f of Array.from(files ?? [])) {
      try {
        await ingest(f);
        toast.success(`Processing ${f.name}`);
      } catch (e) {
        toast.error(`${f.name}: ${(e as Error).message}`);
      }
    }
  };

  return (
    <>
      <PageHeader title="Upload documents" subtitle="PDF, PNG or JPG. Text is read on this device; fields go to your local model only." />
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files); }}
        className={cn(
          "flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-card px-6 py-20 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          over ? "border-primary bg-accent" : "border-border hover:border-primary/50",
        )}
      >
        <UploadCloud className="h-10 w-10 text-primary" />
        <span className="mt-4 font-display text-2xl">Drop invoices here</span>
        <span className="mt-1 text-sm text-muted-foreground">or click to browse</span>
      </button>
      <input ref={input} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" className="hidden" onChange={(e) => { handle(e.target.files); e.target.value = ""; }} />
      <p className="mt-3 text-xs text-muted-foreground">The first scan downloads the text-reading language pack once; afterwards it works offline.</p>

      {active.length > 0 && (
        <Panel className="mt-8">
          <h3 className="text-lg">Processing queue</h3>
          <ul className="mt-3 divide-y divide-border">
            {active.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{d.fileName}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {d.status === "processing" && <Loader2 className="h-3 w-3 animate-spin" />}
                    {d.stage ?? d.error ?? (d.status === "review" ? "Ready for review" : "Saved")}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={d.status} />
                  {d.status !== "processing" && <Link to="/doc/$id" params={{ id: d.id }} className="text-sm font-medium text-primary hover:underline">Open</Link>}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
