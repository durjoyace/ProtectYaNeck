// Risk severity levels
export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

// Risk categories
export type RiskCategory =
  | 'data_sharing'
  | 'auto_renewal'
  | 'third_party_access'
  | 'liability_waiver'
  | 'arbitration'
  | 'data_retention'
  | 'account_termination'
  | 'jurisdiction';

// A detected risk item
export interface RiskItem {
  id: string;
  category: RiskCategory;
  severity: RiskSeverity;
  title: string;
  summary: string;
  originalText: string;
  location?: {
    startIndex: number;
    endIndex: number;
  };
}

// Agreement detection result
export interface AgreementDetection {
  isAgreement: boolean;
  confidence: number; // 0-1
  type: 'tos' | 'privacy' | 'signup' | 'cookie' | 'unknown';
  title?: string;
  url: string;
}

// Scan result
export interface ScanResult {
  id: string;
  url: string;
  timestamp: number;
  detection: AgreementDetection;
  risks: RiskItem[];
  overallSeverity: RiskSeverity;
  summary: string;
}

// User tier
export type UserTier = 'free' | 'paid';

// Usage tracking
export interface UsageData {
  scansThisMonth: number;
  monthStart: number; // timestamp
  tier: UserTier;
  licenseKey?: string;
}

// Extension settings
export interface Settings {
  enabled: boolean;
  autoScan: boolean;
  showOverlay: boolean;
  notificationLevel: RiskSeverity;
  whitelist: string[];
}

// Message types for communication between scripts
export type MessageType =
  | 'SCAN_PAGE'
  | 'SCAN_RESULT'
  | 'GET_USAGE'
  | 'UPDATE_SETTINGS'
  | 'SHOW_OVERLAY'
  | 'HIDE_OVERLAY';

export interface ExtensionMessage {
  type: MessageType;
  payload?: unknown;
}

// Storage keys
export const STORAGE_KEYS = {
  USAGE: 'pyn_usage',
  SETTINGS: 'pyn_settings',
  SCAN_HISTORY: 'pyn_history',
} as const;
