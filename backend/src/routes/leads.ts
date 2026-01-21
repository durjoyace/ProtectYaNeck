import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase, Lead } from '../db/init';

const router = Router();

interface LeadRequest {
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
}

// Submit a new lead
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      name,
      email,
      phone,
      concern,
      message,
      contactMethod,
      agreementUrl,
      agreementTitle,
      riskSummary,
      risks,
    }: LeadRequest = req.body;

    // Validation
    if (!name || !email || !concern) {
      return res.status(400).json({ error: 'Name, email, and concern are required' });
    }

    if (!email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const db = await getDatabase();
    const now = Date.now();

    const lead: Lead = {
      id: uuidv4(),
      name,
      email,
      phone,
      concern,
      message,
      contactMethod: contactMethod || 'email',
      agreementUrl,
      agreementTitle,
      riskSummary,
      risks,
      status: 'new',
      createdAt: now,
      updatedAt: now,
    };

    db.data!.leads.push(lead);

    // Log analytics event
    db.data!.events.push({
      id: db.data!.events.length + 1,
      eventType: 'lead_submitted',
      data: JSON.stringify({ leadId: lead.id, concern }),
      createdAt: now,
    });

    await db.write();

    console.log(`New lead submitted: ${lead.id} - ${email}`);

    res.status(201).json({
      success: true,
      leadId: lead.id,
      message: 'Your request has been submitted. A legal professional will contact you soon.',
    });

  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({ error: 'Failed to submit lead' });
  }
});

// Get lead status (for admin/partners)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const db = await getDatabase();
    const lead = db.data!.leads.find(l => l.id === id);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json({ lead });

  } catch (error) {
    console.error('Error fetching lead:', error);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

// Update lead status (for admin/partners)
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, partnerId } = req.body;

    const db = await getDatabase();
    const leadIndex = db.data!.leads.findIndex(l => l.id === id);

    if (leadIndex === -1) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    db.data!.leads[leadIndex] = {
      ...db.data!.leads[leadIndex],
      status,
      partnerId,
      updatedAt: Date.now(),
    };

    await db.write();

    res.json({ success: true });

  } catch (error) {
    console.error('Error updating lead:', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

export default router;
