const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const MASTER_PASSWORD = process.env.MASTER_PASSWORD || 'ChangeThisPassword123!';
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Security Authentication Middleware
function checkAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${MASTER_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized: Invalid master password.' });
  }
  next();
}

// AI Gateway
app.post('/api/chat', checkAuth, async (req, res) => {
  const { messages, userLanguage } = req.body;

  if (!GROQ_API_KEY) {
    return res.status(500).json({ error: 'Server AI Key is missing. Check your environment settings.' });
  }

  const systemPrompt = `
You are a private, emotionally aware, natural, and respectful personal assistant.
Languages: You speak both Bengali (বাংলা) and English fluently. Reply in the language the user speaks to you, or in Bengali if userLanguage is 'bn-BD'.
Current Language: ${userLanguage || 'English'}.
Personality: Helpful, friendly, concise, and conversational. Never pretend to have biological feelings or true consciousness.
Safety: Confirm actions before finalizing sensitive tasks.
`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 1024
      })
    });

    const data = await response.json();
    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    res.json({ reply: data.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: 'Failed to communicate with AI inference engine.' });
  }
});

// Free DuckDuckGo Web Search Tool
app.get('/api/search', checkAuth, async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Query parameter required.' });

  try {
    const searchRes = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`);
    const data = await searchRes.json();
    res.json({
      abstract: data.AbstractText || 'No direct summary found.',
      source: data.AbstractSource || 'DuckDuckGo Open Index'
    });
  } catch (err) {
    res.status(500).json({ error: 'Search request failed.' });
  }
});

app.listen(PORT, () => {
  console.log(`Assistant server running securely on port ${PORT}`);
});
