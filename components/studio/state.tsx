// Studio state shared by the 4 steps, the top bar and the settings drawer.
"use client";

import { createContext, useContext } from "react";
import type { Analysis, Concept, LlmId } from "@/lib/analysis";
import type { Hardware, Recommendation } from "@/lib/hardware";
import type { StyleProfile } from "@/lib/image";
import type { LocalService, LocalState } from "@/lib/local";
import type { Settings } from "@/lib/settings";
import type { Video } from "@/lib/types";

export type Ref = Video & { blob: Blob; bitmap: ImageBitmap; url: string; on: boolean };

export type Result = { key: string; status: "pending" | "done" | "error"; url?: string; blob?: Blob; error?: string };

export type SettingsTab = "local" | "keys" | "hardware" | "prefs";

export type Studio = {
  step: number;
  setStep: (n: number) => void;
  maxStep: number;

  settings: Settings;
  saveSettings: (s: Settings) => void;
  local: LocalState;
  checkLocal: (only?: LocalService) => Promise<void>;
  openSettings: (tab?: SettingsTab) => void;
  hardware: Hardware | null;
  rec: Recommendation | null;
  recheckHardware: () => void;

  quota: boolean;
  setQuota: (q: boolean) => void;

  channel: { name: string; scanned: number; handle: string } | null;
  setChannel: (c: Studio["channel"]) => void;
  refs: Ref[];
  setRefs: (r: Ref[] | ((prev: Ref[]) => Ref[])) => void;
  selected: Ref[];
  profile: StyleProfile | null;

  myVideo: string;
  setMyVideo: (t: string) => void;
  content: { blob: Blob; url: string } | null;
  setContent: (c: Studio["content"]) => void;
  llm: LlmId;
  setLlm: (l: LlmId) => void;

  analysis: Analysis | null;
  setAnalysis: (a: Analysis | null) => void;
  concepts: Concept[];
  setConcepts: (c: Concept[]) => void;
  picked: number;
  setPicked: (i: number) => void;

  results: Result[];
  setResults: (r: Result[] | ((prev: Result[]) => Result[])) => void;
  compareUrl: string | null;
  setCompareUrl: (u: string | null) => void;
};

export const StudioContext = createContext<Studio | null>(null);

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio outside StudioContext");
  return ctx;
}
