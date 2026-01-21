/**
 * Bug Reporter Service
 * Captures detailed diagnostic information for bug reports
 */

import { API_URL } from '../shared/constants';

export interface BugReport {
  title: string;
  description: string;
  steps?: string;
  expected?: string;
  actual?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'detection' | 'analysis' | 'ui' | 'performance' | 'crash' | 'other';
  diagnostics: DiagnosticInfo;
}

export interface DiagnosticInfo {
  extensionVersion: string;
  browserInfo: string;
  platform: string;
  pageUrl: string;
  pageTitle: string;
  timestamp: number;
  settings: Record<string, unknown>;
  usage: Record<string, unknown>;
  recentErrors: string[];
  lastScanResult?: string;
  consoleErrors?: string[];
}

// Collect recent console errors
const recentErrors: string[] = [];
const MAX_ERRORS = 10;

// Capture console errors if in content script context
if (typeof window !== 'undefined') {
  const originalError = console.error;
  console.error = (...args) => {
    const errorString = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');

    if (errorString.includes('ProtectYaNeck')) {
      recentErrors.push(`${new Date().toISOString()}: ${errorString}`);
      if (recentErrors.length > MAX_ERRORS) {
        recentErrors.shift();
      }
    }

    originalError.apply(console, args);
  };
}

/**
 * Collects diagnostic information about the current environment
 */
export async function collectDiagnostics(): Promise<DiagnosticInfo> {
  // Get extension version from manifest
  const manifest = chrome.runtime.getManifest();

  // Get browser info
  const browserInfo = navigator.userAgent;

  // Get platform
  const platform = navigator.platform;

  // Get current settings and usage
  const storage = await chrome.storage.local.get(['pyn_settings', 'pyn_usage', 'pyn_scan_history']);

  // Get last scan result summary (without sensitive details)
  let lastScanResult = 'No recent scan';
  const history = storage.pyn_scan_history || [];
  if (history.length > 0) {
    const lastScan = history[0];
    lastScanResult = JSON.stringify({
      timestamp: lastScan.timestamp,
      risksFound: lastScan.risks?.length || 0,
      overallSeverity: lastScan.overallSeverity,
    });
  }

  return {
    extensionVersion: manifest.version,
    browserInfo,
    platform,
    pageUrl: typeof window !== 'undefined' ? window.location.href : 'N/A',
    pageTitle: typeof document !== 'undefined' ? document.title : 'N/A',
    timestamp: Date.now(),
    settings: sanitizeSettings(storage.pyn_settings || {}),
    usage: sanitizeUsage(storage.pyn_usage || {}),
    recentErrors: [...recentErrors],
    lastScanResult,
  };
}

/**
 * Sanitizes settings to remove any sensitive data
 */
function sanitizeSettings(settings: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...settings };

  // Remove any API keys or sensitive data
  delete sanitized.apiKey;
  delete sanitized.licenseKey;

  return sanitized;
}

/**
 * Sanitizes usage data
 */
function sanitizeUsage(usage: Record<string, unknown>): Record<string, unknown> {
  return {
    scansThisMonth: usage.scansThisMonth,
    tier: usage.tier,
    monthStart: usage.monthStart,
  };
}

/**
 * Submits a bug report to the backend
 */
export async function submitBugReport(report: Omit<BugReport, 'diagnostics'>): Promise<{ success: boolean; reportId?: string }> {
  try {
    // Collect diagnostics
    const diagnostics = await collectDiagnostics();

    const fullReport: BugReport = {
      ...report,
      diagnostics,
    };

    const response = await fetch(`${API_URL}/api/bugs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fullReport),
    });

    if (!response.ok) {
      throw new Error('Failed to submit bug report');
    }

    const result = await response.json();
    return { success: true, reportId: result.reportId };

  } catch (error) {
    console.error('[ProtectYaNeck] Failed to submit bug report:', error);
    return { success: false };
  }
}

/**
 * Generates a downloadable bug report for manual submission
 */
export async function generateBugReportFile(report: Omit<BugReport, 'diagnostics'>): Promise<string> {
  const diagnostics = await collectDiagnostics();

  const fullReport = {
    ...report,
    diagnostics,
    generatedAt: new Date().toISOString(),
  };

  return JSON.stringify(fullReport, null, 2);
}

export default {
  collectDiagnostics,
  submitBugReport,
  generateBugReportFile,
};
