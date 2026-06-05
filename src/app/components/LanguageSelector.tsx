import { useEffect, useRef, useState } from "react";
import { Globe } from "lucide-react";
import { languages, useLanguage } from "../context/LanguageContext";

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="language-selector-container" ref={dropdownRef}>
      <button
        className="icon-button language-toggle"
        type="button"
        title="Select Language"
        aria-label="Select Language"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <Globe size={16} />
      </button>

      {isOpen && (
        <div className="language-dropdown">
          {languages.map((lang) => (
            <button
              key={lang.code}
              className={language === lang.code ? "active" : ""}
              type="button"
              onClick={() => {
                setLanguage(lang.code);
                setIsOpen(false);
              }}
            >
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
