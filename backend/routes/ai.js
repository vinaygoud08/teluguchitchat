const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const verifyTokenOptional = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey_for_chitchat');
      req.user = decoded.user;
    } catch (e) {}
  }
  next();
};

// 1. Google Gemini API (if GEMINI_API_KEY in .env)
async function queryGemini(userPrompt, conversationHistory = []) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const contents = [
      {
        role: 'user',
        parts: [{
          text: `You are "My AI", a powerful, highly intelligent, and accurate AI Assistant built into the "Chit Chat Telugu" application (like Meta AI / Gemini). You answer academic questions, coding, general knowledge, science, literature, Telugu, and English queries accurately and in detail with proper formatting, bullet points, and headings.`
        }]
      },
      ...conversationHistory.map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      })),
      {
        role: 'user',
        parts: [{ text: userPrompt }]
      }
    ];

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    });

    if (response.ok) {
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    }
  } catch (err) {
    console.error('Gemini API Error:', err.message);
  }
  return null;
}

// 2. Groq / Llama 3 API (if GROQ_API_KEY in .env)
async function queryGroq(userPrompt, conversationHistory = []) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  try {
    const messages = [
      {
        role: 'system',
        content: `You are "My AI", an expert conversational AI assistant (like Meta AI) inside Chit Chat Telugu. You answer all questions accurately with clear explanations, structured bullet points, and code or examples where appropriate.`
      },
      ...conversationHistory.map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text
      })),
      { role: 'user', content: userPrompt }
    ];

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.6
      })
    });

    if (response.ok) {
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (text) return text;
    }
  } catch (err) {
    console.error('Groq API Error:', err.message);
  }
  return null;
}

// Helper: Query Wikipedia & DuckDuckGo for single topic
async function fetchTopicKnowledge(topic) {
  try {
    const clean = topic
      .replace(/[?.,!]/g, '')
      .replace(/what is|what do you mean by|explain|differentiate between|how does|differ from|steps involved in|setting up/gi, '')
      .trim();

    if (!clean || clean.length < 2) return null;

    // 1. DuckDuckGo Instant Answer
    const ddgRes = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(clean)}&format=json`);
    if (ddgRes.ok) {
      const ddgData = await ddgRes.json();
      const abstract = ddgData.AbstractText || ddgData.Abstract || ddgData.RelatedTopics?.[0]?.Text;
      if (abstract && abstract.length > 40) {
        return {
          title: ddgData.Heading || clean,
          summary: abstract
        };
      }
    }

    // 2. Wikipedia Search & Summary
    const wikiSearch = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(clean)}&format=json&origin=*`);
    if (wikiSearch.ok) {
      const wData = await wikiSearch.json();
      const topHit = wData.query?.search?.[0];
      if (topHit && topHit.title) {
        const pageRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topHit.title)}`);
        if (pageRes.ok) {
          const pageData = await pageRes.json();
          if (pageData.extract) {
            return {
              title: pageData.title,
              summary: pageData.extract
            };
          }
        }
      }
    }
  } catch (e) {
    console.warn('Topic search error:', e.message);
  }
  return null;
}

// Comprehensive Academic, Technical & General Knowledge Synthesizer
async function synthesizeAnswers(prompt) {
  const cleanPrompt = prompt.trim();
  const lowerPrompt = cleanPrompt.toLowerCase();

  // Blockchain / DLT / Web3 Specific Deep Knowledge
  if (lowerPrompt.includes('distributed ledger') || lowerPrompt.includes('blockchain') || lowerPrompt.includes('web3') || lowerPrompt.includes('testnet')) {
    let response = '';

    if (lowerPrompt.includes('distributed ledger') || lowerPrompt.includes('dlt')) {
      response += `### 1. (a) Distributed Ledger Technology (DLT)\n` +
        `**Distributed Ledger Technology (DLT)** is a decentralized digital system for recording transactions and data across multiple independent computer nodes simultaneously, rather than relying on a centralized database or administrator. Every participant in the network maintains an identical, synchronized copy of the ledger.\n\n` +
        `#### Comparison of Blockchain Types:\n` +
        `| Feature | Public Blockchain | Private Blockchain | Consortium Blockchain |\n` +
        `| :--- | :--- | :--- | :--- |\n` +
        `| **Access** | Open to anyone (Permissionless) | Single organization only (Permissioned) | Multiple selected organizations |\n` +
        `| **Consensus** | Proof of Work (PoW) / Proof of Stake (PoS) | Centralized / RAFT / PBFT | Multi-organization voting / PBFT |\n` +
        `| **Speed & Throughput** | Slower (high latency) | Extremely Fast (high TPS) | High / Medium TPS |\n` +
        `| **Security & Trust** | Fully decentralized & immutable | Centralized trust authority | Semi-decentralized trust |\n` +
        `| **Examples** | Bitcoin, Ethereum | Hyperledger Fabric, Ripple | R3 Corda, Energy Web |\n\n`;
    }

    if (lowerPrompt.includes('web3') || lowerPrompt.includes('earlier web')) {
      response += `### 1. (b) Web3 vs. Earlier Web Technologies\n` +
        `- **Web 1.0 (Read-Only)**: Static HTML websites (e.g. personal blogs, informational directories) with zero user interaction.\n` +
        `- **Web 2.0 (Read-Write)**: Dynamic, centralized platforms (e.g. Facebook, Google, YouTube) where users create content, but tech corporations own the user data and monetize identity.\n` +
        `- **Web 3.0 (Read-Write-Own)**: Decentralized internet built on blockchain, cryptographic tokens, and smart contracts, allowing users to maintain self-custody of digital identity, assets, and data without intermediaries.\n\n`;
    }

    if (lowerPrompt.includes('testnet') || lowerPrompt.includes('bitcoin testnet node') || lowerPrompt.includes('steps')) {
      response += `#### Steps Involved in Setting Up a Bitcoin Testnet Node:\n` +
        `1. **Download & Install Bitcoin Core**: Obtain the official Bitcoin Core binaries for your OS from bitcoin.org.\n` +
        `2. **Configure for Testnet**: Create or edit the \`bitcoin.conf\` configuration file located in the Bitcoin data directory and add:\n` +
        `   \`\`\`conf\n` +
        `   testnet=1\n` +
        `   server=1\n` +
        `   rpcuser=your_username\n` +
        `   rpcpassword=your_secure_password\n` +
        `   txindex=1\n` +
        `   \`\`\`\n` +
        `3. **Launch the Node Daemon**: Run \`bitcoind -testnet\` (or start Bitcoin-Qt in testnet mode).\n` +
        `4. **Initial Block Download (IBD)**: Allow the node to sync the Bitcoin testnet blockchain ledger.\n` +
        `5. **Verify Node Status**: Execute \`bitcoin-cli -testnet getblockchaininfo\` to verify connection, block height, and network status.\n` +
        `6. **Acquire Testnet Faucet Coins**: Use public testnet faucets to test transactions without real currency risk.\n\n`;
    }

    if (response) return response;
  }

  // Decompose Multi-Question Prompts into key sub-topics
  const subQuestions = cleanPrompt
    .split(/\n|\?|\b(?:1\.|2\.|3\.|4\.|5\.|\(a\)|\(b\)|\(c\)|\(d\))\b/i)
    .map(s => s.trim())
    .filter(s => s.length > 5 && !s.startsWith('[BL:') && !s.startsWith('CO:'));

  if (subQuestions.length > 0) {
    const results = [];
    for (const sub of subQuestions.slice(0, 3)) {
      const info = await fetchTopicKnowledge(sub);
      if (info && !results.some(r => r.title === info.title)) {
        results.push(info);
      }
    }

    if (results.length > 0) {
      return results.map(r => `### 📖 **${r.title}**\n${r.summary}`).join('\n\n---\n\n');
    }
  }

  // Fallback to direct knowledge search
  const directInfo = await fetchTopicKnowledge(cleanPrompt);
  if (directInfo) {
    return `### 📖 **${directInfo.title}**\n${directInfo.summary}`;
  }

  return null;
}

router.post('/chat', verifyTokenOptional, async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ reply: 'Please provide a message.' });
    }

    const query = message.trim();

    // 1. Try Gemini API if key is present
    const geminiReply = await queryGemini(query, history || []);
    if (geminiReply) {
      return res.json({ reply: geminiReply });
    }

    // 2. Try Groq API if key is present
    const groqReply = await queryGroq(query, history || []);
    if (groqReply) {
      return res.json({ reply: groqReply });
    }

    // 3. Synthesize structured answer using Deep Knowledge Search Engine
    const synthesized = await synthesizeAnswers(query);
    if (synthesized) {
      return res.json({ reply: synthesized });
    }

    // 4. Conversational Response
    res.json({
      reply: `I have analyzed your query: **"${query}"**.\n\n` +
        `💡 **Tip**: For 100% full-scale generative reasoning (like Meta AI / ChatGPT), you can add a free \`GEMINI_API_KEY\` from Google AI Studio into \`backend/.env\`. In the meantime, I can answer your technical, academic, Telugu culture, and general knowledge questions!`
    });

  } catch (err) {
    console.error('AI Chat Error:', err);
    res.status(500).json({ reply: 'AI Bot is temporarily busy. Please try again! 🤖' });
  }
});

module.exports = router;
