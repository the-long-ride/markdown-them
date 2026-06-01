import { CloudOff, MonitorCheck, ShieldCheck } from "lucide-react";
import { TrustBadge } from "./TrustBadge";

export function TrustStrip({ isDesktop }: { isDesktop: boolean }) {
  return (
    <section className="trust-strip" aria-label="Privacy and project links">
      <TrustBadge icon={ShieldCheck} title="Privacy-first" detail="No account, no file tracking" />
      <TrustBadge
        icon={MonitorCheck}
        title={isDesktop ? "100% local processing" : "100% client-side conversion"}
        detail={isDesktop ? "Runs on this computer" : "Runs inside your browser"}
      />
      <TrustBadge icon={CloudOff} title="No document uploads" detail="Files never leave your device" />
    </section>
  );
}
