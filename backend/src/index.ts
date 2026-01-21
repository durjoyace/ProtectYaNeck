import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

import leadsRouter from './routes/leads';
import subscriptionRouter from './routes/subscription';
import feedbackRouter from './routes/feedback';
import webhooksRouter from './routes/webhooks';
import analyticsRouter from './routes/analytics';
import bugsRouter from './routes/bugs';
import { initDatabase } from './db/init';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Middleware
app.use(cors({
  origin: [
    /chrome-extension:\/\/.*/,
    process.env.FRONTEND_URL || 'https://protectyaneck.com',
    'http://localhost:3000',
  ],
  credentials: true,
}));

// Stripe webhooks need raw body
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }));

// JSON body parser for other routes
app.use(express.json());

// Routes
app.use('/api/leads', leadsRouter);
app.use('/api/subscription', subscriptionRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/bugs', bugsRouter);
app.use('/webhooks', webhooksRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function start() {
  // Initialize database
  await initDatabase();

  app.listen(PORT, () => {
    console.log(`ProtectYaNeck API running on port ${PORT}`);
  });
}

start().catch(console.error);
