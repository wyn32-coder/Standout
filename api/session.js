// api/session.js
// Verifies a magic token and returns user session
// Also handles save/load of user data

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  };

  // ── VERIFY TOKEN ──
  if (req.method === 'POST' && req.body?.action === 'verify') {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });

    try {
      // Get token record
      const tokenRes = await fetch(
        `${SUPABASE_URL}/rest/v1/magic_tokens?token=eq.${token}&used=eq.false&select=*`,
        { headers }
      );
      const tokens = await tokenRes.json();

      if (!tokens.length) {
        return res.status(401).json({ error: 'Invalid or expired link' });
      }

      const tokenRecord = tokens[0];

      // Check expiry
      if (new Date(tokenRecord.expires_at) < new Date()) {
        return res.status(401).json({ error: 'Login link has expired — request a new one' });
      }

      // Mark token as used
      await fetch(
        `${SUPABASE_URL}/rest/v1/magic_tokens?id=eq.${tokenRecord.id}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ used: true }),
        }
      );

      // Get or create user
      const userRes = await fetch(
        `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(tokenRecord.email)}&select=*`,
        { headers }
      );
      const users = await userRes.json();
      const user = users[0];

      if (!user) return res.status(404).json({ error: 'Account not found' });

      // Update last login
      await fetch(
        `${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ last_login: new Date().toISOString() }),
        }
      );

      // Load user's saved data
      const dataRes = await fetch(
        `${SUPABASE_URL}/rest/v1/user_data?user_id=eq.${user.id}&select=*`,
        { headers }
      );
      const dataRows = await dataRes.json();
      const savedData = dataRows[0]?.data || null;

      return res.status(200).json({
        ok: true,
        user: { id: user.id, email: user.email },
        savedData,
      });

    } catch (err) {
      console.error('Verify error:', err);
      return res.status(500).json({ error: 'Verification failed' });
    }
  }

  // ── VERIFY SUPABASE ACCESS TOKEN (from magic link hash) ──
  if (req.method === 'POST' && req.body?.action === 'verify_access_token') {
    const { accessToken } = req.body;
    if (!accessToken) return res.status(400).json({ error: 'Access token required' });

    try {
      // Get user info from Supabase using the access token
      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'apikey': SUPABASE_SERVICE_KEY,
        },
      });
      const userData = await userRes.json();
      console.log('Supabase user lookup:', userRes.status, userData?.email);

      if (!userData?.email) {
        return res.status(401).json({ error: 'Invalid access token' });
      }

      // Upsert user in our users table
      const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
        method: 'POST',
        headers: {
          ...headers,
          'Prefer': 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify({
          email: userData.email,
          last_login: new Date().toISOString(),
        }),
      });
      const users = await upsertRes.json();
      const userId = Array.isArray(users) ? users[0]?.id : users?.id;

      // Load saved data
      const dataRes = await fetch(
        `${SUPABASE_URL}/rest/v1/user_data?user_id=eq.${userId}&select=*`,
        { headers }
      );
      const dataRows = await dataRes.json();
      const savedData = dataRows[0]?.data || null;

      return res.status(200).json({
        ok: true,
        user: { id: userId, email: userData.email },
        savedData,
      });
    } catch (err) {
      console.error('verify_access_token error:', err);
      return res.status(500).json({ error: 'Verification failed' });
    }
  }

  // ── SAVE USER DATA ──
  if (req.method === 'POST' && req.body?.action === 'save') {
    const { userId, data } = req.body;
    if (!userId || !data) return res.status(400).json({ error: 'userId and data required' });

    try {
      await fetch(`${SUPABASE_URL}/rest/v1/user_data`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({
          user_id: userId,
          data,
          updated_at: new Date().toISOString(),
        }),
      });
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('Save error:', err);
      return res.status(500).json({ error: 'Save failed' });
    }
  }

  // ── LOAD USER DATA ──
  if (req.method === 'POST' && req.body?.action === 'load') {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    try {
      const dataRes = await fetch(
        `${SUPABASE_URL}/rest/v1/user_data?user_id=eq.${userId}&select=*`,
        { headers }
      );
      const rows = await dataRes.json();
      return res.status(200).json({ ok: true, data: rows[0]?.data || null });
    } catch (err) {
      console.error('Load error:', err);
      return res.status(500).json({ error: 'Load failed' });
    }
  }

  return res.status(400).json({ error: 'Unknown action' });
}
