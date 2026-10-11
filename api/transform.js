// api/transform.js
// Vercel serverless function — keeps your Anthropic API key server-side
// Deploy to Vercel and set ANTHROPIC_API_KEY in environment variables

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { bullet, prompt, type } = req.body;

  // Build the prompt based on request type
  let claudePrompt;
  if (type === 'general' && prompt) {
    // General purpose — used by the full app
    claudePrompt = prompt;
  } else if (bullet) {
    // Bullet transformer — used by the landing page demo
    claudePrompt = `You are a resume expert. Transform this weak resume bullet into 3 powerful versions.

IMPORTANT: Respond with ONLY a raw JSON object. No markdown. No code fences. No explanation. Start your response with { and end with }.

Weak bullet: "${bullet}"

Required JSON format:
{"versions":[{"label":"Solid","text":"improved version that sounds realistic and specific"},{"label":"Stronger","text":"version emphasizing business impact with plausible metrics added"},{"label":"Best","text":"highest-level strategic framing, most compelling version"}]}

Rules:
- Each version must start with a strong action verb
- Add plausible metrics if none exist (e.g. $ amounts, %, team size)
- Make each version genuinely different in framing
- Be specific — reference the actual work described
- Write naturally — avoid buzzwords, AI-sounding phrases, or over-the-top language
- Output ONLY the JSON object, nothing else`;
  } else {
    return res.status(400).json({ error: 'Missing bullet or prompt' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-5-5',
        max_tokens: 1500,
        messages: [{ role: 'user', content: claudePrompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic error:', err);
      return res.status(500).json({ error: 'AI request failed' });
    }

    const data = await response.json();
    const text = data.content?.map(b => b.text || '').join('\n') || '';

    // For bullet transformer, parse JSON response
    if (bullet || type !== 'general') {
      try {
        // Strip markdown fences first
        let clean = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
        // Extract the first complete JSON object (handles any leading/trailing text)
        const match = clean.match(/\{[\s\S]*\}/);
        if (match) clean = match[0];
        const parsed = JSON.parse(clean);
        return res.status(200).json(parsed);
      } catch (parseErr) {
        console.error('JSON parse failed, raw text:', text.slice(0, 200));
        return res.status(200).json({ text });
      }
    }

    return res.status(200).json({ text });
  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

