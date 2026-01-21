/**
 * Before-You-Sign Interceptor
 * Catches clicks on "I Agree" buttons and checkboxes to warn users
 */

import { ScanResult } from '../shared/types';
import { analyzeRisksEnhanced } from './analyzer';
import { extractAgreementText } from './detector';

// Patterns to identify agreement buttons/checkboxes
const AGREEMENT_BUTTON_PATTERNS = [
  /^i\s*(agree|accept|consent)$/i,
  /^agree(\s+(&|and)\s+continue)?$/i,
  /^accept(\s+(terms|all|&\s+continue))?$/i,
  /^continue$/i,
  /^sign\s*up$/i,
  /^create\s*account$/i,
  /^register$/i,
  /^submit$/i,
  /^get\s*started$/i,
];

const AGREEMENT_CHECKBOX_PATTERNS = [
  /i\s*(have\s+read|agree|accept|consent)/i,
  /terms\s*(of\s*)?(service|use)/i,
  /privacy\s*policy/i,
  /agree\s+to\s+the/i,
];

interface InterceptorState {
  isEnabled: boolean;
  hasScanned: boolean;
  scanResult: ScanResult | null;
  interceptedElements: Set<Element>;
}

const state: InterceptorState = {
  isEnabled: true,
  hasScanned: false,
  scanResult: null,
  interceptedElements: new Set(),
};

/**
 * Checks if an element is an agreement trigger
 */
function isAgreementTrigger(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  const text = element.textContent?.trim() || '';
  const ariaLabel = element.getAttribute('aria-label') || '';
  const value = (element as HTMLInputElement).value || '';

  // Check buttons and links
  if (tagName === 'button' || tagName === 'a' || element.getAttribute('role') === 'button') {
    const checkText = `${text} ${ariaLabel} ${value}`.toLowerCase();
    return AGREEMENT_BUTTON_PATTERNS.some(pattern => pattern.test(checkText));
  }

  // Check checkboxes
  if (tagName === 'input' && (element as HTMLInputElement).type === 'checkbox') {
    // Check the label
    const id = element.id;
    const label = id ? document.querySelector(`label[for="${id}"]`) : null;
    const labelText = label?.textContent || '';

    // Check parent text (for checkboxes without proper labels)
    const parentText = element.parentElement?.textContent || '';

    const checkText = `${labelText} ${parentText}`.toLowerCase();
    return AGREEMENT_CHECKBOX_PATTERNS.some(pattern => pattern.test(checkText));
  }

  return false;
}

/**
 * Creates a warning modal before signing
 */
function showWarningModal(
  element: Element,
  scanResult: ReturnType<typeof analyzeRisksEnhanced>,
  onProceed: () => void,
  onCancel: () => void
): void {
  // Create modal container
  const modalContainer = document.createElement('div');
  modalContainer.id = 'pyn-intercept-modal';

  const shadow = modalContainer.attachShadow({ mode: 'closed' });

  // Styles
  const styles = document.createElement('style');
  styles.textContent = `
    .pyn-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
      animation: fadeIn 0.2s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .pyn-modal {
      background: white;
      border-radius: 16px;
      max-width: 480px;
      width: 90%;
      max-height: 80vh;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: slideUp 0.3s ease-out;
    }

    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .pyn-modal-header {
      background: linear-gradient(135deg, #dc2626, #991b1b);
      color: white;
      padding: 20px 24px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .pyn-modal-header.warning {
      background: linear-gradient(135deg, #f59e0b, #d97706);
    }

    .pyn-modal-header.caution {
      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    }

    .pyn-modal-icon {
      font-size: 32px;
    }

    .pyn-modal-title {
      font-size: 20px;
      font-weight: 700;
      margin: 0;
    }

    .pyn-modal-subtitle {
      font-size: 14px;
      opacity: 0.9;
      margin: 4px 0 0 0;
    }

    .pyn-modal-body {
      padding: 24px;
      max-height: 300px;
      overflow-y: auto;
    }

    .pyn-score-bar {
      background: #e5e7eb;
      border-radius: 8px;
      height: 12px;
      margin-bottom: 16px;
      overflow: hidden;
    }

    .pyn-score-fill {
      height: 100%;
      border-radius: 8px;
      transition: width 0.5s ease-out;
    }

    .pyn-score-fill.low { background: #22c55e; }
    .pyn-score-fill.medium { background: #f59e0b; }
    .pyn-score-fill.high { background: #f97316; }
    .pyn-score-fill.critical { background: #dc2626; }

    .pyn-score-label {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      color: #6b7280;
      margin-bottom: 8px;
    }

    .pyn-risks-list {
      list-style: none;
      padding: 0;
      margin: 0 0 16px 0;
    }

    .pyn-risk-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 0;
      border-bottom: 1px solid #e5e7eb;
    }

    .pyn-risk-item:last-child {
      border-bottom: none;
    }

    .pyn-risk-badge {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .pyn-risk-badge.critical { background: #fecaca; color: #991b1b; }
    .pyn-risk-badge.high { background: #fed7aa; color: #9a3412; }
    .pyn-risk-badge.medium { background: #fef3c7; color: #92400e; }
    .pyn-risk-badge.low { background: #d1fae5; color: #065f46; }

    .pyn-risk-text {
      font-size: 14px;
      color: #374151;
      line-height: 1.4;
    }

    .pyn-warnings {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 16px;
    }

    .pyn-warning-title {
      font-weight: 600;
      color: #92400e;
      margin: 0 0 8px 0;
      font-size: 14px;
    }

    .pyn-warning-text {
      font-size: 13px;
      color: #92400e;
      margin: 4px 0;
    }

    .pyn-modal-footer {
      padding: 16px 24px;
      background: #f9fafb;
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    .pyn-btn {
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }

    .pyn-btn-cancel {
      background: white;
      border: 2px solid #e5e7eb;
      color: #374151;
    }

    .pyn-btn-cancel:hover {
      border-color: #3b82f6;
      color: #3b82f6;
    }

    .pyn-btn-proceed {
      background: #dc2626;
      color: white;
    }

    .pyn-btn-proceed:hover {
      background: #991b1b;
    }

    .pyn-btn-proceed.safe {
      background: #22c55e;
    }

    .pyn-btn-proceed.safe:hover {
      background: #16a34a;
    }

    .pyn-comparison {
      font-size: 13px;
      color: #6b7280;
      text-align: center;
      margin-top: 8px;
    }
  `;
  shadow.appendChild(styles);

  // Determine header style based on severity
  const headerClass = scanResult.overallSeverity === 'critical' ? '' :
    scanResult.overallSeverity === 'high' ? 'warning' : 'caution';

  const headerIcon = scanResult.overallSeverity === 'critical' ? '🚨' :
    scanResult.overallSeverity === 'high' ? '⚠️' : '📋';

  const headerTitle = scanResult.overallSeverity === 'critical' ? 'Wait! Critical Issues Found' :
    scanResult.overallSeverity === 'high' ? 'Caution: Significant Risks' : 'Review Before You Agree';

  // Score color
  const scoreClass = scanResult.score >= 70 ? 'critical' :
    scanResult.score >= 50 ? 'high' :
    scanResult.score >= 30 ? 'medium' : 'low';

  // Build modal content
  const modal = document.createElement('div');
  modal.className = 'pyn-modal-overlay';
  modal.innerHTML = `
    <div class="pyn-modal">
      <div class="pyn-modal-header ${headerClass}">
        <span class="pyn-modal-icon">${headerIcon}</span>
        <div>
          <h2 class="pyn-modal-title">${headerTitle}</h2>
          <p class="pyn-modal-subtitle">ProtectYaNeck analyzed this agreement</p>
        </div>
      </div>
      <div class="pyn-modal-body">
        <div class="pyn-score-label">
          <span>Risk Score</span>
          <span><strong>${scanResult.score}</strong>/100</span>
        </div>
        <div class="pyn-score-bar">
          <div class="pyn-score-fill ${scoreClass}" style="width: ${scanResult.score}%"></div>
        </div>
        <p class="pyn-comparison">${scanResult.comparison.message}</p>

        ${scanResult.combinationWarnings.length > 0 ? `
          <div class="pyn-warnings">
            <p class="pyn-warning-title">⚠️ Warning</p>
            ${scanResult.combinationWarnings.map(w => `<p class="pyn-warning-text">• ${w}</p>`).join('')}
          </div>
        ` : ''}

        <ul class="pyn-risks-list">
          ${scanResult.risks.slice(0, 5).map(risk => `
            <li class="pyn-risk-item">
              <span class="pyn-risk-badge ${risk.severity}">${risk.severity}</span>
              <span class="pyn-risk-text"><strong>${risk.title}:</strong> ${risk.summary}</span>
            </li>
          `).join('')}
        </ul>

        ${scanResult.risks.length > 5 ? `<p style="color: #6b7280; font-size: 13px; text-align: center;">+ ${scanResult.risks.length - 5} more risks detected</p>` : ''}
      </div>
      <div class="pyn-modal-footer">
        <button class="pyn-btn pyn-btn-cancel" id="pyn-cancel">Review Agreement</button>
        <button class="pyn-btn pyn-btn-proceed ${scanResult.score < 30 ? 'safe' : ''}" id="pyn-proceed">
          ${scanResult.score < 30 ? 'Proceed' : 'Accept Anyway'}
        </button>
      </div>
    </div>
  `;

  shadow.appendChild(modal);
  document.body.appendChild(modalContainer);

  // Event listeners
  shadow.getElementById('pyn-cancel')?.addEventListener('click', () => {
    modalContainer.remove();
    onCancel();
  });

  shadow.getElementById('pyn-proceed')?.addEventListener('click', () => {
    modalContainer.remove();
    onProceed();
  });

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modalContainer.remove();
      onCancel();
    }
  });
}

/**
 * Handles click interception
 */
function handleInterceptedClick(event: MouseEvent, element: Element): void {
  if (!state.isEnabled) return;

  // Prevent the original action
  event.preventDefault();
  event.stopPropagation();

  // Perform quick scan if not done already
  const text = extractAgreementText();
  const scanResult = analyzeRisksEnhanced(text);

  // Only show modal if risks found
  if (scanResult.risks.length === 0) {
    // No risks, let it through
    triggerOriginalAction(element);
    return;
  }

  // Show warning modal
  showWarningModal(
    element,
    scanResult,
    () => {
      // User chose to proceed
      triggerOriginalAction(element);
    },
    () => {
      // User chose to review
      // Could scroll to risks or highlight them
    }
  );
}

/**
 * Triggers the original click action
 */
function triggerOriginalAction(element: Element): void {
  // Temporarily disable interceptor
  state.isEnabled = false;

  // Create and dispatch a new click event
  const clickEvent = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: window,
  });

  element.dispatchEvent(clickEvent);

  // Re-enable after a short delay
  setTimeout(() => {
    state.isEnabled = true;
  }, 100);
}

/**
 * Sets up interception on agreement triggers
 */
function setupInterceptors(): void {
  // Find all potential agreement triggers
  const buttons = document.querySelectorAll('button, a, [role="button"], input[type="submit"]');
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');

  buttons.forEach(button => {
    if (isAgreementTrigger(button) && !state.interceptedElements.has(button)) {
      button.addEventListener('click', (e) => handleInterceptedClick(e as MouseEvent, button), true);
      state.interceptedElements.add(button);
    }
  });

  checkboxes.forEach(checkbox => {
    if (isAgreementTrigger(checkbox) && !state.interceptedElements.has(checkbox)) {
      checkbox.addEventListener('click', (e) => handleInterceptedClick(e as MouseEvent, checkbox), true);
      state.interceptedElements.add(checkbox);
    }
  });
}

/**
 * Initializes the interceptor with MutationObserver for dynamic content
 */
export function initInterceptor(): void {
  // Initial setup
  setupInterceptors();

  // Watch for dynamically added elements
  const observer = new MutationObserver(() => {
    setupInterceptors();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

/**
 * Enables or disables the interceptor
 */
export function setInterceptorEnabled(enabled: boolean): void {
  state.isEnabled = enabled;
}

export default {
  init: initInterceptor,
  setEnabled: setInterceptorEnabled,
};
