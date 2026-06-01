import type { LucideIcon } from "lucide-react";

export function TrustBadge({ detail, icon: Icon, title }: { detail: string; icon: LucideIcon; title: string }) {
  return (
    <div className="trust-badge">
      <span className="trust-icon" aria-hidden="true">
        <Icon size={17} />
      </span>
      <span className="trust-copy">
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
    </div>
  );
}
