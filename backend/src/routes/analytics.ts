import { Router, Request, Response } from 'express';
import { getDatabase } from '../db/init';

const router = Router();

interface AnalyticsEvent {
  eventType: string;
  timestamp: number;
  sessionId: string;
  metadata?: Record<string, string | number | boolean>;
}

// Receive analytics events (batch)
router.post('/events', async (req: Request, res: Response) => {
  try {
    const { events } = req.body as { events: AnalyticsEvent[] };

    if (!events || !Array.isArray(events)) {
      return res.status(400).json({ error: 'Events array required' });
    }

    const db = await getDatabase();
    const now = Date.now();

    // Store each event
    for (const event of events) {
      db.data!.events.push({
        id: db.data!.events.length + 1,
        eventType: event.eventType,
        data: JSON.stringify({
          sessionId: event.sessionId,
          timestamp: event.timestamp,
          ...event.metadata,
        }),
        createdAt: now,
      });
    }

    await db.write();

    res.json({ received: events.length });

  } catch (error) {
    console.error('Error storing analytics:', error);
    res.status(500).json({ error: 'Failed to store analytics' });
  }
});

// Get analytics summary (admin only - would need auth in production)
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const db = await getDatabase();
    const events = db.data!.events;

    // Calculate summary statistics
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = now - (30 * 24 * 60 * 60 * 1000);

    const summary = {
      total: {
        installs: 0,
        scans: 0,
        agreementsDetected: 0,
        lawyerReferrals: 0,
        upgrades: 0,
        feedbackSubmitted: 0,
      },
      last24Hours: {
        scans: 0,
        lawyerReferrals: 0,
      },
      lastWeek: {
        scans: 0,
        lawyerReferrals: 0,
      },
      lastMonth: {
        scans: 0,
        lawyerReferrals: 0,
      },
      eventsByType: {} as Record<string, number>,
      uniqueSessions: new Set<string>(),
    };

    for (const event of events) {
      // Count by type
      summary.eventsByType[event.eventType] = (summary.eventsByType[event.eventType] || 0) + 1;

      // Parse data to get session
      try {
        const data = JSON.parse(event.data || '{}');
        if (data.sessionId) {
          summary.uniqueSessions.add(data.sessionId);
        }
      } catch {}

      // Count totals
      switch (event.eventType) {
        case 'extension_installed':
          summary.total.installs++;
          break;
        case 'scan_completed':
          summary.total.scans++;
          if (event.createdAt > oneDayAgo) summary.last24Hours.scans++;
          if (event.createdAt > oneWeekAgo) summary.lastWeek.scans++;
          if (event.createdAt > oneMonthAgo) summary.lastMonth.scans++;
          break;
        case 'agreement_detected':
          summary.total.agreementsDetected++;
          break;
        case 'lawyer_referral_submitted':
          summary.total.lawyerReferrals++;
          if (event.createdAt > oneDayAgo) summary.last24Hours.lawyerReferrals++;
          if (event.createdAt > oneWeekAgo) summary.lastWeek.lawyerReferrals++;
          if (event.createdAt > oneMonthAgo) summary.lastMonth.lawyerReferrals++;
          break;
        case 'upgrade_completed':
          summary.total.upgrades++;
          break;
        case 'feedback_submitted':
          summary.total.feedbackSubmitted++;
          break;
      }
    }

    res.json({
      ...summary,
      uniqueSessions: summary.uniqueSessions.size,
    });

  } catch (error) {
    console.error('Error getting analytics summary:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// Get events by type
router.get('/events/:eventType', async (req: Request, res: Response) => {
  try {
    const { eventType } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    const db = await getDatabase();
    const events = db.data!.events
      .filter(e => e.eventType === eventType)
      .slice(Number(offset), Number(offset) + Number(limit));

    res.json({ events, total: events.length });

  } catch (error) {
    console.error('Error getting events:', error);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

// Get daily stats for the last N days
router.get('/daily/:days', async (req: Request, res: Response) => {
  try {
    const days = Math.min(parseInt(req.params.days) || 30, 90);
    const db = await getDatabase();
    const events = db.data!.events;

    const dailyStats: Record<string, {
      scans: number;
      detections: number;
      referrals: number;
      installs: number;
    }> = {};

    // Initialize days
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      dailyStats[dateKey] = { scans: 0, detections: 0, referrals: 0, installs: 0 };
    }

    // Count events
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    for (const event of events) {
      if (event.createdAt < cutoff) continue;

      const dateKey = new Date(event.createdAt).toISOString().split('T')[0];
      if (!dailyStats[dateKey]) continue;

      switch (event.eventType) {
        case 'scan_completed':
          dailyStats[dateKey].scans++;
          break;
        case 'agreement_detected':
          dailyStats[dateKey].detections++;
          break;
        case 'lawyer_referral_submitted':
          dailyStats[dateKey].referrals++;
          break;
        case 'extension_installed':
          dailyStats[dateKey].installs++;
          break;
      }
    }

    res.json({ dailyStats });

  } catch (error) {
    console.error('Error getting daily stats:', error);
    res.status(500).json({ error: 'Failed to get daily stats' });
  }
});

export default router;
