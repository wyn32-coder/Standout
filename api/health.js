// api/health.js
// Health check endpoint — ping this to verify all services are working
// Used by UptimeRobot (or any monitor) to catch outages before customers do

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const start = Date.now();
  const checks = {};

  // ── 1. Anthropic API ──────────────────────────────────────────────────────
  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Reply with: ok' }],
      }),
    });
    const aiData = await aiRes.json();
    checks.anthropic = {
      ok: aiRes.ok && aiData?.content?.[0]?.text,
      status: aiRes.status,
      latencyMs: Date.now() - start,
    };
  } catch (e) {
    checks.anthropic = { ok: false, error: e.message };
  }

  // ── 2. Supabase ───────────────────────────────────────────────────────────
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (supabaseUrl && supabaseKey) {
    try {
      const sbStart = Date.now();
      const sbRes = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
      });
      checks.supabase = { ok: sbRes.ok, status: sbRes.status, latencyMs: Date.now() - sbStart };
    } catch (e) {
      checks.supabase = { ok: false, error: e.message };
    }
  } else {
    checks.supabase = { ok: null, note: 'Not configured' };
  }

  // ── 3. Env vars ───────────────────────────────────────────────────────────
  checks.env = {
    anthropicKey: !!process.env.ANTHROPIC_API_KEY,
    stripeKey: !!process.env.STRIPE_SECRET_KEY,
    supabaseUrl: !!process.env.SUPABASE_URL,
  };

  // ── Overall status ────────────────────────────────────────────────────────
  const allOk = checks.anthropic.ok && (checks.supabase.ok !== false);
  const httpStatus = allOk ? 200 : 503;

  return res.status(httpStatus).json({
    status: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    totalMs: Date.now() - start,
    checks,
  });
}
