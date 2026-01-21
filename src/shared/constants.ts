import { RiskCategory, RiskSeverity, Settings, UsageData } from './types';

// API Configuration
export const API_URL = process.env.API_URL || 'http://localhost:3001';

// Tier limits
export const FREE_SCANS_PER_MONTH = 5;
export const PAID_SCANS_PER_MONTH = Infinity;

// Default settings
export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  autoScan: true,
  showOverlay: true,
  notificationLevel: 'medium',
  whitelist: [],
};

// Default usage data
export const DEFAULT_USAGE: UsageData = {
  scansThisMonth: 0,
  monthStart: Date.now(),
  tier: 'free',
};

// Risk category metadata
export const RISK_CATEGORIES: Record<RiskCategory, {
  label: string;
  description: string;
  defaultSeverity: RiskSeverity;
  icon: string;
}> = {
  data_sharing: {
    label: 'Data Sharing',
    description: 'Your data may be shared with third parties',
    defaultSeverity: 'high',
    icon: '📤',
  },
  auto_renewal: {
    label: 'Auto-Renewal',
    description: 'Subscription automatically renews',
    defaultSeverity: 'medium',
    icon: '🔄',
  },
  third_party_access: {
    label: 'Third-Party Access',
    description: 'External parties can access your information',
    defaultSeverity: 'high',
    icon: '👥',
  },
  liability_waiver: {
    label: 'Liability Waiver',
    description: 'Company limits their responsibility',
    defaultSeverity: 'high',
    icon: '⚠️',
  },
  arbitration: {
    label: 'Arbitration Clause',
    description: 'You may waive your right to sue in court',
    defaultSeverity: 'critical',
    icon: '⚖️',
  },
  data_retention: {
    label: 'Data Retention',
    description: 'Your data may be kept indefinitely',
    defaultSeverity: 'medium',
    icon: '💾',
  },
  account_termination: {
    label: 'Account Termination',
    description: 'Account can be terminated without notice',
    defaultSeverity: 'medium',
    icon: '🚫',
  },
  jurisdiction: {
    label: 'Jurisdiction',
    description: 'Legal disputes governed by specific laws',
    defaultSeverity: 'low',
    icon: '🌍',
  },
};

// Severity colors
export const SEVERITY_COLORS: Record<RiskSeverity, string> = {
  low: '#22c55e',      // green
  medium: '#f59e0b',   // amber
  high: '#f97316',     // orange
  critical: '#ef4444', // red
};

// Agreement detection patterns
export const AGREEMENT_PATTERNS = {
  urlPatterns: [
    /terms/i,
    /tos/i,
    /privacy/i,
    /policy/i,
    /legal/i,
    /agreement/i,
    /conditions/i,
    /eula/i,
  ],
  titlePatterns: [
    /terms\s*(of\s*)?(service|use)/i,
    /privacy\s*policy/i,
    /user\s*agreement/i,
    /license\s*agreement/i,
    /cookie\s*policy/i,
    /terms\s*and\s*conditions/i,
  ],
  contentPatterns: [
    /by\s*(signing\s*up|registering|creating\s*an?\s*account|clicking|continuing)/i,
    /you\s*agree\s*to/i,
    /terms\s*of\s*(service|use)/i,
    /privacy\s*policy/i,
    /i\s*(accept|agree)/i,
  ],
};

// Risk detection keywords
export const RISK_KEYWORDS: Record<RiskCategory, string[]> = {
  data_sharing: [
    'share with third parties',
    'share your information',
    'disclose to partners',
    'sell your data',
    'transfer your information',
    'share with affiliates',
    'provide to advertisers',
  ],
  auto_renewal: [
    'automatically renew',
    'auto-renewal',
    'recurring billing',
    'subscription will renew',
    'cancel before',
    'billing cycle',
    'charged automatically',
  ],
  third_party_access: [
    'service providers',
    'third-party services',
    'contractors',
    'business partners',
    'access your information',
    'share with vendors',
  ],
  liability_waiver: [
    'limitation of liability',
    'not responsible for',
    'not liable for',
    'no warranty',
    'as is',
    'disclaim all warranties',
    'use at your own risk',
  ],
  arbitration: [
    'binding arbitration',
    'waive right to jury',
    'class action waiver',
    'arbitration agreement',
    'dispute resolution',
    'waive your right to participate in class action',
  ],
  data_retention: [
    'retain your data',
    'keep your information',
    'store indefinitely',
    'retain after termination',
    'data retention period',
    'preserve your data',
  ],
  account_termination: [
    'terminate at any time',
    'suspend your account',
    'without notice',
    'sole discretion',
    'terminate without cause',
    'revoke access',
  ],
  jurisdiction: [
    'governed by the laws of',
    'exclusive jurisdiction',
    'venue shall be',
    'subject to the laws',
    'courts of',
  ],
};
