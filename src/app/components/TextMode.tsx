import { Copy, Download, LoaderCircle, Play, Save, Trash2 } from "lucide-react";
import type { ChangeEvent, RefObject } from "react";

interface TextModeProps {
  contentRef: RefObject<HTMLElement | null>;
  isDesktop: boolean;
  onClearInput: () => void;
  onConvertText: () => void;
  onCopyText: () => void;
  onSaveText: () => void;
  onTextInputChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onTextOutputChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  textBusy: boolean;
  textInput: string;
  textOutput: string;
}

export function TextMode({
  contentRef,
  isDesktop,
  onClearInput,
  onConvertText,
  onCopyText,
  onSaveText,
  onTextInputChange,
  onTextOutputChange,
  textBusy,
  textInput,
  textOutput,
}: TextModeProps) {
  return (
    <section ref={contentRef} className="tool-grid mode-surface">
      <div className="glass-panel input-panel motion-card">
        <div className="panel-head">
          <h2>Input</h2>
          <button className="icon-button" type="button" title="Clear" aria-label="Clear" onClick={onClearInput}>
            <Trash2 size={16} />
          </button>
        </div>
        <textarea className="editor" value={textInput} onChange={onTextInputChange} spellCheck={false} />
        <div className="action-row">
          <button className="primary-button" type="button" onClick={onConvertText} disabled={textBusy || !textInput.trim()}>
            {textBusy ? <LoaderCircle size={16} className="spin" /> : <Play size={16} />}
            <span>Convert</span>
          </button>
        </div>
      </div>

      <div className="glass-panel output-panel motion-card">
        <div className="panel-head">
          <h2>Markdown</h2>
          <div className="compact-actions">
            <button className="icon-button" type="button" title="Copy" aria-label="Copy" onClick={onCopyText} disabled={!textOutput}>
              <Copy size={16} />
            </button>
            <button className="icon-button" type="button" title={isDesktop ? "Save" : "Download"} aria-label={isDesktop ? "Save" : "Download"} onClick={onSaveText} disabled={!textOutput}>
              {isDesktop ? <Save size={16} /> : <Download size={16} />}
            </button>
          </div>
        </div>
        <textarea className="editor output-editor" value={textOutput} onChange={onTextOutputChange} spellCheck={false} />
      </div>
    </section>
  );
}
