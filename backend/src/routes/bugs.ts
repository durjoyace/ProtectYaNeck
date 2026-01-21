import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db/init';

const router = Router();

interface BugReport {
  title: string;
  description: string;
  steps?: string;
  expected?: string;
  actual?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'detection' | 'analysis' | 'ui' | 'performance' | 'crash' | 'other';
  diagnostics: {
    extensionVersion: string;
    browserInfo: string;
    platform: string;
    pageUrl: string;
    pageTitle: string;
    timestamp: number;
    settings: Record<string, unknown>;
    usage: Record<string, unknown>;
    recentErrors: string[];
    lastScanResult?: string;
  };
}

// Submit a bug report
router.post('/', async (req: Request, res: Response) => {
  try {
    const report = req.body as BugReport;

    if (!report.title || !report.description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }

    const db = await getDatabase();
    const now = Date.now();
    const reportId = uuidv4();

    // Store in feedback with type 'bug'
    db.data!.feedback.push({
      id: reportId,
      type: 'bug',
      message: JSON.stringify({
        title: report.title,
        description: report.description,
        steps: report.steps,
        expected: report.expected,
        actual: report.actual,
        severity: report.severity,
        category: report.category,
      }),
      pageUrl: report.diagnostics.pageUrl,
      createdAt: now,
    });

    // Log as analytics event
    db.data!.events.push({
      id: db.data!.events.length + 1,
      eventType: 'bug_report_submitted',
      data: JSON.stringify({
        reportId,
        severity: report.severity,
        category: report.category,
        extensionVersion: report.diagnostics.extensionVersion,
        platform: report.diagnostics.platform,
        hasErrors: report.diagnostics.recentErrors.length > 0,
      }),
      createdAt: now,
    });

    await db.write();

    console.log(`Bug report submitted: ${reportId} - ${report.title} (${report.severity})`);

    res.status(201).json({
      success: true,
      reportId,
      message: 'Bug report submitted successfully',
    });

  } catch (error) {
    console.error('Error submitting bug report:', error);
    res.status(500).json({ error: 'Failed to submit bug report' });
  }
});

// Get bug reports (admin endpoint - would need auth in production)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { severity, category, limit = 50 } = req.query;

    const db = await getDatabase();
    let reports = db.data!.feedback.filter(f => f.type === 'bug');

    // Filter by severity or category if provided
    if (severity || category) {
      reports = reports.filter(r => {
        try {
          const data = JSON.parse(r.message);
          if (severity && data.severity !== severity) return false;
          if (category && data.category !== category) return false;
          return true;
        } catch {
          return false;
        }
      });
    }

    // Sort by most recent first
    reports = reports
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, Number(limit));

    // Parse message data
    const parsedReports = reports.map(r => {
      try {
        const data = JSON.parse(r.message);
        return {
          id: r.id,
          ...data,
          pageUrl: r.pageUrl,
          createdAt: r.createdAt,
        };
      } catch {
        return {
          id: r.id,
          message: r.message,
          pageUrl: r.pageUrl,
          createdAt: r.createdAt,
        };
      }
    });

    res.json({ reports: parsedReports, total: parsedReports.length });

  } catch (error) {
    console.error('Error getting bug reports:', error);
    res.status(500).json({ error: 'Failed to get bug reports' });
  }
});

// Get a specific bug report
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const db = await getDatabase();
    const report = db.data!.feedback.find(f => f.id === id && f.type === 'bug');

    if (!report) {
      return res.status(404).json({ error: 'Bug report not found' });
    }

    try {
      const data = JSON.parse(report.message);
      res.json({
        id: report.id,
        ...data,
        pageUrl: report.pageUrl,
        createdAt: report.createdAt,
      });
    } catch {
      res.json(report);
    }

  } catch (error) {
    console.error('Error getting bug report:', error);
    res.status(500).json({ error: 'Failed to get bug report' });
  }
});

// Get bug statistics
router.get('/stats/summary', async (req: Request, res: Response) => {
  try {
    const db = await getDatabase();
    const reports = db.data!.feedback.filter(f => f.type === 'bug');

    const stats = {
      total: reports.length,
      bySeverity: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      } as Record<string, number>,
      byCategory: {} as Record<string, number>,
      last7Days: 0,
      last30Days: 0,
    };

    const now = Date.now();
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = now - (30 * 24 * 60 * 60 * 1000);

    for (const report of reports) {
      try {
        const data = JSON.parse(report.message);

        // Count by severity
        if (data.severity) {
          stats.bySeverity[data.severity] = (stats.bySeverity[data.severity] || 0) + 1;
        }

        // Count by category
        if (data.category) {
          stats.byCategory[data.category] = (stats.byCategory[data.category] || 0) + 1;
        }
      } catch {}

      // Count by time
      if (report.createdAt > oneWeekAgo) stats.last7Days++;
      if (report.createdAt > oneMonthAgo) stats.last30Days++;
    }

    res.json(stats);

  } catch (error) {
    console.error('Error getting bug stats:', error);
    res.status(500).json({ error: 'Failed to get bug stats' });
  }
});

export default router;
