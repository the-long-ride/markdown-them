import { ArrowLeft, ShieldCheck, Sun, Moon } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { ThemeMode } from "../app-types";
import { useLanguage } from "../context/LanguageContext";
import { LanguageSelector } from "./LanguageSelector";

interface LegalPageProps {
  view: "privacy" | "terms";
  onBack: () => void;
  theme: ThemeMode;
  setTheme: Dispatch<SetStateAction<ThemeMode>>;
  isDesktop: boolean;
}

export function LegalPage({
  view,
  onBack,
  theme,
  setTheme,
  isDesktop,
}: LegalPageProps) {
  const isPrivacy = view === "privacy";
  const { t } = useLanguage();

  return (
    <div className="legal-container">
      <header className="legal-header">
        <div className="legal-header-left">
          <button
            className="secondary-button legal-back-button"
            type="button"
            onClick={onBack}
            aria-label={t("backToConverter")}
          >
            <ArrowLeft size={16} />
            <span>{t("backToConverter")}</span>
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <LanguageSelector />
          <button
            className="icon-button theme-toggle"
            type="button"
            title={theme === "dark" ? "Use light mode" : "Use dark mode"}
            aria-label={theme === "dark" ? "Use light mode" : "Use dark mode"}
            onClick={() =>
              setTheme((current) => (current === "dark" ? "light" : "dark"))
            }
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      <article className="legal-card">
        {isPrivacy ? (
          <>
            <div className="legal-title-section">
              <h1>{t("privacyPolicy")}</h1>
              <div className="legal-meta">{t("lastUpdated")}</div>
            </div>

            <div className="legal-notice-box">
              <ShieldCheck className="legal-notice-icon" size={24} />
              <div className="legal-notice-text">
                <h3>{t("privacyNoticeHeader")}</h3>
                <p>{t("privacyNoticeText")}</p>
              </div>
            </div>

            <div className="legal-content">
              <section className="legal-section">
                <h2>{t("privacySec1Title")}</h2>
                <p>{t("privacySec1Intro")}</p>
                <ul>
                  <li>
                    <strong>{t("noFileCollection")}:</strong> {t("noFileCollectionDetail")}
                  </li>
                  <li>
                    <strong>{t("noPersonalData")}:</strong> {t("noPersonalDataDetail")}
                  </li>
                  <li>
                    <strong>{t("noTelemetry")}:</strong> {t("noTelemetryDetail")}
                  </li>
                </ul>
              </section>

              <section className="legal-section">
                <h2>{t("privacySec2Title")}</h2>
                <p>{t("privacySec2Text")}</p>
              </section>

              <section className="legal-section">
                <h2>{t("privacySec3Title")}</h2>
                <p>{t("privacySec3Text")}</p>
              </section>

              <section className="legal-section">
                <h2>{t("privacySec4Title")}</h2>
                <p>{t("privacySec4Text")}</p>
              </section>

              <section className="legal-section">
                <h2>{t("privacySec5Title")}</h2>
                <p>{t("privacySec5Text")}</p>
              </section>
            </div>
          </>
        ) : (
          <>
            <div className="legal-title-section">
              <h1>{t("termsOfService")}</h1>
              <div className="legal-meta">{t("lastUpdated")}</div>
            </div>

            <div className="legal-notice-box">
              <ShieldCheck className="legal-notice-icon" size={24} />
              <div className="legal-notice-text">
                <h3>{t("termsNoticeHeader")}</h3>
                <p>{t("termsNoticeText")}</p>
              </div>
            </div>

            <div className="legal-content">
              <section className="legal-section">
                <h2>{t("termsSec1Title")}</h2>
                <p>{t("termsSec1Text")}</p>
              </section>

              <section className="legal-section">
                <h2>{t("termsSec2Title")}</h2>
                <p>{t("termsSec2Intro")}</p>
                <ul>
                  <li>{t("termsSec2Item1")}</li>
                  <li>{t("termsSec2Item2")}</li>
                  <li>{t("termsSec2Item3")}</li>
                </ul>
                <p>{t("termsSec2Outro")}</p>
              </section>

              <section className="legal-section">
                <h2>{t("termsSec3Title")}</h2>
                <p>{t("termsSec3Text")}</p>
              </section>

              <section className="legal-section">
                <h2>{t("termsSec4Title")}</h2>
                <p>{t("termsSec4Text")}</p>
              </section>

              <section className="legal-section">
                <h2>{t("termsSec5Title")}</h2>
                <p>{t("termsSec5Text")}</p>
              </section>
            </div>
          </>
        )}
      </article>

      <footer className="legal-footer">
        <button className="secondary-button" type="button" onClick={onBack}>
          <span>{t("returnToConverter")}</span>
        </button>
      </footer>
    </div>
  );
}
