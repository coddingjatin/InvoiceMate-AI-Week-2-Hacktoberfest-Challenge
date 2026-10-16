export interface Settings {
  ollamaUrl: string;
  model: string;
  timeoutMs: number;
  maxUploadMb: number;
  defaultCurrency: string;
}

export const DEFAULT_SETTINGS: Settings = {
  ollamaUrl: "http://localhost:11434",
  model: "qwen2.5:3b-instruct",
  timeoutMs: 90000,
  maxUploadMb: 10,
  defaultCurrency: "INR",
};

const KEY = "invoicemate.settings";

export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
export function saveSettings(s: Settings) {
  localStorage.setItem(KEY, JSON.stringify(s));
}
