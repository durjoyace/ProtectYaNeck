import { STORAGE_KEYS, UsageData, Settings, AgreementDetection, ScanResult } from '../shared/types';
import { DEFAULT_SETTINGS, DEFAULT_USAGE, FREE_SCANS_PER_MONTH, API_URL } from '../shared/constants';

/**
 * Background service worker for ProtectYaNeck
 * Handles storage management, badge updates, and cross-script communication
 */

// Analytics event queue for batching
interface QueuedAnalyticsEvent {
  eventType: string;
  timestamp: number;
  sessionId: string;
  metadata?: Record<string, string | number | boolean>;
}

let analyticsQueue: QueuedAnalyticsEvent[] = [];
const ANALYTICS_BATCH_INTERVAL = 60000; // 1 minute
const ANALYTICS_BATCH_SIZE = 20;

// Initialize storage on install
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // Set default settings
    await chrome.storage.local.set({
      [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS,
      [STORAGE_KEYS.USAGE]: DEFAULT_USAGE,
      [STORAGE_KEYS.SCAN_HISTORY]: [],
    });

    // Track install event
    queueAnalyticsEvent({
      eventType: 'extension_installed',
      timestamp: Date.now(),
      sessionId: await getSessionId(),
    });

    // Open welcome page (optional)
    // chrome.tabs.create({ url: 'https://protectyaneck.com/welcome' });

    console.log('[ProtectYaNeck] Extension installed');
  }

  if (details.reason === 'update') {
    console.log('[ProtectYaNeck] Extension updated');
  }
});

// Set up analytics batch sending alarm
chrome.alarms.create('sendAnalyticsBatch', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'sendAnalyticsBatch') {
    flushAnalyticsQueue();
  }
});

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'AGREEMENT_DETECTED':
      handleAgreementDetected(message.payload as AgreementDetection, sender.tab?.id);
      break;

    case 'SCAN_COMPLETE':
      handleScanComplete(message.payload as ScanResult);
      break;

    case 'GET_USAGE':
      getUsage().then(sendResponse);
      return true;

    case 'GET_SETTINGS':
      getSettings().then(sendResponse);
      return true;

    case 'UPDATE_SETTINGS':
      updateSettings(message.payload as Partial<Settings>).then(sendResponse);
      return true;

    case 'TRIGGER_SCAN':
      triggerScan(sender.tab?.id).then(sendResponse);
      return true;

    case 'QUEUE_ANALYTICS_EVENT':
      queueAnalyticsEvent(message.event as QueuedAnalyticsEvent);
      sendResponse({ queued: true });
      return true;

    case 'GET_ANALYTICS_SUMMARY':
      getAnalyticsSummary().then(sendResponse);
      return true;
  }
});

/**
 * Handles agreement detection notification from content script
 */
function handleAgreementDetected(detection: AgreementDetection, tabId?: number): void {
  if (!tabId) return;

  // Update badge to show agreement detected
  const badgeText = detection.confidence >= 0.7 ? '!' : '?';
  chrome.action.setBadgeText({ tabId, text: badgeText });
  chrome.action.setBadgeBackgroundColor({ tabId, color: '#f59e0b' });
  chrome.action.setTitle({
    tabId,
    title: `ProtectYaNeck - Agreement detected (${Math.round(detection.confidence * 100)}% confidence)`,
  });
}

/**
 * Handles scan completion from content script
 */
async function handleScanComplete(result: ScanResult): Promise<void> {
  // Update badge based on severity
  const colors: Record<string, string> = {
    low: '#22c55e',
    medium: '#f59e0b',
    high: '#f97316',
    critical: '#ef4444',
  };

  const tabId = await getCurrentTabId();
  if (tabId) {
    chrome.action.setBadgeText({ tabId, text: result.risks.length.toString() });
    chrome.action.setBadgeBackgroundColor({
      tabId,
      color: colors[result.overallSeverity] || '#64748b',
    });
  }

  // Save to history (limit to last 50 scans)
  const history = await getScanHistory();
  history.unshift(result);
  const trimmedHistory = history.slice(0, 50);
  await chrome.storage.local.set({ [STORAGE_KEYS.SCAN_HISTORY]: trimmedHistory });
}

/**
 * Gets current usage data
 */
async function getUsage(): Promise<UsageData> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.USAGE);
  const usage = result[STORAGE_KEYS.USAGE] || DEFAULT_USAGE;

  // Check if we need to reset for new month
  const now = Date.now();
  const monthStart = new Date(usage.monthStart);
  const currentMonth = new Date(now);

  if (monthStart.getMonth() !== currentMonth.getMonth() ||
      monthStart.getFullYear() !== currentMonth.getFullYear()) {
    const resetUsage: UsageData = {
      ...usage,
      scansThisMonth: 0,
      monthStart: now,
    };
    await chrome.storage.local.set({ [STORAGE_KEYS.USAGE]: resetUsage });
    return resetUsage;
  }

  return usage;
}

/**
 * Gets current settings
 */
async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  return result[STORAGE_KEYS.SETTINGS] || DEFAULT_SETTINGS;
}

/**
 * Updates settings
 */
async function updateSettings(updates: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const newSettings = { ...current, ...updates };
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: newSettings });
  return newSettings;
}

/**
 * Gets scan history
 */
async function getScanHistory(): Promise<ScanResult[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SCAN_HISTORY);
  return result[STORAGE_KEYS.SCAN_HISTORY] || [];
}

/**
 * Triggers a scan on the current tab
 */
async function triggerScan(tabId?: number): Promise<{ success: boolean }> {
  const id = tabId || await getCurrentTabId();
  if (!id) return { success: false };

  try {
    await chrome.tabs.sendMessage(id, { type: 'SCAN_PAGE' });
    return { success: true };
  } catch (error) {
    console.error('[ProtectYaNeck] Failed to trigger scan:', error);
    return { success: false };
  }
}

/**
 * Gets the current active tab ID
 */
async function getCurrentTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

// Clear badge when navigating to new page
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    chrome.action.setBadgeText({ tabId, text: '' });
  }
});

// Handle extension icon click when popup is not shown
// (We use popup, so this won't fire, but keeping for reference)
// chrome.action.onClicked.addListener((tab) => {
//   if (tab.id) triggerScan(tab.id);
// });

/**
 * Gets or creates a session ID for analytics
 */
async function getSessionId(): Promise<string> {
  const result = await chrome.storage.local.get('analyticsSettings');
  if (result.analyticsSettings?.sessionId) {
    return result.analyticsSettings.sessionId;
  }
  const sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
  await chrome.storage.local.set({
    analyticsSettings: {
      enabled: true,
      sessionId,
      installDate: Date.now(),
    },
  });
  return sessionId;
}

/**
 * Queues an analytics event for batch sending
 */
function queueAnalyticsEvent(event: QueuedAnalyticsEvent): void {
  analyticsQueue.push(event);

  // If queue reaches batch size, flush immediately
  if (analyticsQueue.length >= ANALYTICS_BATCH_SIZE) {
    flushAnalyticsQueue();
  }
}

/**
 * Sends queued analytics events to the server
 */
async function flushAnalyticsQueue(): Promise<void> {
  if (analyticsQueue.length === 0) return;

  // Check if analytics is enabled
  const result = await chrome.storage.local.get('analyticsSettings');
  if (!result.analyticsSettings?.enabled) {
    analyticsQueue = [];
    return;
  }

  const eventsToSend = [...analyticsQueue];
  analyticsQueue = [];

  try {
    const response = await fetch(`${API_URL}/api/analytics/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ events: eventsToSend }),
    });

    if (!response.ok) {
      // Put events back in queue to retry later
      analyticsQueue = [...eventsToSend, ...analyticsQueue];
      console.warn('[ProtectYaNeck] Failed to send analytics, will retry');
    }
  } catch (error) {
    // Put events back in queue to retry later
    analyticsQueue = [...eventsToSend, ...analyticsQueue];
    console.warn('[ProtectYaNeck] Analytics send error:', error);
  }
}

/**
 * Gets analytics summary from local storage
 */
async function getAnalyticsSummary(): Promise<{
  totalScans: number;
  totalRisksFound: number;
  scansByDay: Record<string, number>;
}> {
  const result = await chrome.storage.local.get('analyticsEvents');
  const events: QueuedAnalyticsEvent[] = result.analyticsEvents || [];

  const summary = {
    totalScans: 0,
    totalRisksFound: 0,
    scansByDay: {} as Record<string, number>,
  };

  for (const event of events) {
    if (event.eventType === 'scan_completed') {
      summary.totalScans++;
      const dateKey = new Date(event.timestamp).toISOString().split('T')[0];
      summary.scansByDay[dateKey] = (summary.scansByDay[dateKey] || 0) + 1;
      if (event.metadata?.riskCount) {
        summary.totalRisksFound += event.metadata.riskCount as number;
      }
    }
  }

  return summary;
}

console.log('[ProtectYaNeck] Background service worker initialized');
