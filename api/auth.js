// api/auth.js — uses Supabase built-in magic link auth
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

  try {
    // Use Supabase's built-in magic link — handles email automatically
    const response = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        email: email.toLowerCase().trim(),
        create_user: true,
      }),
    });

    const data = await response.json();
    console.log('Supabase OTP response:', response.status, JSON.stringify(data));

    if (!response.ok) {
      return res.status(400).json({ error: data.message || 'Failed to send link' });
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Auth error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
