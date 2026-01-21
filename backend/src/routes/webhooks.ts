import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase, Subscription } from '../db/init';

const router = Router();

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' })
  : null;

// Stripe webhook handler
router.post('/stripe', async (req: Request, res: Response) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe not configured' });
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return res.status(400).json({ error: 'Missing signature or webhook secret' });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  const db = await getDatabase();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('Checkout completed:', session.id);

        if (session.subscription && session.metadata?.userId) {
          // Get subscription details
          const stripeSubscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );

          // Generate license key
          const licenseKey = `PYN-${uuidv4().substring(0, 4).toUpperCase()}-${uuidv4().substring(0, 4).toUpperCase()}-${uuidv4().substring(0, 4).toUpperCase()}`;

          // Update user
          const userIndex = db.data!.users.findIndex(u => u.id === session.metadata!.userId);
          if (userIndex !== -1) {
            db.data!.users[userIndex].tier = 'paid';
            db.data!.users[userIndex].licenseKey = licenseKey;
            db.data!.users[userIndex].updatedAt = Date.now();
          }

          // Create subscription record
          const subscription: Subscription = {
            id: uuidv4(),
            userId: session.metadata.userId,
            stripeSubscriptionId: stripeSubscription.id,
            status: stripeSubscription.status,
            plan: stripeSubscription.items.data[0]?.price?.recurring?.interval || 'monthly',
            currentPeriodStart: stripeSubscription.current_period_start,
            currentPeriodEnd: stripeSubscription.current_period_end,
            createdAt: Date.now(),
          };

          db.data!.subscriptions.push(subscription);

          // Log event
          db.data!.events.push({
            id: db.data!.events.length + 1,
            eventType: 'subscription_created',
            userId: session.metadata.userId,
            data: JSON.stringify({ subscriptionId: stripeSubscription.id, licenseKey }),
            createdAt: Date.now(),
          });

          await db.write();

          console.log(`Subscription created for user ${session.metadata.userId}`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const stripeSubscription = event.data.object as Stripe.Subscription;
        console.log('Subscription updated:', stripeSubscription.id);

        const subIndex = db.data!.subscriptions.findIndex(
          s => s.stripeSubscriptionId === stripeSubscription.id
        );

        if (subIndex !== -1) {
          db.data!.subscriptions[subIndex].status = stripeSubscription.status;
          db.data!.subscriptions[subIndex].currentPeriodStart = stripeSubscription.current_period_start;
          db.data!.subscriptions[subIndex].currentPeriodEnd = stripeSubscription.current_period_end;
          await db.write();
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const stripeSubscription = event.data.object as Stripe.Subscription;
        console.log('Subscription deleted:', stripeSubscription.id);

        const subIndex = db.data!.subscriptions.findIndex(
          s => s.stripeSubscriptionId === stripeSubscription.id
        );

        if (subIndex !== -1) {
          const subscription = db.data!.subscriptions[subIndex];
          subscription.status = 'canceled';

          // Downgrade user
          const userIndex = db.data!.users.findIndex(u => u.id === subscription.userId);
          if (userIndex !== -1) {
            db.data!.users[userIndex].tier = 'free';
          }

          // Log event
          db.data!.events.push({
            id: db.data!.events.length + 1,
            eventType: 'subscription_canceled',
            userId: subscription.userId,
            data: JSON.stringify({ subscriptionId: stripeSubscription.id }),
            createdAt: Date.now(),
          });

          await db.write();
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Payment failed for invoice:', invoice.id);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });

  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
