import { ScanResult, RiskItem, RiskSeverity } from '../shared/types';
import { SEVERITY_COLORS, RISK_CATEGORIES } from '../shared/constants';

const OVERLAY_ID = 'pyn-overlay-root';
const SHADOW_HOST_ID = 'pyn-shadow-host';

/**
 * Creates and manages the overlay UI using Shadow DOM
 */
export class OverlayManager {
  private shadowRoot: ShadowRoot | null = null;
  private container: HTMLElement | null = null;
  private isMinimized = false;
  private onLawyerClick: (() => void) | null = null;

  /**
   * Initializes the overlay shadow DOM
   */
  init(): void {
    // Remove existing overlay if present
    this.destroy();

    // Create shadow host
    const host = document.createElement('div');
    host.id = SHADOW_HOST_ID;
    host.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    document.body.appendChild(host);

    // Create shadow root
    this.shadowRoot = host.attachShadow({ mode: 'closed' });

    // Add styles
    const styles = document.createElement('style');
    styles.textContent = this.getStyles();
    this.shadowRoot.appendChild(styles);

    // Create container
    this.container = document.createElement('div');
    this.container.id = OVERLAY_ID;
    this.shadowRoot.appendChild(this.container);
  }

  /**
   * Shows scanning indicator
   */
  showScanning(): void {
    if (!this.container) this.init();

    this.container!.innerHTML = `
      <div class="pyn-card pyn-scanning">
        <div class="pyn-header">
          <div class="pyn-logo">
            <span class="pyn-shield">🛡️</span>
            <span class="pyn-title">ProtectYaNeck</span>
          </div>
        </div>
        <div class="pyn-body">
          <div class="pyn-spinner"></div>
          <p class="pyn-status">Scanning agreement...</p>
        </div>
      </div>
    `;
  }

  /**
   * Shows scan results
   */
  showResults(result: ScanResult, scansRemaining: number, onLawyerClick?: () => void): void {
    if (!this.container) this.init();
    this.onLawyerClick = onLawyerClick || null;

    const severityColor = SEVERITY_COLORS[result.overallSeverity];
    const risksHtml = result.risks.map(risk => this.renderRiskItem(risk)).join('');

    this.container!.innerHTML = `
      <div class="pyn-card">
        <div class="pyn-header" style="border-left: 4px solid ${severityColor}">
          <div class="pyn-logo">
            <span class="pyn-shield">🛡️</span>
            <span class="pyn-title">ProtectYaNeck</span>
          </div>
          <div class="pyn-controls">
            <button class="pyn-btn-icon" id="pyn-minimize" title="Minimize">−</button>
            <button class="pyn-btn-icon" id="pyn-close" title="Close">×</button>
          </div>
        </div>

        <div class="pyn-body ${this.isMinimized ? 'pyn-hidden' : ''}">
          <div class="pyn-severity-badge pyn-severity-${result.overallSeverity}">
            ${result.overallSeverity.toUpperCase()} RISK
          </div>

          <p class="pyn-summary">${result.summary}</p>

          ${result.risks.length > 0 ? `
            <div class="pyn-risks">
              <h4>Detected Risks</h4>
              ${risksHtml}
            </div>
          ` : `
            <div class="pyn-no-risks">
              <span>✓</span> No significant risks detected
            </div>
          `}

          <div class="pyn-footer">
            <div class="pyn-scans-remaining">
              ${scansRemaining} free scan${scansRemaining !== 1 ? 's' : ''} remaining
            </div>
            <button class="pyn-btn pyn-btn-lawyer" id="pyn-lawyer">
              Need a lawyer?
            </button>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Shows no agreement detected message
   */
  showNoAgreement(): void {
    if (!this.container) this.init();

    this.container!.innerHTML = `
      <div class="pyn-card pyn-mini">
        <div class="pyn-header">
          <div class="pyn-logo">
            <span class="pyn-shield">🛡️</span>
            <span class="pyn-title">ProtectYaNeck</span>
          </div>
          <button class="pyn-btn-icon" id="pyn-close" title="Close">×</button>
        </div>
        <div class="pyn-body">
          <p class="pyn-status">No agreement detected on this page.</p>
        </div>
      </div>
    `;

    this.attachEventListeners();

    // Auto-hide after 3 seconds
    setTimeout(() => this.destroy(), 3000);
  }

  /**
   * Shows limit reached message
   */
  showLimitReached(): void {
    if (!this.container) this.init();

    this.container!.innerHTML = `
      <div class="pyn-card">
        <div class="pyn-header">
          <div class="pyn-logo">
            <span class="pyn-shield">🛡️</span>
            <span class="pyn-title">ProtectYaNeck</span>
          </div>
          <button class="pyn-btn-icon" id="pyn-close" title="Close">×</button>
        </div>
        <div class="pyn-body">
          <div class="pyn-limit-reached">
            <h4>Free Scan Limit Reached</h4>
            <p>You've used all 5 free scans this month.</p>
            <button class="pyn-btn pyn-btn-primary" id="pyn-upgrade">
              Upgrade for Unlimited Scans
            </button>
            <button class="pyn-btn pyn-btn-secondary" id="pyn-lawyer">
              Talk to a Lawyer Instead
            </button>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Renders a single risk item
   */
  private renderRiskItem(risk: RiskItem): string {
    const color = SEVERITY_COLORS[risk.severity];
    const meta = RISK_CATEGORIES[risk.category];

    return `
      <div class="pyn-risk-item" style="border-left: 3px solid ${color}">
        <div class="pyn-risk-header">
          <span class="pyn-risk-icon">${meta.icon}</span>
          <span class="pyn-risk-title">${risk.title}</span>
          <span class="pyn-risk-severity" style="background: ${color}">${risk.severity}</span>
        </div>
        <p class="pyn-risk-summary">${risk.summary}</p>
      </div>
    `;
  }

  /**
   * Attaches event listeners to overlay buttons
   */
  private attachEventListeners(): void {
    const closeBtn = this.shadowRoot?.getElementById('pyn-close');
    const minimizeBtn = this.shadowRoot?.getElementById('pyn-minimize');
    const lawyerBtn = this.shadowRoot?.getElementById('pyn-lawyer');
    const upgradeBtn = this.shadowRoot?.getElementById('pyn-upgrade');

    closeBtn?.addEventListener('click', () => this.destroy());

    minimizeBtn?.addEventListener('click', () => {
      this.isMinimized = !this.isMinimized;
      const body = this.shadowRoot?.querySelector('.pyn-body');
      body?.classList.toggle('pyn-hidden', this.isMinimized);
      minimizeBtn.textContent = this.isMinimized ? '+' : '−';
    });

    lawyerBtn?.addEventListener('click', () => {
      if (this.onLawyerClick) {
        this.onLawyerClick();
      } else {
        window.open('https://protectyaneck.com/lawyer', '_blank');
      }
    });

    upgradeBtn?.addEventListener('click', () => {
      // Will open upgrade page in Phase 2
      window.open('https://protectyaneck.com/upgrade', '_blank');
    });
  }

  /**
   * Removes the overlay from the page
   */
  destroy(): void {
    const host = document.getElementById(SHADOW_HOST_ID);
    if (host) {
      host.remove();
    }
    this.shadowRoot = null;
    this.container = null;
  }

  /**
   * Returns the overlay styles
   */
  private getStyles(): string {
    return `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      .pyn-card {
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
        width: 360px;
        max-height: 80vh;
        overflow: hidden;
        animation: pyn-slide-in 0.3s ease-out;
      }

      .pyn-card.pyn-mini {
        width: 280px;
      }

      .pyn-card.pyn-scanning {
        width: 240px;
      }

      @keyframes pyn-slide-in {
        from {
          opacity: 0;
          transform: translateX(20px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }

      .pyn-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
      }

      .pyn-logo {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .pyn-shield {
        font-size: 20px;
      }

      .pyn-title {
        font-weight: 600;
        font-size: 14px;
        color: #1e293b;
      }

      .pyn-controls {
        display: flex;
        gap: 4px;
      }

      .pyn-btn-icon {
        background: none;
        border: none;
        width: 24px;
        height: 24px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 16px;
        color: #64748b;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .pyn-btn-icon:hover {
        background: #e2e8f0;
        color: #1e293b;
      }

      .pyn-body {
        padding: 16px;
        max-height: 60vh;
        overflow-y: auto;
      }

      .pyn-body.pyn-hidden {
        display: none;
      }

      .pyn-severity-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.5px;
        color: white;
        margin-bottom: 12px;
      }

      .pyn-severity-low { background: ${SEVERITY_COLORS.low}; }
      .pyn-severity-medium { background: ${SEVERITY_COLORS.medium}; }
      .pyn-severity-high { background: ${SEVERITY_COLORS.high}; }
      .pyn-severity-critical { background: ${SEVERITY_COLORS.critical}; }

      .pyn-summary {
        font-size: 13px;
        color: #475569;
        line-height: 1.5;
        margin-bottom: 16px;
      }

      .pyn-risks h4 {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #64748b;
        margin-bottom: 12px;
      }

      .pyn-risk-item {
        background: #f8fafc;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 8px;
      }

      .pyn-risk-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }

      .pyn-risk-icon {
        font-size: 16px;
      }

      .pyn-risk-title {
        font-weight: 600;
        font-size: 13px;
        color: #1e293b;
        flex: 1;
      }

      .pyn-risk-severity {
        font-size: 10px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 10px;
        color: white;
        text-transform: uppercase;
      }

      .pyn-risk-summary {
        font-size: 12px;
        color: #64748b;
        line-height: 1.5;
      }

      .pyn-no-risks {
        text-align: center;
        padding: 20px;
        color: ${SEVERITY_COLORS.low};
        font-size: 14px;
      }

      .pyn-no-risks span {
        font-size: 24px;
        display: block;
        margin-bottom: 8px;
      }

      .pyn-footer {
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid #e2e8f0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .pyn-scans-remaining {
        font-size: 11px;
        color: #94a3b8;
      }

      .pyn-btn {
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        border: none;
        transition: all 0.2s;
      }

      .pyn-btn-primary {
        background: #3b82f6;
        color: white;
      }

      .pyn-btn-primary:hover {
        background: #2563eb;
      }

      .pyn-btn-secondary {
        background: #f1f5f9;
        color: #475569;
      }

      .pyn-btn-secondary:hover {
        background: #e2e8f0;
      }

      .pyn-btn-lawyer {
        background: #10b981;
        color: white;
      }

      .pyn-btn-lawyer:hover {
        background: #059669;
      }

      .pyn-limit-reached {
        text-align: center;
        padding: 20px 0;
      }

      .pyn-limit-reached h4 {
        color: #f97316;
        margin-bottom: 8px;
      }

      .pyn-limit-reached p {
        color: #64748b;
        font-size: 13px;
        margin-bottom: 16px;
      }

      .pyn-limit-reached .pyn-btn {
        display: block;
        width: 100%;
        margin-bottom: 8px;
      }

      .pyn-spinner {
        width: 32px;
        height: 32px;
        border: 3px solid #e2e8f0;
        border-top-color: #3b82f6;
        border-radius: 50%;
        animation: pyn-spin 1s linear infinite;
        margin: 0 auto 12px;
      }

      @keyframes pyn-spin {
        to { transform: rotate(360deg); }
      }

      .pyn-status {
        text-align: center;
        color: #64748b;
        font-size: 13px;
      }
    `;
  }
}

// Export singleton instance
export const overlay = new OverlayManager();
