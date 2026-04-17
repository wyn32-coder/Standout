// api/auth.js — sends email via Gmail SMTP using nodemailer
const nodemailer = require('nodemailer');

module.exports = async function handler(req, res) {
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
  console.log('Supabase:', !!SUPABASE_URL, !!SUPABASE_SERVICE_KEY);
  console.log('Gmail:', !!GMAIL_USER, !!GMAIL_APP_PASSWORD);

  try {
    const headers = {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Prefer': 'resolution=merge-duplicates,return=representation',
    };

    // 1. Upsert user
    await fetch(`${SUPABASE_URL}/rest/v1/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email: email.toLowerCase().trim(),
        last_login_request: new Date().toISOString(),
      }),
    });

    // 2. Create magic token
    const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Date.now().toString(36);
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await fetch(`${SUPABASE_URL}/rest/v1/magic_tokens`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ email: email.toLowerCase().trim(), token, expires_at: expires, used: false }),
    });

    const loginUrl = `https://standouttoday.com/app.html?token=${token}`;
    console.log('Login URL:', loginUrl);

    // 3. Send via Gmail
    if (GMAIL_USER && GMAIL_APP_PASSWORD) {
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: GMAIL_USER,
          pass: GMAIL_APP_PASSWORD.replace(/\s/g, ''),
        },
      });

      const info = await transporter.sendMail({
        from: `"Standout" <${GMAIL_USER}>`,
        to: email,
        subject: 'Your Standout login link',
        html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#09101a;border-radius:16px">
          <p style="font-family:Georgia,serif;font-size:22px;color:#e8e2d9;font-style:italic;margin:0 0 20px">Standout</p>
          <h1 style="font-family:Georgia,serif;font-size:26px;color:#e8e2d9;margin:0 0 10px;font-weight:400">Your login link</h1>
          <p style="font-size:14px;color:rgba(232,226,217,.6);margin:0 0 24px">Click below to sign in. Link expires in 24 hours.</p>
          <a href="${loginUrl}" style="display:block;background:#f4722b;color:#fff;text-align:center;padding:15px;border-radius:10px;font-size:16px;font-weight:700;text-decoration:none;margin-bottom:16px">Open Standout →</a>
          <p style="font-size:11px;color:rgba(232,226,217,.25);margin:0">standouttoday.com</p>
        </div>`,
      });
      console.log('Email sent:', info.messageId);
    } else {
      console.log('No Gmail config — URL only:', loginUrl);
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Auth error:', err.message, err.stack);
    return res.status(500).json({ error: err.message });
  }
};
