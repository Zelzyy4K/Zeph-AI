require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  const { messages, model = 'mixtral-8x7b-32768', stream = true } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array required' });
  }

  try {
    if (stream) {
      const response = await groq.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: 'Anda adalah Zeph AI, asisten yang ramah, cerdas, dan membantu. Jawab dengan bahasa Indonesia yang natural dan jelas.' },
          ...messages,
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 2048,
      });

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let fullText = '';
      for await (const chunk of response) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullText += content;
          res.write(`data: ${JSON.stringify({ content, full: fullText })}\n\n`);
        }
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      const response = await groq.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: 'Anda adalah Zeph AI, asisten yang ramah, cerdas, dan membantu.' },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 2048,
      });
      const content = response.choices[0]?.message?.content || '';
      res.json({ content });
    }
  } catch (error) {
    console.error('Groq API Error:', error);
    res.status(500).json({
      error: 'Terjadi kesalahan pada AI. Silakan coba lagi.',
      details: error.message,
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// FALLBACK: Semua route ke index.html
app.get('*', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.listen(PORT, () => {
  console.log(`🚀 Zeph AI Server running on http://localhost:${PORT}`);
  console.log(`📡 API endpoint: http://localhost:${PORT}/api/chat`);
});
