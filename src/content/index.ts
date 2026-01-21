import { detectAgreement, extractAgreementText } from './detector';
import { analyzeRisks, calculateOverallSeverity, generateOverallSummary } from './analyzer';
import { overlay } from './overlay';
import { lawyerModal } from './LawyerModal';
import { ScanResult, UsageData, Settings, STORAGE_KEYS } from '../shared/types';
import { DEFAULT_SETTINGS, DEFAULT_USAGE, FREE_SCANS_PER_MONTH } from '../shared/constants';
import Analytics from '../services/analytics';

// Store last scan result for lawyer modal
let lastScanResult: ScanResult | null = null;

/**
 * Main content script for ProtectYaNeck
 * Handles agreement detection, risk analysis, and overlay display
 */

let hasScannedPage = false;

/**
 * Initializes the content script
 */
async function init(): Promise<void> {
  // Check if extension is enabled
  const settings = await getSettings();
  if (!settings.enabled) return;

  // Check if site is whitelisted
  const hostname = window.location.hostname;
  if (settings.whitelist.includes(hostname)) return;

  // Set up message listener for manual scans from popup
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'SCAN_PAGE') {
      scanPage().then(sendResponse);
      return true; // Keep channel open for async response
    }

    if (message.type === 'HIDE_OVERLAY') {
      overlay.destroy();
      sendResponse({ success: true });
    }

    if (message.type === 'SHOW_LAWYER_MODAL') {
      lawyerModal.show(lastScanResult || undefined);
      sendResponse({ success: true });
    }
  });

  // Auto-scan if enabled
  if (settings.autoScan) {
    // Wait a moment for page to settle
    setTimeout(() => {
      autoDetectAndNotify();
    }, 1000);
  }
}

/**
 * Auto-detects agreements and shows subtle notification
 */
async function autoDetectAndNotify(): Promise<void> {
  const detection = detectAgreement();

  if (detection.isAgreement && detection.confidence >= 0.5) {
    // Track agreement detection
    Analytics.agreementDetected(detection.confidence);

    // Notify background script that an agreement was detected
    chrome.runtime.sendMessage({
      type: 'AGREEMENT_DETECTED',
      payload: detection,
    });
  }
}

/**
 * Performs a full page scan
 */
async function scanPage(): Promise<ScanResult | { error: string }> {
  if (hasScannedPage) {
    // Return cached result or allow rescan
  }

  // Check usage limits
  const usage = await getUsage();
  const scansRemaining = FREE_SCANS_PER_MONTH - usage.scansThisMonth;

  if (usage.tier === 'free' && scansRemaining <= 0) {
    overlay.showLimitReached();
    return { error: 'LIMIT_REACHED' };
  }

  // Track scan start
  Analytics.scanStarted();
  const scanStartTime = Date.now();

  // Show scanning indicator
  overlay.showScanning();

  try {
    // Detect agreement
    const detection = detectAgreement();

    if (!detection.isAgreement) {
      overlay.showNoAgreement();
      return { error: 'NO_AGREEMENT' };
    }

    // Extract and analyze text
    const text = extractAgreementText();
    const risks = analyzeRisks(text);
    const overallSeverity = calculateOverallSeverity(risks);
    const summary = generateOverallSummary(risks);

    // Create scan result
    const result: ScanResult = {
      id: `scan-${Date.now()}`,
      url: window.location.href,
      timestamp: Date.now(),
      detection,
      risks,
      overallSeverity,
      summary,
    };

    // Increment usage counter
    await incrementUsage();
    const newUsage = await getUsage();
    const newScansRemaining = FREE_SCANS_PER_MONTH - newUsage.scansThisMonth;

    // Store result for lawyer modal
    lastScanResult = result;

    // Show results
    overlay.showResults(result, newScansRemaining, () => lawyerModal.show(result));

    hasScannedPage = true;

    // Track scan completion
    const scanDuration = Date.now() - scanStartTime;
    Analytics.scanCompleted(risks.length, scanDuration);

    // Track each risk for analytics
    risks.forEach(risk => {
      Analytics.riskDisplayed(risk.severity, risk.category);
    });

    // Notify background script
    chrome.runtime.sendMessage({
      type: 'SCAN_COMPLETE',
      payload: result,
    });

    return result;

  } catch (error) {
    console.error('[ProtectYaNeck] Scan error:', error);
    Analytics.errorOccurred('scan_failed');
    overlay.destroy();
    return { error: 'SCAN_FAILED' };
  }
}

/**
 * Gets current settings from storage
 */
async function getSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEYS.SETTINGS, (result) => {
      resolve(result[STORAGE_KEYS.SETTINGS] || DEFAULT_SETTINGS);
    });
  });
}

/**
 * Gets current usage data from storage
 */
async function getUsage(): Promise<UsageData> {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEYS.USAGE, (result) => {
      const usage = result[STORAGE_KEYS.USAGE] || DEFAULT_USAGE;

      // Check if we need to reset for new month
      const now = Date.now();
      const monthStart = new Date(usage.monthStart);
      const currentMonth = new Date(now);

      if (monthStart.getMonth() !== currentMonth.getMonth() ||
          monthStart.getFullYear() !== currentMonth.getFullYear()) {
        // Reset for new month
        const resetUsage: UsageData = {
          ...usage,
          scansThisMonth: 0,
          monthStart: now,
        };
        chrome.storage.local.set({ [STORAGE_KEYS.USAGE]: resetUsage });
        resolve(resetUsage);
      } else {
        resolve(usage);
      }
    });
  });
}

/**
 * Increments the scan counter
 */
async function incrementUsage(): Promise<void> {
  const usage = await getUsage();

  const newUsage: UsageData = {
    ...usage,
    scansThisMonth: usage.scansThisMonth + 1,
  };

  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.USAGE]: newUsage }, resolve);
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Also set up observer for SPAs
const observer = new MutationObserver(() => {
  // Could re-check for agreements on significant DOM changes
  // For now, just reset the scan flag on URL changes
});

let lastUrl = window.location.href;
new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    hasScannedPage = false;
    overlay.destroy();
  }
}).observe(document.body, { childList: true, subtree: true });
