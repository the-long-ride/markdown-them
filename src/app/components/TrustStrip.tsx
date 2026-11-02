import { CloudOff, Code2, MonitorCheck, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { TrustBadge } from './TrustBadge';

export function TrustStrip({ isDesktop }: { isDesktop: boolean }) {
  const { t } = useLanguage();

  return (
    <section className="trust-strip" aria-label="Privacy and project links">
      <TrustBadge icon={ShieldCheck} title={t('privacyFirst')} detail={t('privacyFirstDetail')} />
      <TrustBadge
        icon={MonitorCheck}
        title={isDesktop ? t('localProcessingDesktop') : t('localProcessingBrowser')}
        detail={isDesktop ? t('localProcessingDesktopDetail') : t('localProcessingBrowserDetail')}
      />
      <TrustBadge icon={CloudOff} title={t('noUploads')} detail={t('noUploadsDetail')} />
      <TrustBadge
        icon={Code2}
        title={t('freeAndOpenSource')}
        detail={t('freeAndOpenSourceDetail')}
      />
    </section>
  );
}
