// api/stripe-webhook.js
// Handles Stripe payment confirmation and issues access tokens
// Set STRIPE_WEBHOOK_SECRET in Vercel environment variables

import Stripe from 'stripe';

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_details?.email;
    console.log(`✅ Payment received from: ${email}`);
    // In production: store email in a database (Supabase, PlanetScale, etc.)
    // and use it to validate access on the app side
    // For now: Stripe Payment Link handles the redirect to ?unlocked=true
  }

  res.status(200).json({ received: true });
}
