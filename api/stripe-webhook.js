// api/stripe-webhook.js
// When someone buys: creates their account, sends magic link access email

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
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;

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

    if (email && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      const headers = {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'resolution=merge-duplicates,return=representation',
      };

      // 1. Create/update user account
      const userRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: email.toLowerCase(),
          is_paid: true,
          stripe_customer_id: session.customer || null,
          last_login_request: new Date().toISOString(),
        }),
      });
      const users = await userRes.json();
      const userId = Array.isArray(users) ? users[0]?.id : users?.id;
      console.log(`✅ Account created/updated for: ${email}`);

      // 2. Create magic token for instant access
      const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Date.now().toString(36);
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days for purchase link

      await fetch(`${SUPABASE_URL}/rest/v1/magic_tokens`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ email: email.toLowerCase(), token, expires_at: expires, used: false }),
      });

      // 3. Send branded access email
      const loginUrl = `https://standouttoday.com/app.html?token=${token}`;

      if (RESEND_API_KEY) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({
            from: 'Standout <standouttodayhelp@gmail.com>',
            to: [email],
            subject: "You're in — your Standout access is ready ✦",
            html: `
              <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;background:#09101a;border-radius:16px;overflow:hidden">
                <div style="background:#f4722b;padding:20px 28px;display:flex;align-items:center;gap:12px">
                  <span style="font-family:Georgia,serif;font-size:22px;color:#fff;font-style:italic">Standout</span>
                  <span style="font-size:13px;color:rgba(255,255,255,.7);margin-left:auto">Founder Access ✦</span>
                </div>
                <div style="padding:32px 28px">
                  <h1 style="font-family:Georgia,serif;font-size:30px;color:#e8e2d9;margin:0 0 10px;font-weight:400;font-style:italic">You're in. Welcome to Standout.</h1>
                  <p style="font-size:15px;color:rgba(232,226,217,.6);line-height:1.7;margin:0 0 28px">All 9 career tools are unlocked. Click below to open your account — everything is saved to your email so you can access it from any device.</p>
                  <a href="${loginUrl}" style="display:block;background:#f4722b;color:#fff;text-align:center;padding:16px;border-radius:10px;font-size:16px;font-weight:700;text-decoration:none;margin-bottom:24px">Open Standout →</a>
                  <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:18px 20px;margin-bottom:24px">
                    <div style="font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#f4722b;margin-bottom:12px">What's unlocked</div>
                    <div style="font-size:14px;color:rgba(232,226,217,.65);line-height:2">
                      ✦ Resume Builder — unlimited generations<br/>
                      ✦ Career Positioning — your anchor for everything<br/>
                      ✦ Bullet Transformer — 3 versions per bullet<br/>
                      ✦ Recruiter Feedback — grade + callback probability<br/>
                      ✦ 6-Second Recruiter Simulation<br/>
                      ✦ Market Comparison — your percentile ranking<br/>
                      ✦ Role Intelligence — 6 role types<br/>
                      ✦ Coaching Mode — turns stories into bullets<br/>
                      ✦ Cover Letter — auto-filled from your resume
                    </div>
                  </div>
                  <p style="font-size:13px;color:rgba(232,226,217,.3);line-height:1.6;margin:0">This link logs you in automatically and is valid for 7 days. After that, just visit standouttoday.com and sign in with this email to get a fresh link.<br/><br/>Questions? Reply to this email — we read every one.</p>
                </div>
              </div>
            `,
          }),
        });
        console.log(`📧 Access email sent to: ${email} — ${loginUrl}`);
      }
    }
  }

  res.status(200).json({ received: true });
}
