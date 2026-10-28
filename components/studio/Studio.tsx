"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Analysis, Concept, LlmId } from "@/lib/analysis";
import { detectHardware, type Hardware, recommend } from "@/lib/hardware";
import { styleProfile } from "@/lib/image";
import { useLocalStatus } from "@/lib/local";
import { DEFAULTS, loadSettings, saveSettings as persist, type Settings } from "@/lib/settings";
import { AnalysisStep } from "./AnalysisStep";
import { ChannelStep } from "./ChannelStep";
import { GenerateStep } from "./GenerateStep";
import { SettingsDrawer } from "./SettingsDrawer";
import { type Ref, type Result, type SettingsTab, type Studio as StudioState, StudioContext } from "./state";
import { QuotaBanner, TopBar } from "./TopBar";
import { VideoStep } from "./VideoStep";

export function Studio() {
  const initialChannel = useSearchParams().get("c") ?? "";
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  useEffect(() => {
    // localStorage is only readable after mount (the page is statically exported).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(loadSettings());
  }, []);
  const saveSettings = useCallback((s: Settings) => {
    setSettings(s);
    persist(s);
  }, []);
  const { state: local, check: checkLocal } = useLocalStatus(settings);

  // Re-run when ComfyUI connects: its /system_stats gives the exact VRAM instead of an estimate.
  const [hardware, setHardware] = useState<Hardware | null>(null);
  const [hwRun, setHwRun] = useState(0);
  useEffect(() => {
    let live = true;
    void detectHardware(settings).then((h) => live && setHardware(h));
    return () => { live = false; };
  }, [settings, local.comfyui, hwRun]);
  const rec = useMemo(() => (hardware ? recommend(hardware) : null), [hardware]);

  const [step, setStep] = useState(0);
  const [drawer, setDrawer] = useState<SettingsTab | null>(null);
  const [quota, setQuota] = useState(false);
  const [channel, setChannel] = useState<StudioState["channel"]>(null);
  const [refs, setRefs] = useState<Ref[]>([]);
  const [myVideo, setMyVideo] = useState("");
  const [content, setContent] = useState<StudioState["content"]>(null);
  const [llm, setLlm] = useState<LlmId>("ollama");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [picked, setPicked] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [compareUrl, setCompareUrl] = useState<string | null>(null);

  useEffect(() => {
    // Default analysis model: the saved preference.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLlm(settings.analysisLlm as LlmId);
  }, [settings.analysisLlm]);

  const selected = useMemo(() => refs.filter((r) => r.on), [refs]);
  const profile = useMemo(() => styleProfile(selected.map((r) => r.bitmap)), [selected]);
  // The furthest step the visitor can jump to from the top bar.
  const maxStep = !selected.length ? 0 : !analysis ? 1 : 3;

  // A new channel invalidates everything after it.
  const setChannelAndReset = useCallback((c: StudioState["channel"]) => {
    setChannel(c);
    setAnalysis(null);
    setConcepts([]);
    setResults([]);
    setCompareUrl(null);
    setQuota(false);
  }, []);

  const ctx: StudioState = {
    step, setStep, maxStep,
    settings, saveSettings, local, checkLocal, openSettings: (tab = "keys") => setDrawer(tab),
    hardware, rec, recheckHardware: () => setHwRun((n) => n + 1),
    quota, setQuota,
    channel, setChannel: setChannelAndReset, refs, setRefs, selected, profile,
    myVideo, setMyVideo, content, setContent, llm, setLlm,
    analysis, setAnalysis, concepts, setConcepts, picked, setPicked,
    results, setResults, compareUrl, setCompareUrl,
  };

  return (
    <StudioContext.Provider value={ctx}>
      <div className="flex h-dvh flex-col">
        <TopBar />
        {quota && <QuotaBanner />}
        {step === 0 && <ChannelStep initial={initialChannel} />}
        {step === 1 && <VideoStep />}
        {step === 2 && <AnalysisStep />}
        {step === 3 && <GenerateStep />}
      </div>
      {drawer && <SettingsDrawer tab={drawer} onClose={() => setDrawer(null)} />}
    </StudioContext.Provider>
  );
}
