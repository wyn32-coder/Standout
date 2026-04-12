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
    claudePrompt = `Transform this weak resume bullet into 3 powerful versions. Return ONLY valid JSON (no markdown, no explanation):
Weak bullet: "${bullet}"

{
  "versions": [
    {
      "label": "Conservative",
      "text": "improved version that sounds realistic and specific",
      "why": "what makes this stronger than the original"
    },
    {
      "label": "Impact-Forward",
      "text": "version emphasizing business impact with plausible metrics added",
      "why": "what makes this stronger"
    },
    {
      "label": "Executive",
      "text": "highest-level strategic framing for senior roles",
      "why": "what makes this stronger"
    }
  ]
}

Rules:
- Each version must start with a strong action verb
- Add plausible metrics if none exist (e.g. $ amounts, %, team size)
- Make each version genuinely different in framing
- Be specific — reference the actual work described`;
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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
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
        const clean = text.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(clean);
        return res.status(200).json(parsed);
      } catch {
        return res.status(200).json({ text });
      }
    }

    return res.status(200).json({ text });
  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

