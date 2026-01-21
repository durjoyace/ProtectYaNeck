import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import fs from 'fs';

// Database schema
export interface User {
  id: string;
  email: string;
  stripeCustomerId?: string;
  tier: 'free' | 'paid';
  licenseKey?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Subscription {
  id: string;
  userId: string;
  stripeSubscriptionId?: string;
  status: string;
  plan: string;
  currentPeriodStart?: number;
  currentPeriodEnd?: number;
  createdAt: number;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  concern: string;
  message?: string;
  contactMethod: string;
  agreementUrl?: string;
  agreementTitle?: string;
  riskSummary?: string;
  risks?: string[];
  status: string;
  partnerId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Feedback {
  id: string;
  userId?: string;
  type: string;
  message: string;
  pageUrl?: string;
  createdAt: number;
}

export interface AnalyticsEvent {
  id: number;
  eventType: string;
  userId?: string;
  data?: string;
  createdAt: number;
}

export interface DatabaseSchema {
  users: User[];
  subscriptions: Subscription[];
  leads: Lead[];
  feedback: Feedback[];
  events: AnalyticsEvent[];
}

const defaultData: DatabaseSchema = {
  users: [],
  subscriptions: [],
  leads: [],
  feedback: [],
  events: [],
};

let db: Low<DatabaseSchema> | null = null;

export async function initDatabase(): Promise<Low<DatabaseSchema>> {
  const dataDir = path.join(__dirname, '../../data');

  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'db.json');
  const adapter = new JSONFile<DatabaseSchema>(dbPath);
  db = new Low<DatabaseSchema>(adapter, defaultData);

  await db.read();

  // Initialize with default data if empty
  if (!db.data) {
    db.data = defaultData;
    await db.write();
  }

  console.log('Database initialized successfully');
  return db;
}

export async function getDatabase(): Promise<Low<DatabaseSchema>> {
  if (!db) {
    return initDatabase();
  }
  await db.read();
  return db;
}

// Run initialization if called directly
if (require.main === module) {
  initDatabase().then(() => {
    console.log('Database setup complete');
  });
}
