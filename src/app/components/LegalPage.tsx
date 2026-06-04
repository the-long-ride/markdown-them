import { ArrowLeft, ShieldCheck, Sun, Moon } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { ThemeMode } from "../app-types";

interface LegalPageProps {
  view: "privacy" | "terms";
  onBack: () => void;
  theme: ThemeMode;
  setTheme: Dispatch<SetStateAction<ThemeMode>>;
  isDesktop: boolean;
}

export function LegalPage({ view, onBack, theme, setTheme, isDesktop }: LegalPageProps) {
  const isPrivacy = view === "privacy";

  return (
    <div className="legal-container">
      <header className="legal-header">
        <div className="legal-header-left">
          <button
            className="secondary-button legal-back-button"
            type="button"
            onClick={onBack}
            aria-label="Back to converter"
          >
            <ArrowLeft size={16} />
            <span>Back to converter</span>
          </button>
        </div>

        <button
          className="icon-button theme-toggle"
          type="button"
          title={theme === "dark" ? "Use light mode" : "Use dark mode"}
          aria-label={theme === "dark" ? "Use light mode" : "Use dark mode"}
          onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </header>

      <article className="legal-card">
        {isPrivacy ? (
          <>
            <div className="legal-title-section">
              <h1>Privacy Policy</h1>
              <div className="legal-meta">Last Updated: June 2026</div>
            </div>

            <div className="legal-notice-box">
              <ShieldCheck className="legal-notice-icon" size={24} />
              <div className="legal-notice-text">
                <h3>100% Client-Side & Local Processing</h3>
                <p>
                  Markdown Them is engineered to run entirely on your local device. 
                  We never upload your files, track your data, or transmit information to external servers.
                </p>
              </div>
            </div>

            <div className="legal-content">
              <section className="legal-section">
                <h2>1. Information We Collect</h2>
                <p>
                  We believe that your data is yours alone. Because of this:
                </p>
                <ul>
                  <li>
                    <strong>No File Collection:</strong> When you convert documents (DOCX, PDF, HTML, XLSX, PPTX, etc.) 
                    or text to Markdown, all processing is performed locally inside your web browser or local computer. 
                    Your files never leave your device.
                  </li>
                  <li>
                    <strong>No Personal Data:</strong> We do not require account creation, registration, or sign-up. 
                    We do not collect names, email addresses, or any other identifying information.
                  </li>
                  <li>
                    <strong>No Telemetry or Tracking:</strong> The application does not contain tracking scripts, 
                    analytics tools, or cookies to track your behavior.
                  </li>
                </ul>
              </section>

              <section className="legal-section">
                <h2>2. Storage of Settings</h2>
                <p>
                  To provide a seamless experience, we store user preferences (such as your preferred color theme) 
                  locally in your browser's <code>localStorage</code>. This data remains on your machine and is never 
                  synchronized with any external service. You can clear this data at any time by clearing your 
                  browser's storage.
                </p>
              </section>

              <section className="legal-section">
                <h2>3. Third-Party Websites and Services</h2>
                <p>
                  Our application may link to external websites such as GitHub or npm. 
                  These external sites are not operated by us and have their own privacy policies. 
                  We advise you to review the privacy policy of any third-party websites you visit.
                </p>
              </section>

              <section className="legal-section">
                <h2>4. Changes to This Privacy Policy</h2>
                <p>
                  We may update our Privacy Policy from time to time. Any changes will be posted on this page with 
                  an updated revision date.
                </p>
              </section>

              <section className="legal-section">
                <h2>5. Contact Us</h2>
                <p>
                  If you have any questions or suggestions regarding our Privacy Policy, please feel free to reach 
                  out to us on our project repository.
                </p>
              </section>
            </div>
          </>
        ) : (
          <>
            <div className="legal-title-section">
              <h1>Terms of Service</h1>
              <div className="legal-meta">Last Updated: June 2026</div>
            </div>

            <div className="legal-notice-box">
              <ShieldCheck className="legal-notice-icon" size={24} />
              <div className="legal-notice-text">
                <h3>Open Source under the MIT License</h3>
                <p>
                  Markdown Them is completely open source. You are free to use, modify, 
                  and distribute this software in accordance with the MIT License terms.
                </p>
              </div>
            </div>

            <div className="legal-content">
              <section className="legal-section">
                <h2>1. Acceptance of Terms</h2>
                <p>
                  By accessing or using the Markdown Them web application or desktop application, 
                  you agree to be bound by these Terms of Service. If you do not agree to all of the terms and 
                  conditions, do not use the application.
                </p>
              </section>

              <section className="legal-section">
                <h2>2. License and Permitted Use</h2>
                <p>
                  Markdown Them is licensed under the terms of the MIT License. 
                  You are granted permission to:
                </p>
                <ul>
                  <li>Use the software for commercial or personal projects.</li>
                  <li>Modify, distribute, and sublicense copies of the software.</li>
                  <li>Include the software in other packages or distributions.</li>
                </ul>
                <p>
                  The only requirement is that the copyright notice and license notice must be included in 
                  all copies or substantial portions of the Software.
                </p>
              </section>

              <section className="legal-section">
                <h2>3. Local Processing Limitation</h2>
                <p>
                  Markdown Them is designed as a client-side converter tool. It is provided "as is", 
                  intended for offline/local use. You are solely responsible for ensuring the safety and 
                  integrity of the files you import into the converter.
                </p>
              </section>

              <section className="legal-section">
                <h2>4. Warranty Disclaimer</h2>
                <p>
                  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, 
                  INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR 
                  PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE 
                  FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR 
                  OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
                  DEALINGS IN THE SOFTWARE.
                </p>
              </section>

              <section className="legal-section">
                <h2>5. Changes to the Terms</h2>
                <p>
                  We reserve the right, at our sole discretion, to modify or replace these Terms at any time. 
                  It is your responsibility to check these Terms periodically for changes.
                </p>
              </section>
            </div>
          </>
        )}
      </article>

      <footer className="legal-footer">
        <button
          className="secondary-button"
          type="button"
          onClick={onBack}
        >
          <span>Return to Converter</span>
        </button>
      </footer>
    </div>
  );
}
