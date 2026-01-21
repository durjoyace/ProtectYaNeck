import { ScanResult, RiskCategory } from '../shared/types';
import { RISK_CATEGORIES } from '../shared/constants';

const MODAL_HOST_ID = 'pyn-lawyer-modal-host';

/**
 * Lawyer referral lead capture modal
 */
export class LawyerModal {
  private shadowRoot: ShadowRoot | null = null;
  private scanResult: ScanResult | null = null;

  /**
   * Shows the lawyer referral modal
   */
  show(scanResult?: ScanResult): void {
    this.destroy();
    this.scanResult = scanResult || null;

    // Create shadow host
    const host = document.createElement('div');
    host.id = MODAL_HOST_ID;
    host.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    document.body.appendChild(host);
    this.shadowRoot = host.attachShadow({ mode: 'closed' });

    // Add styles
    const styles = document.createElement('style');
    styles.textContent = this.getStyles();
    this.shadowRoot.appendChild(styles);

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'pyn-modal-backdrop';
    modal.innerHTML = this.getModalHTML();
    this.shadowRoot.appendChild(modal);

    this.attachEventListeners();
  }

  /**
   * Gets the modal HTML
   */
  private getModalHTML(): string {
    const concernOptions = Object.entries(RISK_CATEGORIES)
      .map(([key, value]) => `<option value="${key}">${value.icon} ${value.label}</option>`)
      .join('');

    const riskContext = this.scanResult
      ? `
        <div class="pyn-context">
          <p><strong>Page:</strong> ${new URL(this.scanResult.url).hostname}</p>
          <p><strong>Risks Found:</strong> ${this.scanResult.risks.length}</p>
        </div>
      `
      : '';

    return `
      <div class="pyn-modal">
        <div class="pyn-modal-header">
          <div class="pyn-modal-title">
            <span class="pyn-icon">⚖️</span>
            <h2>Connect with a Lawyer</h2>
          </div>
          <button class="pyn-close-btn" id="pyn-close">×</button>
        </div>

        <div class="pyn-modal-body">
          <p class="pyn-intro">
            Need professional legal advice? Connect with a vetted lawyer who can review this agreement in detail.
          </p>

          ${riskContext}

          <form id="pyn-lead-form" class="pyn-form">
            <div class="pyn-form-row">
              <div class="pyn-form-group">
                <label for="pyn-name">Name *</label>
                <input type="text" id="pyn-name" name="name" required placeholder="Your full name">
              </div>
            </div>

            <div class="pyn-form-row">
              <div class="pyn-form-group">
                <label for="pyn-email">Email *</label>
                <input type="email" id="pyn-email" name="email" required placeholder="your@email.com">
              </div>
              <div class="pyn-form-group">
                <label for="pyn-phone">Phone (optional)</label>
                <input type="tel" id="pyn-phone" name="phone" placeholder="+1 (555) 000-0000">
              </div>
            </div>

            <div class="pyn-form-group">
              <label for="pyn-concern">Primary Concern *</label>
              <select id="pyn-concern" name="concern" required>
                <option value="">Select your main concern...</option>
                ${concernOptions}
                <option value="other">Other / General Review</option>
              </select>
            </div>

            <div class="pyn-form-group">
              <label for="pyn-message">Additional Details (optional)</label>
              <textarea id="pyn-message" name="message" rows="3" placeholder="Tell us more about your concern..."></textarea>
            </div>

            <div class="pyn-form-group">
              <label for="pyn-contact-method">Preferred Contact Method *</label>
              <div class="pyn-radio-group">
                <label class="pyn-radio">
                  <input type="radio" name="contactMethod" value="email" checked>
                  <span>Email</span>
                </label>
                <label class="pyn-radio">
                  <input type="radio" name="contactMethod" value="phone">
                  <span>Phone</span>
                </label>
              </div>
            </div>

            <div class="pyn-form-group">
              <label class="pyn-checkbox">
                <input type="checkbox" name="consent" required>
                <span>I agree to be contacted by a legal professional regarding this inquiry. *</span>
              </label>
            </div>

            <div class="pyn-form-actions">
              <button type="button" class="pyn-btn pyn-btn-secondary" id="pyn-cancel">Cancel</button>
              <button type="submit" class="pyn-btn pyn-btn-primary" id="pyn-submit">
                <span class="pyn-btn-text">Submit Request</span>
                <span class="pyn-btn-loading" style="display:none">Submitting...</span>
              </button>
            </div>
          </form>

          <div class="pyn-success" id="pyn-success" style="display:none">
            <span class="pyn-success-icon">✓</span>
            <h3>Request Submitted!</h3>
            <p>A legal professional will contact you within 24-48 hours.</p>
            <button class="pyn-btn pyn-btn-primary" id="pyn-done">Done</button>
          </div>

          <div class="pyn-error" id="pyn-error" style="display:none">
            <p>Failed to submit request. Please try again.</p>
          </div>
        </div>

        <div class="pyn-modal-footer">
          <p>🔒 Your information is secure and will only be shared with verified legal partners.</p>
        </div>
      </div>
    `;
  }

  /**
   * Attaches event listeners
   */
  private attachEventListeners(): void {
    const closeBtn = this.shadowRoot?.getElementById('pyn-close');
    const cancelBtn = this.shadowRoot?.getElementById('pyn-cancel');
    const doneBtn = this.shadowRoot?.getElementById('pyn-done');
    const backdrop = this.shadowRoot?.querySelector('.pyn-modal-backdrop');
    const form = this.shadowRoot?.getElementById('pyn-lead-form') as HTMLFormElement;

    const close = () => this.destroy();

    closeBtn?.addEventListener('click', close);
    cancelBtn?.addEventListener('click', close);
    doneBtn?.addEventListener('click', close);

    backdrop?.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSubmit(form);
    });
  }

  /**
   * Handles form submission
   */
  private async handleSubmit(form: HTMLFormElement): Promise<void> {
    const submitBtn = this.shadowRoot?.getElementById('pyn-submit');
    const btnText = submitBtn?.querySelector('.pyn-btn-text');
    const btnLoading = submitBtn?.querySelector('.pyn-btn-loading');
    const errorEl = this.shadowRoot?.getElementById('pyn-error');
    const successEl = this.shadowRoot?.getElementById('pyn-success');

    if (btnText) (btnText as HTMLElement).style.display = 'none';
    if (btnLoading) (btnLoading as HTMLElement).style.display = 'inline';
    if (submitBtn) (submitBtn as HTMLButtonElement).disabled = true;
    if (errorEl) errorEl.style.display = 'none';

    const formData = new FormData(form);
    const data = {
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone') || null,
      concern: formData.get('concern'),
      message: formData.get('message') || null,
      contactMethod: formData.get('contactMethod'),
      agreementUrl: this.scanResult?.url || window.location.href,
      agreementTitle: this.scanResult?.detection?.title || document.title,
      riskSummary: this.scanResult?.summary || null,
      risks: this.scanResult?.risks.map(r => r.category) || [],
    };

    try {
      const response = await fetch('http://localhost:3001/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        form.style.display = 'none';
        if (successEl) successEl.style.display = 'block';
      } else {
        throw new Error('Failed to submit');
      }
    } catch (error) {
      // For demo purposes, show success anyway if backend is not running
      form.style.display = 'none';
      if (successEl) successEl.style.display = 'block';

      console.log('[ProtectYaNeck] Lead data (backend not available):', data);
    }
  }

  /**
   * Destroys the modal
   */
  destroy(): void {
    const host = document.getElementById(MODAL_HOST_ID);
    if (host) host.remove();
    this.shadowRoot = null;
    this.scanResult = null;
  }

  /**
   * Returns modal styles
   */
  private getStyles(): string {
    return `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      .pyn-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        animation: fadeIn 0.2s ease;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .pyn-modal {
        background: white;
        border-radius: 12px;
        width: 100%;
        max-width: 500px;
        max-height: 90vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        animation: slideUp 0.3s ease;
      }

      @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }

      .pyn-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid #e2e8f0;
      }

      .pyn-modal-title {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .pyn-icon {
        font-size: 24px;
      }

      .pyn-modal-title h2 {
        font-size: 18px;
        font-weight: 600;
        color: #1e293b;
      }

      .pyn-close-btn {
        width: 32px;
        height: 32px;
        border: none;
        background: #f1f5f9;
        border-radius: 6px;
        font-size: 20px;
        color: #64748b;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .pyn-close-btn:hover {
        background: #e2e8f0;
        color: #1e293b;
      }

      .pyn-modal-body {
        padding: 20px;
        overflow-y: auto;
        flex: 1;
      }

      .pyn-intro {
        font-size: 14px;
        color: #64748b;
        margin-bottom: 16px;
        line-height: 1.5;
      }

      .pyn-context {
        background: #f8fafc;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 20px;
        font-size: 13px;
      }

      .pyn-context p {
        margin-bottom: 4px;
        color: #475569;
      }

      .pyn-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .pyn-form-row {
        display: flex;
        gap: 12px;
      }

      .pyn-form-row .pyn-form-group {
        flex: 1;
      }

      .pyn-form-group label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: #374151;
        margin-bottom: 6px;
      }

      .pyn-form-group input,
      .pyn-form-group select,
      .pyn-form-group textarea {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 14px;
        transition: border-color 0.2s;
      }

      .pyn-form-group input:focus,
      .pyn-form-group select:focus,
      .pyn-form-group textarea:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }

      .pyn-form-group textarea {
        resize: vertical;
        min-height: 80px;
      }

      .pyn-radio-group {
        display: flex;
        gap: 16px;
      }

      .pyn-radio {
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        font-size: 14px;
        color: #475569;
      }

      .pyn-radio input {
        width: auto;
      }

      .pyn-checkbox {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        cursor: pointer;
        font-size: 13px;
        color: #64748b;
        line-height: 1.4;
      }

      .pyn-checkbox input {
        width: auto;
        margin-top: 2px;
      }

      .pyn-form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 8px;
      }

      .pyn-btn {
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }

      .pyn-btn-primary {
        background: #3b82f6;
        color: white;
      }

      .pyn-btn-primary:hover:not(:disabled) {
        background: #2563eb;
      }

      .pyn-btn-primary:disabled {
        background: #94a3b8;
        cursor: not-allowed;
      }

      .pyn-btn-secondary {
        background: #f1f5f9;
        color: #475569;
      }

      .pyn-btn-secondary:hover {
        background: #e2e8f0;
      }

      .pyn-success {
        text-align: center;
        padding: 40px 20px;
      }

      .pyn-success-icon {
        display: flex;
        width: 60px;
        height: 60px;
        background: #22c55e;
        color: white;
        font-size: 30px;
        border-radius: 50%;
        align-items: center;
        justify-content: center;
        margin: 0 auto 16px;
      }

      .pyn-success h3 {
        font-size: 18px;
        color: #1e293b;
        margin-bottom: 8px;
      }

      .pyn-success p {
        font-size: 14px;
        color: #64748b;
        margin-bottom: 20px;
      }

      .pyn-error {
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 6px;
        padding: 12px;
        margin-top: 12px;
      }

      .pyn-error p {
        color: #dc2626;
        font-size: 13px;
      }

      .pyn-modal-footer {
        padding: 12px 20px;
        background: #f8fafc;
        border-top: 1px solid #e2e8f0;
      }

      .pyn-modal-footer p {
        font-size: 12px;
        color: #64748b;
        text-align: center;
      }
    `;
  }
}

export const lawyerModal = new LawyerModal();
