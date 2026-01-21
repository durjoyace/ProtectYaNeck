/**
 * In-page Feedback Widget
 * Allows users to submit feedback directly from the page overlay
 */

import { API_URL } from '../shared/constants';
import Analytics from '../services/analytics';

export type FeedbackType = 'bug' | 'feature' | 'accuracy' | 'general';

interface FeedbackWidgetOptions {
  onSubmit?: (success: boolean) => void;
  pageUrl?: string;
  scanId?: string;
}

class FeedbackWidget {
  private container: HTMLDivElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private options: FeedbackWidgetOptions = {};

  show(options: FeedbackWidgetOptions = {}): void {
    this.options = options;

    if (this.container) {
      this.destroy();
    }

    this.createWidget();
  }

  private createWidget(): void {
    // Create container with shadow DOM
    this.container = document.createElement('div');
    this.container.id = 'pyn-feedback-widget';
    this.shadowRoot = this.container.attachShadow({ mode: 'closed' });

    // Add styles
    const styles = document.createElement('style');
    styles.textContent = this.getStyles();
    this.shadowRoot.appendChild(styles);

    // Create widget content
    const widget = document.createElement('div');
    widget.className = 'pyn-feedback-container';
    widget.innerHTML = this.getTemplate();
    this.shadowRoot.appendChild(widget);

    // Add to page
    document.body.appendChild(this.container);

    // Setup event listeners
    this.setupListeners();
  }

  private getStyles(): string {
    return `
      .pyn-feedback-container {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .pyn-feedback-button {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        transition: transform 0.2s, box-shadow 0.2s;
      }

      .pyn-feedback-button:hover {
        transform: scale(1.05);
        box-shadow: 0 6px 16px rgba(59, 130, 246, 0.5);
      }

      .pyn-feedback-button svg {
        width: 24px;
        height: 24px;
        fill: white;
      }

      .pyn-feedback-panel {
        display: none;
        position: absolute;
        bottom: 70px;
        right: 0;
        width: 320px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        overflow: hidden;
        animation: slideUp 0.2s ease-out;
      }

      .pyn-feedback-panel.open {
        display: block;
      }

      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .pyn-feedback-header {
        padding: 16px;
        background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        color: white;
      }

      .pyn-feedback-header h3 {
        margin: 0 0 4px 0;
        font-size: 16px;
        font-weight: 600;
      }

      .pyn-feedback-header p {
        margin: 0;
        font-size: 12px;
        opacity: 0.9;
      }

      .pyn-feedback-body {
        padding: 16px;
      }

      .pyn-feedback-types {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
        margin-bottom: 12px;
      }

      .pyn-type-btn {
        padding: 10px 8px;
        border: 2px solid #e5e7eb;
        border-radius: 8px;
        background: white;
        cursor: pointer;
        text-align: center;
        transition: all 0.2s;
        font-size: 12px;
        color: #374151;
      }

      .pyn-type-btn:hover {
        border-color: #3b82f6;
        background: #eff6ff;
      }

      .pyn-type-btn.selected {
        border-color: #3b82f6;
        background: #3b82f6;
        color: white;
      }

      .pyn-type-btn .icon {
        font-size: 18px;
        display: block;
        margin-bottom: 4px;
      }

      .pyn-feedback-textarea {
        width: 100%;
        min-height: 80px;
        padding: 10px;
        border: 2px solid #e5e7eb;
        border-radius: 8px;
        resize: vertical;
        font-family: inherit;
        font-size: 14px;
        margin-bottom: 12px;
        box-sizing: border-box;
      }

      .pyn-feedback-textarea:focus {
        outline: none;
        border-color: #3b82f6;
      }

      .pyn-submit-btn {
        width: 100%;
        padding: 12px;
        background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: transform 0.2s;
      }

      .pyn-submit-btn:hover {
        transform: scale(1.02);
      }

      .pyn-submit-btn:disabled {
        background: #9ca3af;
        cursor: not-allowed;
        transform: none;
      }

      .pyn-success-message {
        text-align: center;
        padding: 40px 20px;
      }

      .pyn-success-message .icon {
        font-size: 48px;
        margin-bottom: 12px;
      }

      .pyn-success-message h4 {
        margin: 0 0 8px 0;
        color: #059669;
      }

      .pyn-success-message p {
        margin: 0;
        color: #6b7280;
        font-size: 14px;
      }

      .pyn-close-btn {
        position: absolute;
        top: 12px;
        right: 12px;
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 4px;
        opacity: 0.8;
      }

      .pyn-close-btn:hover {
        opacity: 1;
      }
    `;
  }

  private getTemplate(): string {
    return `
      <button class="pyn-feedback-button" id="pyn-toggle-btn" aria-label="Give feedback">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/>
          <path d="M12 15l1.57-3.43L17 10l-3.43-1.57L12 5l-1.57 3.43L7 10l3.43 1.57z"/>
        </svg>
      </button>
      <div class="pyn-feedback-panel" id="pyn-panel">
        <div class="pyn-feedback-header">
          <button class="pyn-close-btn" id="pyn-close-btn" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
          <h3>Send Feedback</h3>
          <p>Help us improve ProtectYaNeck</p>
        </div>
        <div class="pyn-feedback-body" id="pyn-form-container">
          <div class="pyn-feedback-types">
            <button class="pyn-type-btn" data-type="bug">
              <span class="icon">🐛</span>
              Bug Report
            </button>
            <button class="pyn-type-btn" data-type="feature">
              <span class="icon">💡</span>
              Feature Idea
            </button>
            <button class="pyn-type-btn" data-type="accuracy">
              <span class="icon">🎯</span>
              Accuracy Issue
            </button>
            <button class="pyn-type-btn" data-type="general">
              <span class="icon">💬</span>
              General
            </button>
          </div>
          <textarea
            class="pyn-feedback-textarea"
            id="pyn-message"
            placeholder="Describe your feedback..."
          ></textarea>
          <button class="pyn-submit-btn" id="pyn-submit-btn" disabled>
            Send Feedback
          </button>
        </div>
        <div class="pyn-success-message" id="pyn-success" style="display: none;">
          <div class="icon">✅</div>
          <h4>Thank you!</h4>
          <p>Your feedback helps make ProtectYaNeck better for everyone.</p>
        </div>
      </div>
    `;
  }

  private setupListeners(): void {
    if (!this.shadowRoot) return;

    // Toggle button
    const toggleBtn = this.shadowRoot.getElementById('pyn-toggle-btn');
    const panel = this.shadowRoot.getElementById('pyn-panel');
    const closeBtn = this.shadowRoot.getElementById('pyn-close-btn');

    toggleBtn?.addEventListener('click', () => {
      panel?.classList.toggle('open');
    });

    closeBtn?.addEventListener('click', () => {
      panel?.classList.remove('open');
    });

    // Type selection
    const typeButtons = this.shadowRoot.querySelectorAll('.pyn-type-btn');
    let selectedType: FeedbackType | null = null;

    typeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        typeButtons.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedType = btn.getAttribute('data-type') as FeedbackType;
        this.updateSubmitButton();
      });
    });

    // Message textarea
    const textarea = this.shadowRoot.getElementById('pyn-message') as HTMLTextAreaElement;
    textarea?.addEventListener('input', () => this.updateSubmitButton());

    // Submit button
    const submitBtn = this.shadowRoot.getElementById('pyn-submit-btn');
    submitBtn?.addEventListener('click', async () => {
      if (!selectedType || !textarea?.value.trim()) return;

      submitBtn.setAttribute('disabled', 'true');
      submitBtn.textContent = 'Sending...';

      try {
        await this.submitFeedback(selectedType, textarea.value.trim());

        // Show success
        const formContainer = this.shadowRoot?.getElementById('pyn-form-container');
        const successContainer = this.shadowRoot?.getElementById('pyn-success');
        if (formContainer) formContainer.style.display = 'none';
        if (successContainer) successContainer.style.display = 'block';

        // Track analytics
        Analytics.feedbackSubmitted(selectedType);

        // Callback
        this.options.onSubmit?.(true);

        // Auto-close after delay
        setTimeout(() => {
          panel?.classList.remove('open');
          this.resetForm();
        }, 2000);

      } catch (error) {
        console.error('Failed to submit feedback:', error);
        submitBtn.removeAttribute('disabled');
        submitBtn.textContent = 'Failed - Try Again';
        this.options.onSubmit?.(false);
      }
    });
  }

  private updateSubmitButton(): void {
    if (!this.shadowRoot) return;

    const submitBtn = this.shadowRoot.getElementById('pyn-submit-btn');
    const textarea = this.shadowRoot.getElementById('pyn-message') as HTMLTextAreaElement;
    const selectedType = this.shadowRoot.querySelector('.pyn-type-btn.selected');

    if (submitBtn && textarea && selectedType) {
      if (textarea.value.trim().length > 0) {
        submitBtn.removeAttribute('disabled');
      } else {
        submitBtn.setAttribute('disabled', 'true');
      }
    }
  }

  private resetForm(): void {
    if (!this.shadowRoot) return;

    // Reset type selection
    const typeButtons = this.shadowRoot.querySelectorAll('.pyn-type-btn');
    typeButtons.forEach(btn => btn.classList.remove('selected'));

    // Reset textarea
    const textarea = this.shadowRoot.getElementById('pyn-message') as HTMLTextAreaElement;
    if (textarea) textarea.value = '';

    // Reset submit button
    const submitBtn = this.shadowRoot.getElementById('pyn-submit-btn');
    if (submitBtn) {
      submitBtn.setAttribute('disabled', 'true');
      submitBtn.textContent = 'Send Feedback';
    }

    // Show form, hide success
    const formContainer = this.shadowRoot.getElementById('pyn-form-container');
    const successContainer = this.shadowRoot.getElementById('pyn-success');
    if (formContainer) formContainer.style.display = 'block';
    if (successContainer) successContainer.style.display = 'none';
  }

  private async submitFeedback(type: FeedbackType, message: string): Promise<void> {
    // Get user ID from storage
    const result = await chrome.storage.local.get('userId');
    const userId = result.userId;

    const response = await fetch(`${API_URL}/api/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        type,
        message,
        pageUrl: this.options.pageUrl || window.location.href,
        scanId: this.options.scanId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to submit feedback');
    }
  }

  destroy(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
      this.shadowRoot = null;
    }
  }

  hide(): void {
    const panel = this.shadowRoot?.getElementById('pyn-panel');
    panel?.classList.remove('open');
  }
}

export const feedbackWidget = new FeedbackWidget();
export default feedbackWidget;
