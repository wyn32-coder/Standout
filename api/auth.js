// api/auth.js — uses Gmail SMTP via Nodemailer
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const GMAIL_USER = process.env.GMAIL_USER;
  const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

  console.log('Auth request for:', email);
  console.log('Supabase configured:', !!SUPABASE_URL && !!SUPABASE_SERVICE_KEY);
  console.log('Gmail configured:', !!GMAIL_USER && !!GMAIL_APP_PASSWORD);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const headers = {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Prefer': 'resolution=merge-duplicates,return=representation',
    };

    // 1. Upsert user
    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email: email.toLowerCase().trim(),
        last_login_request: new Date().toISOString(),
      }),
    });
    const upsertData = await upsertRes.json();
    console.log('Upsert result:', JSON.stringify(upsertData));

    // 2. Create magic token
    const token = [
      Math.random().toString(36).slice(2),
      Math.random().toString(36).slice(2),
      Date.now().toString(36)
    ].join('');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const tokenRes = await fetch(`${SUPABASE_URL}/rest/v1/magic_tokens`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        email: email.toLowerCase().trim(),
        token,
        expires_at: expires,
        used: false,
      }),
    });
    console.log('Token insert status:', tokenRes.status);

    // 3. Send email via Gmail SMTP
    const loginUrl = `https://standouttoday.com/app.html?token=${token}`;
    console.log('Login URL:', loginUrl);

    if (GMAIL_USER && GMAIL_APP_PASSWORD) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: GMAIL_USER,
          pass: GMAIL_APP_PASSWORD.replace(/\s/g, ''), // remove spaces if any
        },
      });

      await transporter.sendMail({
        from: `"Standout" <${GMAIL_USER}>`,
        to: email,
        subject: 'Your Standout login link',
        html: `
          <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:480px;margin:0 auto;background:#09101a;border-radius:16px;padding:40px 32px">
            <div style="font-family:Georgia,serif;font-size:24px;color:#e8e2d9;font-style:italic;margin-bottom:24px">Standout</div>
            <h1 style="font-family:Georgia,serif;font-size:28px;color:#e8e2d9;margin:0 0 12px;font-weight:400;font-style:italic">Your login link</h1>
            <p style="font-size:15px;color:rgba(232,226,217,.6);line-height:1.7;margin:0 0 28px">Click below to sign in to Standout. This link expires in 24 hours.</p>
            <a href="${loginUrl}" style="display:block;background:#f4722b;color:#fff;text-align:center;padding:16px 24px;border-radius:10px;font-size:16px;font-weight:700;text-decoration:none;margin-bottom:20px">Open Standout →</a>
            <p style="font-size:12px;color:rgba(232,226,217,.3);margin:0">If you didn't request this, ignore this email. · standouttoday.com</p>
          </div>
        `,
      });
      console.log('Gmail sent successfully to:', email);
    } else {
      console.log('NO GMAIL CONFIG — login URL:', loginUrl);
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Auth error:', err.message);
    return res.status(500).json({ error: 'Failed to send login link' });
  }
}

