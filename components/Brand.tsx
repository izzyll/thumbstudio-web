import { Play } from "lucide-react";
import Link from "next/link";

export function Brand({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className={`flex items-center justify-center rounded-[5px] bg-accent ${size === "sm" ? "h-[18px] w-[26px]" : "h-5 w-7"}`}>
        <Play className="size-3 fill-white text-white" />
      </span>
      <span className={`font-display tracking-wide ${size === "sm" ? "text-[19px]" : "text-[22px]"}`}>THUMBSTUDIO</span>
    </Link>
  );
}
