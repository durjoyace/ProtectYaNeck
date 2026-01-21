import React, { useEffect, useState } from 'react';
import { Settings, UsageData, RiskSeverity, STORAGE_KEYS } from '../shared/types';
import { DEFAULT_SETTINGS, DEFAULT_USAGE, FREE_SCANS_PER_MONTH, SEVERITY_COLORS } from '../shared/constants';

type Tab = 'general' | 'whitelist' | 'subscription' | 'history' | 'about';

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [usage, setUsage] = useState<UsageData>(DEFAULT_USAGE);
  const [newWhitelistUrl, setNewWhitelistUrl] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [licenseKey, setLicenseKey] = useState('');
  const [licenseStatus, setLicenseStatus] = useState<'none' | 'checking' | 'valid' | 'invalid'>('none');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const result = await chrome.storage.local.get([
      STORAGE_KEYS.SETTINGS,
      STORAGE_KEYS.USAGE,
    ]);

    if (result[STORAGE_KEYS.SETTINGS]) {
      setSettings(result[STORAGE_KEYS.SETTINGS]);
    }
    if (result[STORAGE_KEYS.USAGE]) {
      setUsage(result[STORAGE_KEYS.USAGE]);
      if (result[STORAGE_KEYS.USAGE].licenseKey) {
        setLicenseKey(result[STORAGE_KEYS.USAGE].licenseKey);
        setLicenseStatus('valid');
      }
    }
  }

  async function saveSettings(updates: Partial<Settings>) {
    setSaveStatus('saving');
    const newSettings = { ...settings, ...updates };
    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: newSettings });
    setSettings(newSettings);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  }

  function addToWhitelist() {
    if (!newWhitelistUrl.trim()) return;

    let hostname = newWhitelistUrl.trim();
    // Extract hostname if full URL provided
    try {
      if (hostname.includes('://')) {
        hostname = new URL(hostname).hostname;
      }
    } catch {
      // Keep as-is if not a valid URL
    }

    if (!settings.whitelist.includes(hostname)) {
      saveSettings({ whitelist: [...settings.whitelist, hostname] });
    }
    setNewWhitelistUrl('');
  }

  function removeFromWhitelist(hostname: string) {
    saveSettings({ whitelist: settings.whitelist.filter(h => h !== hostname) });
  }

  async function activateLicense() {
    if (!licenseKey.trim()) return;

    setLicenseStatus('checking');

    // In production, this would call your backend API
    // For now, simulate validation
    try {
      const response = await fetch('http://localhost:3001/api/subscription/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: licenseKey.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.valid) {
          const newUsage: UsageData = {
            ...usage,
            tier: 'paid',
            licenseKey: licenseKey.trim(),
          };
          await chrome.storage.local.set({ [STORAGE_KEYS.USAGE]: newUsage });
          setUsage(newUsage);
          setLicenseStatus('valid');
        } else {
          setLicenseStatus('invalid');
        }
      } else {
        setLicenseStatus('invalid');
      }
    } catch {
      // If backend not available, allow demo activation
      if (licenseKey.trim().startsWith('PYN-')) {
        const newUsage: UsageData = {
          ...usage,
          tier: 'paid',
          licenseKey: licenseKey.trim(),
        };
        await chrome.storage.local.set({ [STORAGE_KEYS.USAGE]: newUsage });
        setUsage(newUsage);
        setLicenseStatus('valid');
      } else {
        setLicenseStatus('invalid');
      }
    }
  }

  async function deactivateLicense() {
    const newUsage: UsageData = {
      ...usage,
      tier: 'free',
      licenseKey: undefined,
    };
    await chrome.storage.local.set({ [STORAGE_KEYS.USAGE]: newUsage });
    setUsage(newUsage);
    setLicenseKey('');
    setLicenseStatus('none');
  }

  const scansRemaining = Math.max(0, FREE_SCANS_PER_MONTH - usage.scansThisMonth);

  return (
    <div className="settings-page">
      <header className="settings-header">
        <div className="logo">
          <span className="shield">🛡️</span>
          <h1>ProtectYaNeck Settings</h1>
        </div>
        {saveStatus === 'saved' && (
          <span className="save-status">✓ Saved</span>
        )}
      </header>

      <div className="settings-container">
        <nav className="settings-nav">
          <button
            className={activeTab === 'general' ? 'active' : ''}
            onClick={() => setActiveTab('general')}
          >
            ⚙️ General
          </button>
          <button
            className={activeTab === 'whitelist' ? 'active' : ''}
            onClick={() => setActiveTab('whitelist')}
          >
            ✓ Whitelist
          </button>
          <button
            className={activeTab === 'subscription' ? 'active' : ''}
            onClick={() => setActiveTab('subscription')}
          >
            💳 Subscription
          </button>
          <button
            className={activeTab === 'history' ? 'active' : ''}
            onClick={() => setActiveTab('history')}
          >
            📋 History
          </button>
          <button
            className={activeTab === 'about' ? 'active' : ''}
            onClick={() => setActiveTab('about')}
          >
            ℹ️ About
          </button>
        </nav>

        <main className="settings-content">
          {activeTab === 'general' && (
            <section className="settings-section">
              <h2>General Settings</h2>

              <div className="setting-item">
                <div className="setting-info">
                  <label>Enable Protection</label>
                  <p>Scan pages for legal agreements and risks</p>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={settings.enabled}
                    onChange={(e) => saveSettings({ enabled: e.target.checked })}
                  />
                  <span className="slider"></span>
                </label>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label>Auto-Scan Pages</label>
                  <p>Automatically scan when agreements are detected</p>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={settings.autoScan}
                    onChange={(e) => saveSettings({ autoScan: e.target.checked })}
                  />
                  <span className="slider"></span>
                </label>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label>Show Overlay</label>
                  <p>Display risk summary overlay on pages</p>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={settings.showOverlay}
                    onChange={(e) => saveSettings({ showOverlay: e.target.checked })}
                  />
                  <span className="slider"></span>
                </label>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label>Notification Threshold</label>
                  <p>Minimum risk level to show notifications</p>
                </div>
                <select
                  value={settings.notificationLevel}
                  onChange={(e) => saveSettings({ notificationLevel: e.target.value as RiskSeverity })}
                >
                  <option value="low">All Risks</option>
                  <option value="medium">Medium and Above</option>
                  <option value="high">High and Above</option>
                  <option value="critical">Critical Only</option>
                </select>
              </div>
            </section>
          )}

          {activeTab === 'whitelist' && (
            <section className="settings-section">
              <h2>Whitelisted Sites</h2>
              <p className="section-description">
                Sites you trust won't be scanned automatically.
              </p>

              <div className="whitelist-add">
                <input
                  type="text"
                  placeholder="Enter domain (e.g., example.com)"
                  value={newWhitelistUrl}
                  onChange={(e) => setNewWhitelistUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addToWhitelist()}
                />
                <button onClick={addToWhitelist}>Add</button>
              </div>

              <div className="whitelist-items">
                {settings.whitelist.length === 0 ? (
                  <p className="empty-state">No sites whitelisted yet.</p>
                ) : (
                  settings.whitelist.map((hostname) => (
                    <div key={hostname} className="whitelist-item">
                      <span>{hostname}</span>
                      <button
                        className="remove-btn"
                        onClick={() => removeFromWhitelist(hostname)}
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          {activeTab === 'subscription' && (
            <section className="settings-section">
              <h2>Subscription</h2>

              <div className="subscription-status">
                <div className={`plan-badge ${usage.tier}`}>
                  {usage.tier === 'paid' ? '⭐ Pro' : 'Free'}
                </div>

                {usage.tier === 'free' ? (
                  <div className="usage-info">
                    <p><strong>{scansRemaining}</strong> scans remaining this month</p>
                    <div className="usage-bar">
                      <div
                        className="usage-fill"
                        style={{ width: `${(usage.scansThisMonth / FREE_SCANS_PER_MONTH) * 100}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="usage-info">
                    <p>Unlimited scans</p>
                    <p className="license-info">License: {usage.licenseKey}</p>
                  </div>
                )}
              </div>

              {usage.tier === 'free' ? (
                <>
                  <div className="upgrade-cta">
                    <h3>Upgrade to Pro</h3>
                    <ul>
                      <li>✓ Unlimited scans</li>
                      <li>✓ Advanced risk detection</li>
                      <li>✓ Scan history & export</li>
                      <li>✓ Priority support</li>
                    </ul>
                    <a
                      href="https://protectyaneck.com/upgrade"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-upgrade"
                    >
                      Upgrade Now - $9.99/month
                    </a>
                  </div>

                  <div className="license-activation">
                    <h3>Have a License Key?</h3>
                    <div className="license-input">
                      <input
                        type="text"
                        placeholder="PYN-XXXX-XXXX-XXXX"
                        value={licenseKey}
                        onChange={(e) => setLicenseKey(e.target.value)}
                      />
                      <button onClick={activateLicense} disabled={licenseStatus === 'checking'}>
                        {licenseStatus === 'checking' ? 'Checking...' : 'Activate'}
                      </button>
                    </div>
                    {licenseStatus === 'invalid' && (
                      <p className="error">Invalid license key. Please try again.</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="pro-management">
                  <button className="btn btn-secondary" onClick={deactivateLicense}>
                    Deactivate License
                  </button>
                  <a
                    href="https://protectyaneck.com/account"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                  >
                    Manage Subscription
                  </a>
                </div>
              )}
            </section>
          )}

          {activeTab === 'history' && (
            <section className="settings-section">
              <h2>Scan History</h2>
              <p className="section-description">
                {usage.tier === 'paid'
                  ? 'View your recent scans.'
                  : 'Upgrade to Pro to access scan history.'}
              </p>

              {usage.tier === 'paid' ? (
                <ScanHistory />
              ) : (
                <div className="pro-feature">
                  <span className="lock">🔒</span>
                  <p>Scan history is a Pro feature</p>
                  <a
                    href="https://protectyaneck.com/upgrade"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-upgrade-sm"
                  >
                    Upgrade to Pro
                  </a>
                </div>
              )}
            </section>
          )}

          {activeTab === 'about' && (
            <section className="settings-section">
              <h2>About ProtectYaNeck</h2>

              <div className="about-info">
                <p><strong>Version:</strong> 0.1.0</p>
                <p>
                  ProtectYaNeck helps you understand the legal agreements you
                  encounter online. We scan Terms of Service, Privacy Policies,
                  and sign-up agreements to highlight potential risks in plain language.
                </p>
              </div>

              <div className="about-links">
                <a href="https://protectyaneck.com" target="_blank" rel="noopener noreferrer">
                  Website
                </a>
                <a href="https://protectyaneck.com/privacy" target="_blank" rel="noopener noreferrer">
                  Privacy Policy
                </a>
                <a href="https://protectyaneck.com/terms" target="_blank" rel="noopener noreferrer">
                  Terms of Service
                </a>
                <a href="mailto:support@protectyaneck.com">
                  Contact Support
                </a>
              </div>

              <div className="feedback-section">
                <h3>Send Feedback</h3>
                <p>Help us improve ProtectYaNeck!</p>
                <a
                  href="https://protectyaneck.com/feedback"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                >
                  Send Feedback
                </a>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function ScanHistory() {
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    chrome.storage.local.get(STORAGE_KEYS.SCAN_HISTORY, (result) => {
      setHistory(result[STORAGE_KEYS.SCAN_HISTORY] || []);
    });
  }, []);

  if (history.length === 0) {
    return <p className="empty-state">No scans yet.</p>;
  }

  return (
    <div className="history-list">
      {history.slice(0, 20).map((scan, index) => (
        <div key={index} className="history-item">
          <div className="history-info">
            <span className="history-title">{scan.detection?.title || 'Unknown'}</span>
            <span className="history-url">{new URL(scan.url).hostname}</span>
            <span className="history-date">
              {new Date(scan.timestamp).toLocaleDateString()}
            </span>
          </div>
          <div
            className="history-severity"
            style={{ background: SEVERITY_COLORS[scan.overallSeverity as RiskSeverity] }}
          >
            {scan.risks?.length || 0} risks
          </div>
        </div>
      ))}
    </div>
  );
}
