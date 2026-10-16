import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteAll, listDocs } from "@/lib/db";
import { toRow } from "@/lib/filters";
import { download } from "@/lib/format";
import { meta } from "@/lib/meta";
import { listModels } from "@/lib/ollama";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from "@/lib/settings";

export const Route = createFileRoute("/settings")({
  head: () => meta("Settings & model status", "Configure your local Ollama model, upload limits, and manage your on-device data."),
  component: SettingsPage,
});

function SettingsPage() {
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<string>("Not checked");
  useEffect(() => setS(loadSettings()), []);
  const check = async () => {
    setStatus("Checking…");
    try {
      const models = await listModels();
      setStatus(models.includes(s.model) ? `Connected · model "${s.model}" is installed` : `Connected, but "${s.model}" is missing. Run: ollama pull ${s.model}. Installed: ${models.join(", ") || "none"}`);
    } catch (e) {
      setStatus((e as Error).message);
    }
  };
  const field = (k: keyof Settings, label: string, type = "text") => (
    <div className="space-y-1.5"><Label htmlFor={k}>{label}</Label><Input id={k} type={type} value={String(s[k])} onChange={(e) => setS({ ...s, [k]: type === "number" ? Number(e.target.value) : e.target.value })} /></div>
  );
  return (
    <>
      <PageHeader title="Settings" subtitle="Everything runs on your device. No cloud AI is ever used." />
      <Panel>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("ollamaUrl", "Ollama URL")}
          {field("model", "Model")}
          {field("timeoutMs", "Model timeout (ms)", "number")}
          {field("maxUploadMb", "Max upload size (MB)", "number")}
          {field("defaultCurrency", "Default currency")}
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={() => { saveSettings(s); toast.success("Settings saved"); }}>Save</Button>
          <Button variant="outline" onClick={check}>Check local model</Button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Status: {status}</p>
      </Panel>
      <Panel className="mt-4 text-sm">
        <h3 className="text-lg">Setup</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>Install Ollama, then run <code>ollama pull {s.model}</code> (one-time download).</li>
          <li>Allow this site to reach it: start Ollama with <code>OLLAMA_ORIGINS=*</code> (or this site's address).</li>
          <li>After setup, reading, extraction and the assistant work offline.</li>
        </ol>
      </Panel>
      <Panel className="mt-4 text-sm">
        <h3 className="text-lg">Your data</h3>
        <p className="mt-2 text-muted-foreground">Documents are stored in this browser on this device. Their safety also depends on your device and its protections.</p>
        <div className="mt-3 flex gap-2">
          <Button variant="outline" onClick={async () => download("invoicemate-export.json", JSON.stringify((await listDocs()).map(toRow), null, 2), "application/json")}>Export all</Button>
          <Button variant="destructive" onClick={async () => { if (confirm("Delete ALL documents and records?")) { await deleteAll(); toast.success("All data deleted"); } }}>Delete all data</Button>
        </div>
      </Panel>
    </>
  );
}
