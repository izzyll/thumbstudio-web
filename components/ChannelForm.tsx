"use client";

import { ArrowRight, AtSign } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Landing CTA: sends the visitor to the studio with the channel already filled in. */
export function ChannelForm({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [channel, setChannel] = useState("");
  return (
    <form
      className={`flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-1.5 sm:flex-row sm:items-center ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        const c = channel.trim();
        router.push(c ? `/studio?c=${encodeURIComponent(c)}` : "/studio");
      }}
    >
      <label className="flex h-12 flex-1 items-center gap-2.5 px-3.5">
        <AtSign className="size-[18px] shrink-0 text-subtle" />
        <input
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          placeholder="canal o URL de YouTube"
          aria-label="Canal de YouTube"
          className="w-full bg-transparent text-base outline-none placeholder:text-subtle"
        />
      </label>
      <button className="flex h-12 items-center justify-center gap-2 rounded-lg bg-accent px-5 text-[15px] font-semibold text-white transition-colors hover:bg-accent-hover">
        Analizar canal <ArrowRight className="size-[18px]" />
      </button>
    </form>
  );
}
