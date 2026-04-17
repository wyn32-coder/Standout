// api/auth.js
// Sends a magic link to the user's email
// Called when user enters email on login screen

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
  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    // 1. Upsert user in Supabase
    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        email: email.toLowerCase().trim(),
        last_login_request: new Date().toISOString(),
      }),
    });

    const users = await upsertRes.json();
    const userId = Array.isArray(users) ? users[0]?.id : users?.id;

    // 2. Create a magic token (expires in 24 hours)
    const token = crypto.randomUUID() + crypto.randomUUID();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await fetch(`${SUPABASE_URL}/rest/v1/magic_tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        email: email.toLowerCase().trim(),
        token,
        expires_at: expires,
        used: false,
      }),
    });

    // 3. Send magic link email via Resend
    const loginUrl = `https://standouttoday.com/app.html?token=${token}`;

    if (RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'Standout <hello@standouttoday.com>',
          to: [email],
          subject: 'Your Standout login link',
          html: `
            <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;background:#09101a;border-radius:16px">
              <div style="margin-bottom:28px">
                <div style="display:inline-flex;align-items:center;gap:10px">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="32" height="32" rx="7" fill="#09101a" stroke="#f4722b" stroke-width="1.5"/>
                    <rect x="5" y="8" width="22" height="4" rx="2" fill="#f4722b"/>
                    <rect x="5" y="14" width="15" height="4" rx="2" fill="#f4722b" opacity="0.65"/>
                    <rect x="5" y="20" width="18" height="4" rx="2" fill="#f4722b" opacity="0.35"/>
                  </svg>
                  <span style="font-family:Georgia,serif;font-size:22px;color:#e8e2d9;font-style:italic">Standout</span>
                </div>
              </div>
              <h1 style="font-family:Georgia,serif;font-size:28px;color:#e8e2d9;margin:0 0 12px;font-weight:400;font-style:italic;line-height:1.2">Your login link is ready</h1>
              <p style="font-size:15px;color:rgba(232,226,217,.6);line-height:1.7;margin:0 0 28px">Click the button below to access your Standout account. This link expires in 24 hours and can only be used once.</p>
              <a href="${loginUrl}" style="display:block;background:#f4722b;color:#fff;text-align:center;padding:16px 24px;border-radius:10px;font-size:16px;font-weight:700;text-decoration:none;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;margin-bottom:20px">Open Standout →</a>
              <p style="font-size:12px;color:rgba(232,226,217,.3);line-height:1.6;margin:0">If you didn't request this, you can safely ignore this email. The link expires in 24 hours.<br/><br/>standouttoday.com</p>
            </div>
          `,
        }),
      });
    }

    console.log(`Magic link sent to ${email}: ${loginUrl}`);
    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Auth error:', err);
    return res.status(500).json({ error: 'Failed to send login link' });
  }
}
