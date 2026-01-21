import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase, Feedback } from '../db/init';

const router = Router();

// Submit feedback
router.post('/', async (req: Request, res: Response) => {
  try {
    const { userId, type, message, pageUrl } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const db = await getDatabase();
    const now = Date.now();

    const feedback: Feedback = {
      id: uuidv4(),
      userId,
      type: type || 'general',
      message,
      pageUrl,
      createdAt: now,
    };

    db.data!.feedback.push(feedback);

    // Log analytics event
    db.data!.events.push({
      id: db.data!.events.length + 1,
      eventType: 'feedback_submitted',
      data: JSON.stringify({ feedbackId: feedback.id, type: feedback.type }),
      createdAt: now,
    });

    await db.write();

    console.log(`Feedback submitted: ${feedback.id}`);

    res.status(201).json({
      success: true,
      feedbackId: feedback.id,
    });

  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

export default router;
