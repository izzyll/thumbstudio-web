// Small shared pieces of the studio UI.
import { Loader2 } from "lucide-react";

export function Button({
  children, onClick, disabled, busy, variant = "primary", className = "", type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  type?: "button" | "submit";
}) {
  const styles = {
    primary: "h-12 bg-accent px-5 text-[15px] font-semibold text-white hover:bg-accent-hover",
    secondary: "h-11 border border-border bg-surface-2 px-4 text-sm font-semibold hover:bg-border",
    ghost: "h-9 border border-border px-3 text-[13px] text-muted hover:text-text",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      className={`flex items-center justify-center gap-2 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    >
      {busy && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function StatusDot({ state }: { state: "ok" | "warn" | "off" }) {
  const color = { ok: "bg-success", warn: "bg-warning", off: "bg-subtle" }[state];
  return <span className={`inline-block size-[7px] shrink-0 rounded-full ${color}`} />;
}

export function ErrorNote({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-[10px] border border-accent/30 bg-accent/[0.07] px-4 py-3 text-sm">
      <p className="leading-normal">{children}</p>
      {action}
    </div>
  );
}

export function Radio({ on }: { on: boolean }) {
  return <span className={`size-[18px] shrink-0 rounded-full ${on ? "border-[5px] border-accent" : "border-[1.5px] border-subtle"}`} />;
}
