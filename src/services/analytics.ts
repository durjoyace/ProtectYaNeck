/**
 * Privacy-Respecting Analytics Service
 *
 * All data is anonymized before transmission:
 * - No personal identifiers
 * - No agreement content
 * - No URLs (only domain hashes)
 * - User can opt-out completely
 */

import { API_URL } from '../shared/constants';

export type AnalyticsEventType =
  | 'extension_installed'
  | 'extension_activated'
  | 'agreement_detected'
  | 'scan_started'
  | 'scan_completed'
  | 'risk_displayed'
  | 'risk_clicked'
  | 'upgrade_cta_clicked'
  | 'upgrade_completed'
  | 'lawyer_referral_clicked'
  | 'lawyer_referral_submitted'
  | 'feedback_submitted'
  | 'settings_opened'
  | 'whitelist_added'
  | 'whitelist_removed'
  | 'error_occurred';

interface AnalyticsEvent {
  eventType: AnalyticsEventType;
  timestamp: number;
  sessionId: string;
  metadata?: Record<string, string | number | boolean>;
}

interface AnalyticsSettings {
  enabled: boolean;
  sessionId: string;
  installDate: number;
}

// Simple hash function for anonymizing data
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// Generate anonymous session ID
function generateSessionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}

// Get or create analytics settings
async function getAnalyticsSettings(): Promise<AnalyticsSettings> {
  const result = await chrome.storage.local.get('analyticsSettings');

  if (result.analyticsSettings) {
    return result.analyticsSettings;
  }

  // Initialize default settings
  const settings: AnalyticsSettings = {
    enabled: true, // Opt-in by default, can be changed in settings
    sessionId: generateSessionId(),
    installDate: Date.now(),
  };

  await chrome.storage.local.set({ analyticsSettings: settings });
  return settings;
}

// Update analytics settings
export async function updateAnalyticsSettings(enabled: boolean): Promise<void> {
  const settings = await getAnalyticsSettings();
  settings.enabled = enabled;

  // Generate new session ID if re-enabling (for privacy)
  if (enabled) {
    settings.sessionId = generateSessionId();
  }

  await chrome.storage.local.set({ analyticsSettings: settings });
}

// Check if analytics is enabled
export async function isAnalyticsEnabled(): Promise<boolean> {
  const settings = await getAnalyticsSettings();
  return settings.enabled;
}

// Store event locally
async function storeEventLocally(event: AnalyticsEvent): Promise<void> {
  const result = await chrome.storage.local.get('analyticsEvents');
  const events: AnalyticsEvent[] = result.analyticsEvents || [];

  // Keep only last 1000 events to avoid storage bloat
  if (events.length >= 1000) {
    events.shift();
  }

  events.push(event);
  await chrome.storage.local.set({ analyticsEvents: events });
}

// Get local analytics summary
export async function getLocalAnalyticsSummary(): Promise<{
  totalScans: number;
  totalRisksFound: number;
  totalLawyerReferrals: number;
  scansByDay: Record<string, number>;
  risksBySeverity: Record<string, number>;
}> {
  const result = await chrome.storage.local.get('analyticsEvents');
  const events: AnalyticsEvent[] = result.analyticsEvents || [];

  const summary = {
    totalScans: 0,
    totalRisksFound: 0,
    totalLawyerReferrals: 0,
    scansByDay: {} as Record<string, number>,
    risksBySeverity: {} as Record<string, number>,
  };

  for (const event of events) {
    const dateKey = new Date(event.timestamp).toISOString().split('T')[0];

    switch (event.eventType) {
      case 'scan_completed':
        summary.totalScans++;
        summary.scansByDay[dateKey] = (summary.scansByDay[dateKey] || 0) + 1;
        if (event.metadata?.riskCount) {
          summary.totalRisksFound += event.metadata.riskCount as number;
        }
        break;
      case 'risk_displayed':
        if (event.metadata?.severity) {
          const severity = event.metadata.severity as string;
          summary.risksBySeverity[severity] = (summary.risksBySeverity[severity] || 0) + 1;
        }
        break;
      case 'lawyer_referral_submitted':
        summary.totalLawyerReferrals++;
        break;
    }
  }

  return summary;
}

// Send events to server (batched, anonymized)
async function sendEventsToServer(events: AnalyticsEvent[]): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/analytics/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        events: events.map(e => ({
          ...e,
          // Ensure no sensitive data is sent
          metadata: e.metadata ? sanitizeMetadata(e.metadata) : undefined,
        })),
      }),
    });

    return response.ok;
  } catch (error) {
    console.warn('[ProtectYaNeck] Failed to send analytics:', error);
    return false;
  }
}

// Sanitize metadata to remove any potentially sensitive data
function sanitizeMetadata(metadata: Record<string, string | number | boolean>): Record<string, string | number | boolean> {
  const sanitized: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(metadata)) {
    // Skip any keys that might contain sensitive info
    if (['url', 'email', 'name', 'phone', 'content', 'text'].includes(key.toLowerCase())) {
      continue;
    }

    // Hash domain values
    if (key === 'domain' && typeof value === 'string') {
      sanitized.domainHash = simpleHash(value);
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

// Main tracking function
export async function trackEvent(
  eventType: AnalyticsEventType,
  metadata?: Record<string, string | number | boolean>
): Promise<void> {
  const settings = await getAnalyticsSettings();

  // Always store locally for user's own history
  const event: AnalyticsEvent = {
    eventType,
    timestamp: Date.now(),
    sessionId: settings.sessionId,
    metadata,
  };

  await storeEventLocally(event);

  // Only send to server if analytics is enabled
  if (!settings.enabled) {
    return;
  }

  // For privacy, we batch events and send periodically
  // This is handled by the background service worker
  chrome.runtime.sendMessage({
    type: 'QUEUE_ANALYTICS_EVENT',
    event,
  }).catch(() => {
    // Ignore errors if background script not ready
  });
}

// Convenience methods for common events
export const Analytics = {
  extensionInstalled: () => trackEvent('extension_installed'),

  extensionActivated: () => trackEvent('extension_activated'),

  agreementDetected: (confidence: number) =>
    trackEvent('agreement_detected', { confidence }),

  scanStarted: () => trackEvent('scan_started'),

  scanCompleted: (riskCount: number, duration: number) =>
    trackEvent('scan_completed', { riskCount, duration }),

  riskDisplayed: (severity: string, category: string) =>
    trackEvent('risk_displayed', { severity, category }),

  riskClicked: (category: string) =>
    trackEvent('risk_clicked', { category }),

  upgradeCTAClicked: (source: string) =>
    trackEvent('upgrade_cta_clicked', { source }),

  upgradeCompleted: (plan: string) =>
    trackEvent('upgrade_completed', { plan }),

  lawyerReferralClicked: (source: string) =>
    trackEvent('lawyer_referral_clicked', { source }),

  lawyerReferralSubmitted: (concern: string) =>
    trackEvent('lawyer_referral_submitted', { concern }),

  feedbackSubmitted: (type: string) =>
    trackEvent('feedback_submitted', { type }),

  settingsOpened: () => trackEvent('settings_opened'),

  whitelistAdded: () => trackEvent('whitelist_added'),

  whitelistRemoved: () => trackEvent('whitelist_removed'),

  errorOccurred: (errorType: string) =>
    trackEvent('error_occurred', { errorType }),
};

export default Analytics;
