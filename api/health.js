// api/health.js
// Health check endpoint — returns 200 healthy or 503 degraded
// Wire to UptimeRobot: GET https://standouttoday.com/api/health every 5 min

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const start = Date.now();
  const checks = {};

  // ── 1. Env vars present ───────────────────────────────────────────────────
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
  const hasSupabase = !!process.env.SUPABASE_URL;
  checks.env = {
    ok: hasAnthropicKey,
    anthropicKey: hasAnthropicKey,
    stripeKey: !!process.env.STRIPE_SECRET_KEY,
    supabaseUrl: hasSupabase,
  };

  // ── 2. Anthropic API — minimal ping ───────────────────────────────────────
  try {
    const aiStart = Date.now();
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-20240307',
        max_tokens: 5,
        messages: [{ role: 'user', content: 'Say ok' }],
      }),
    });
    checks.anthropic = {
      ok: aiRes.ok,
      status: aiRes.status,
      latencyMs: Date.now() - aiStart,
    };
  } catch (e) {
    checks.anthropic = { ok: false, error: e.message };
  }

  // ── 3. Supabase ───────────────────────────────────────────────────────────
  if (hasSupabase) {
    try {
      const sbKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;
      const sbStart = Date.now();
      const sbRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/`, {
        headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}` },
      });
      checks.supabase = { ok: sbRes.ok, status: sbRes.status, latencyMs: Date.now() - sbStart };
    } catch (e) {
      checks.supabase = { ok: false, error: e.message };
    }
  } else {
    checks.supabase = { ok: true, note: 'Not configured — skipped' };
  }

  // ── Overall ───────────────────────────────────────────────────────────────
  const allOk = checks.env.ok && checks.anthropic.ok && checks.supabase.ok;

  return res.status(allOk ? 200 : 503).json({
    status: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    totalMs: Date.now() - start,
    checks,
  });
}
