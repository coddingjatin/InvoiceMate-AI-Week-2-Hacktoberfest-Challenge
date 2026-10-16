import { loadSettings } from "./settings";

/** Talks ONLY to the user-configured local Ollama server. No cloud fallback exists. */
export class LocalModelError extends Error {}

async function call(path: string, init?: RequestInit, timeout?: number) {
  const s = loadSettings();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout ?? s.timeoutMs);
  try {
    const res = await fetch(s.ollamaUrl.replace(/\/$/, "") + path, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new LocalModelError(`Local model server replied ${res.status}`);
    return await res.json();
  } catch (e) {
    if (e instanceof LocalModelError) throw e;
    if ((e as Error).name === "AbortError") throw new LocalModelError("Local model timed out");
    throw new LocalModelError("Can't reach Ollama. Is it running and allowed for this origin?");
  } finally {
    clearTimeout(t);
  }
}

export async function listModels(): Promise<string[]> {
  const j = await call("/api/tags", undefined, 4000);
  return (j.models ?? []).map((m: { name: string }) => m.name);
}

export async function chatJSON(system: string, user: string): Promise<unknown> {
  const s = loadSettings();
  const j = await call("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: s.model,
      stream: false,
      format: "json",
      options: { temperature: 0 },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  try {
    return JSON.parse(j.message?.content ?? "{}");
  } catch {
    throw new LocalModelError("Model returned invalid JSON");
  }
}

export async function chatText(system: string, user: string): Promise<string> {
  const s = loadSettings();
  const j = await call("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: s.model,
      stream: false,
      options: { temperature: 0.2 },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  return String(j.message?.content ?? "").trim();
}
