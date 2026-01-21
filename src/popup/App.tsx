import React, { useEffect, useState } from 'react';
import { UsageData, Settings } from '../shared/types';
import { DEFAULT_USAGE, DEFAULT_SETTINGS, FREE_SCANS_PER_MONTH } from '../shared/constants';

export function App() {
  const [usage, setUsage] = useState<UsageData>(DEFAULT_USAGE);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [scanning, setScanning] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);

  useEffect(() => {
    // Load usage and settings
    loadData();

    // Get current tab URL
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url) {
        setCurrentUrl(tabs[0].url);
      }
    });
  }, []);

  async function loadData() {
    const usageResponse = await chrome.runtime.sendMessage({ type: 'GET_USAGE' });
    if (usageResponse) setUsage(usageResponse);

    const settingsResponse = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
    if (settingsResponse) setSettings(settingsResponse);
  }

  async function handleScan() {
    setScanning(true);

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'SCAN_PAGE' });
      } catch (error) {
        console.error('Failed to send scan message:', error);
      }
    }

    // Close popup after triggering scan
    setTimeout(() => window.close(), 500);
  }

  async function toggleEnabled() {
    const newSettings = { ...settings, enabled: !settings.enabled };
    await chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      payload: { enabled: newSettings.enabled },
    });
    setSettings(newSettings);
  }

  function openSettings() {
    chrome.runtime.openOptionsPage();
  }

  function openUpgrade() {
    chrome.tabs.create({ url: 'https://protectyaneck.com/upgrade' });
  }

  async function openLawyerModal() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'SHOW_LAWYER_MODAL' });
        window.close();
      } catch (error) {
        // If content script not loaded, open external page
        chrome.tabs.create({ url: 'https://protectyaneck.com/lawyer' });
      }
    }
  }

  async function sendFeedback() {
    if (!feedbackMessage.trim()) return;

    try {
      await fetch('http://localhost:3001/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: feedbackMessage,
          pageUrl: currentUrl,
          type: 'general',
        }),
      });
    } catch (error) {
      console.log('Feedback saved locally (backend unavailable)');
    }

    setFeedbackSent(true);
    setTimeout(() => {
      setShowFeedback(false);
      setFeedbackMessage('');
      setFeedbackSent(false);
    }, 2000);
  }

  const scansRemaining = Math.max(0, FREE_SCANS_PER_MONTH - usage.scansThisMonth);
  const isLimitReached = usage.tier === 'free' && scansRemaining === 0;

  let hostname = '';
  try {
    hostname = currentUrl ? new URL(currentUrl).hostname : '';
  } catch {
    hostname = '';
  }

  const isWhitelisted = hostname && settings.whitelist.includes(hostname);

  if (showFeedback) {
    return (
      <div className="popup">
        <header className="header">
          <div className="logo">
            <span className="shield">🛡️</span>
            <h1>Send Feedback</h1>
          </div>
          <button className="close-btn" onClick={() => setShowFeedback(false)}>×</button>
        </header>

        {feedbackSent ? (
          <div className="feedback-success">
            <span className="success-icon">✓</span>
            <p>Thank you for your feedback!</p>
          </div>
        ) : (
          <div className="feedback-form">
            <textarea
              placeholder="Tell us what you think, report a bug, or suggest a feature..."
              value={feedbackMessage}
              onChange={(e) => setFeedbackMessage(e.target.value)}
              rows={4}
            />
            <button
              className="btn btn-primary"
              onClick={sendFeedback}
              disabled={!feedbackMessage.trim()}
            >
              Send Feedback
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="popup">
      {/* Header */}
      <header className="header">
        <div className="logo">
          <span className="shield">🛡️</span>
          <h1>ProtectYaNeck</h1>
        </div>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={toggleEnabled}
          />
          <span className="slider"></span>
        </label>
      </header>

      {/* Status */}
      <div className="status">
        {!settings.enabled ? (
          <div className="status-disabled">
            <span className="icon">⏸️</span>
            <p>Protection paused</p>
          </div>
        ) : isWhitelisted ? (
          <div className="status-whitelisted">
            <span className="icon">✓</span>
            <p>Site whitelisted</p>
            <span className="hostname">{hostname}</span>
          </div>
        ) : (
          <div className="status-active">
            <span className="icon">✓</span>
            <p>Protection active</p>
          </div>
        )}
      </div>

      {/* Scan Button */}
      <div className="scan-section">
        <button
          className={`scan-btn ${scanning ? 'scanning' : ''} ${isLimitReached ? 'disabled' : ''}`}
          onClick={handleScan}
          disabled={!settings.enabled || scanning || isLimitReached}
        >
          {scanning ? (
            <>
              <span className="spinner"></span>
              Scanning...
            </>
          ) : isLimitReached ? (
            'Scan Limit Reached'
          ) : (
            'Scan This Page'
          )}
        </button>

        {hostname && !isWhitelisted && settings.enabled && (
          <p className="scan-hint">
            Click to analyze agreements on this page
          </p>
        )}
      </div>

      {/* Usage */}
      <div className="usage">
        <div className="usage-bar">
          <div
            className="usage-fill"
            style={{
              width: `${Math.min((usage.scansThisMonth / FREE_SCANS_PER_MONTH) * 100, 100)}%`,
            }}
          />
        </div>
        <div className="usage-text">
          <span>
            {usage.tier === 'paid' ? 'Unlimited' : `${scansRemaining} scans remaining`}
          </span>
          <span className={`tier ${usage.tier}`}>
            {usage.tier === 'paid' ? '⭐ Pro' : 'Free'}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="actions">
        {usage.tier === 'free' && (
          <button className="btn btn-upgrade" onClick={openUpgrade}>
            Upgrade to Pro
          </button>
        )}
        <button className="btn btn-lawyer" onClick={openLawyerModal}>
          ⚖️ Need a Lawyer?
        </button>
      </div>

      {/* Footer */}
      <footer className="footer">
        <button className="link-btn" onClick={openSettings}>Settings</button>
        <span className="separator">•</span>
        <button
          className="link-btn"
          onClick={() => chrome.tabs.create({ url: 'https://protectyaneck.com/help' })}
        >
          Help
        </button>
        <span className="separator">•</span>
        <button className="link-btn" onClick={() => setShowFeedback(true)}>Feedback</button>
      </footer>
    </div>
  );
}
