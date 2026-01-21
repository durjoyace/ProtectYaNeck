import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import Stripe from 'stripe';
import { getDatabase, User } from '../db/init';

const router = Router();

// Initialize Stripe (will be null if no key configured)
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' })
  : null;

// Verify license key
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { licenseKey } = req.body;

    if (!licenseKey) {
      return res.status(400).json({ valid: false, error: 'License key required' });
    }

    const db = await getDatabase();
    const user = db.data!.users.find(u => u.licenseKey === licenseKey);

    if (!user) {
      return res.json({ valid: false, error: 'Invalid license key' });
    }

    // Check if subscription is still active
    const subscription = db.data!.subscriptions.find(s => s.userId === user.id);
    const now = Math.floor(Date.now() / 1000);

    if (subscription?.currentPeriodEnd && subscription.currentPeriodEnd < now) {
      return res.json({
        valid: false,
        error: 'Subscription expired',
        expiredAt: new Date(subscription.currentPeriodEnd * 1000).toISOString(),
      });
    }

    res.json({
      valid: true,
      tier: 'paid',
      email: user.email,
      expiresAt: subscription?.currentPeriodEnd
        ? new Date(subscription.currentPeriodEnd * 1000).toISOString()
        : null,
    });

  } catch (error) {
    console.error('Error verifying license:', error);
    res.status(500).json({ valid: false, error: 'Verification failed' });
  }
});

// Create checkout session
router.post('/checkout', async (req: Request, res: Response) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: 'Payment system not configured' });
    }

    const { email, plan = 'monthly' } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const priceId = plan === 'yearly'
      ? process.env.STRIPE_PRICE_ID_YEARLY
      : process.env.STRIPE_PRICE_ID_MONTHLY;

    if (!priceId) {
      return res.status(503).json({ error: 'Pricing not configured' });
    }

    const db = await getDatabase();
    let user = db.data!.users.find(u => u.email === email);

    // Create user if doesn't exist
    if (!user) {
      const now = Date.now();
      user = {
        id: uuidv4(),
        email,
        tier: 'free',
        createdAt: now,
        updatedAt: now,
      };
      db.data!.users.push(user);
      await db.write();
    }

    // Create or get Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ email });
      customerId = customer.id;

      const userIndex = db.data!.users.findIndex(u => u.id === user!.id);
      db.data!.users[userIndex].stripeCustomerId = customerId;
      await db.write();
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
      metadata: { userId: user.id },
    });

    res.json({ sessionId: session.id, url: session.url });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Get customer portal link
router.post('/portal', async (req: Request, res: Response) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: 'Payment system not configured' });
    }

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const db = await getDatabase();
    const user = db.data!.users.find(u => u.email === email);

    if (!user?.stripeCustomerId) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: process.env.FRONTEND_URL,
    });

    res.json({ url: session.url });

  } catch (error) {
    console.error('Error creating portal session:', error);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// Generate license key (internal use)
router.post('/generate-license', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    const licenseKey = `PYN-${uuidv4().substring(0, 4).toUpperCase()}-${uuidv4().substring(0, 4).toUpperCase()}-${uuidv4().substring(0, 4).toUpperCase()}`;

    const db = await getDatabase();
    const userIndex = db.data!.users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    db.data!.users[userIndex].licenseKey = licenseKey;
    db.data!.users[userIndex].tier = 'paid';
    db.data!.users[userIndex].updatedAt = Date.now();

    await db.write();

    res.json({ licenseKey });

  } catch (error) {
    console.error('Error generating license:', error);
    res.status(500).json({ error: 'Failed to generate license' });
  }
});

export default router;
