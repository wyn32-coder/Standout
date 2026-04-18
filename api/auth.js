export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      supabase: !!process.env.SUPABASE_URL,
      anonKey: !!process.env.SUPABASE_ANON_KEY,
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body || {};
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  try {
    // Use magiclink type instead of otp
    const response = await fetch(`${SUPABASE_URL}/auth/v1/magiclink`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        email: email.toLowerCase().trim(),
      }),
    });

    const text = await response.text();
    console.log('Supabase magiclink response:', response.status, text);

    if (!response.ok) {
      return res.status(400).json({ error: 'Failed to send link — ' + text });
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Auth error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
