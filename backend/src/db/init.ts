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

// Simple JSON file database
class JsonDatabase {
  private filePath: string;
  public data: DatabaseSchema;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.data = defaultData;
  }

  async read(): Promise<void> {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        this.data = JSON.parse(content);
      } else {
        this.data = { ...defaultData };
      }
    } catch (error) {
      console.error('Error reading database:', error);
      this.data = { ...defaultData };
    }
  }

  async write(): Promise<void> {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Error writing database:', error);
      throw error;
    }
  }
}

let db: JsonDatabase | null = null;

export async function initDatabase(): Promise<JsonDatabase> {
  const dataDir = path.join(process.cwd(), 'data');

  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'db.json');
  db = new JsonDatabase(dbPath);

  await db.read();

  // Initialize with default data if empty
  if (!db.data || !db.data.users) {
    db.data = { ...defaultData };
    await db.write();
  }

  console.log('Database initialized successfully');
  return db;
}

export async function getDatabase(): Promise<JsonDatabase> {
  if (!db) {
    return initDatabase();
  }
  await db.read();
  return db;
}
