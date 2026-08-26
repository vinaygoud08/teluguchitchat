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

// 1. Google Gemini API
async function queryGemini(userPrompt, conversationHistory = []) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const contents = [
      {
        role: 'user',
        parts: [{
          text: `You are "My AI", a powerful, friendly, and ultra-intelligent AI Assistant inside "Chit Chat Telugu" (like Meta AI and ChatGPT). You can chat naturally, answer all technical and academic questions, write code, tell stories, give advice, and converse fluently in Telugu (తెలుగు) and English.`
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

// 2. Groq API (Llama 3.3 70B)
async function queryGroq(userPrompt, conversationHistory = []) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  try {
    const messages = [
      {
        role: 'system',
        content: `You are "My AI", a smart, natural, and helpful AI assistant (like Meta AI) inside Chit Chat Telugu. You speak Telugu (తెలుగు) and English fluently. Answer questions clearly, accurately, and politely.`
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
        temperature: 0.7
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

// 3. Live Web & Wikipedia Search for real-time information
async function fetchDeepKnowledge(topic) {
  try {
    const cleanTopic = topic
      .replace(/[?.,!]/g, '')
      .replace(/who is|what is|tell me about|explain|meaning of|గురించి చెప్పు|ఎవరు|ఏంటి|code for|program for/gi, '')
      .trim();

    if (!cleanTopic || cleanTopic.length < 2) return null;

    // Search English Wikipedia
    const searchRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanTopic)}&format=json&origin=*`);
    if (searchRes.ok) {
      const sData = await searchRes.json();
      const topHit = sData.query?.search?.[0];
      if (topHit && topHit.title) {
        const pageRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topHit.title)}`);
        if (pageRes.ok) {
          const pData = await pageRes.json();
          if (pData.extract) {
            return {
              title: pData.title,
              extract: pData.extract,
              description: pData.description || ''
            };
          }
        }
      }
    }
  } catch (e) {
    console.warn('Deep knowledge search error:', e.message);
  }
  return null;
}

// 4. Code & Programming Solver
function generateCodeSnippet(query) {
  const q = query.toLowerCase();

  if (q.includes('fibonacci')) {
    return `### 💻 Fibonacci Series in Python & JavaScript\n\n**Python Solution:**\n\`\`\`python\ndef fibonacci(n):\n    fib = [0, 1]\n    for i in range(2, n):\n        fib.append(fib[i-1] + fib[i-2])\n    return fib[:n]\n\nprint(fibonacci(10))\n\`\`\`\n\n**JavaScript Solution:**\n\`\`\`javascript\nfunction fibonacci(n) {\n  const fib = [0, 1];\n  for (let i = 2; i < n; i++) {\n    fib.push(fib[i - 1] + fib[i - 2]);\n  }\n  return fib.slice(0, n);\n}\n\nconsole.log(fibonacci(10));\n\`\`\``;
  }

  if (q.includes('prime number') || q.includes('prime')) {
    return `### 💻 Check Prime Number in Python\n\n\`\`\`python\ndef is_prime(num):\n    if num <= 1:\n        return False\n    for i in range(2, int(num**0.5) + 1):\n        if num % i == 0:\n            return False\n    return True\n\nnumber = 29\nprint(f"{number} is prime: {is_prime(number)}")\n\`\`\``;
  }

  if (q.includes('binary search')) {
    return `### 💻 Binary Search Algorithm\n\n\`\`\`python\ndef binary_search(arr, target):\n    low, high = 0, len(arr) - 1\n    while low <= high:\n        mid = (low + high) // 2\n        if arr[mid] == target:\n            return mid\n        elif arr[mid] < target:\n            low = mid + 1\n        else:\n            high = mid - 1\n    return -1 # Not found\n\`\`\``;
  }

  if (q.includes('react') || q.includes('hook') || q.includes('component')) {
    return `### ⚛️ Modern React Component Example\n\n\`\`\`jsx\nimport React, { useState, useEffect } from 'react';\n\nfunction Counter() {\n  const [count, setCount] = useState(0);\n\n  return (\n    <div style={{ textAlign: 'center', padding: '20px' }}>\n      <h2>Count: {count}</h2>\n      <button onClick={() => setCount(count + 1)}>Increment ➕</button>\n      <button onClick={() => setCount(0)} style={{ marginLeft: '10px' }}>Reset 🔄</button>\n    </div>\n  );\n}\n\nexport default Counter;\n\`\`\``;
  }

  return null;
}

// 5. Intelligent Multi-Domain Conversational Engine (Meta AI Style)
async function generateMetaAiResponse(query, history = []) {
  const q = query.trim();
  const lower = q.toLowerCase();

  // A. Check for Programming / Code queries
  if (lower.includes('code') || lower.includes('program') || lower.includes('function') || lower.includes('algorithm') || lower.includes('fibonacci') || lower.includes('prime number')) {
    const codeAns = generateCodeSnippet(q);
    if (codeAns) return codeAns;
  }

  // B. Check for Academic / Distributed Ledger / Blockchain
  if (lower.includes('distributed ledger') || lower.includes('blockchain') || lower.includes('web3') || lower.includes('testnet')) {
    return `### 1. (a) Distributed Ledger Technology (DLT)\n` +
      `**Distributed Ledger Technology (DLT)** is a decentralized digital database replicated, synchronized, and spread across multiple network nodes without relying on a central authority.\n\n` +
      `#### Comparison Table:\n` +
      `| Feature | Public Blockchain | Private Blockchain | Consortium Blockchain |\n` +
      `| :--- | :--- | :--- | :--- |\n` +
      `| **Access** | Permissionless (Anyone can join) | Permissioned (Single entity controls) | Selected group of organizations |\n` +
      `| **Consensus** | Proof-of-Work / Proof-of-Stake | Centralized / RAFT | Multi-party PBFT / Voting |\n` +
      `| **Speed** | 7–50 TPS (Moderate) | 1,000+ TPS (Very fast) | 100–1,000 TPS (High) |\n` +
      `| **Examples** | Bitcoin, Ethereum | Hyperledger Fabric | R3 Corda, Energy Web |\n\n` +
      `### 1. (b) Web3 vs Earlier Web Generations\n` +
      `- **Web 1.0 (Read)**: Static web pages, informational directories.\n` +
      `- **Web 2.0 (Read + Write)**: Centralized platforms (Facebook, YouTube), corporations own user data.\n` +
      `- **Web 3.0 (Read + Write + Own)**: Decentralized internet powered by blockchain and smart contracts, enabling true digital ownership and self-custody.\n\n` +
      `#### Bitcoin Testnet Node Setup:\n` +
      `1. Download official **Bitcoin Core**.\n` +
      `2. Add \`testnet=1\` and \`server=1\` to \`bitcoin.conf\`.\n` +
      `3. Start daemon with \`bitcoind -testnet\`.\n` +
      `4. Verify sync status with \`bitcoin-cli -testnet getblockchaininfo\`.\n` +
      `5. Get free coins from public testnet faucets.`;
  }

  // C. Casual Chat & Personalities
  if (/^(hi|hello|hey|namaste|namaskaram|నమస్కారం|హలో|హాయ్|hola)\b/i.test(lower)) {
    return `నమస్కారం! 🙏 నేను మీ **My AI** (Chit Chat Telugu Assistant).\n\nనేను మీకు ఎలా సహాయపడగలను? మీరు నన్ను:\n- 📚 ఏదైనా చదువు / ఎగ్జామ్ ప్రశ్నలు\n- 💻 కోడింగ్ & ప్రాబ్లమ్ సాల్వింగ్\n- 🎬 సినిమా & ఎంటర్‌టైన్‌మెంట్ విషయాలు\n- 🍲 రుచికరమైన వంటల రెసిపీలు\n- 💡 తెలుగు సామెతలు, జోకులు & కథలు\n- 🤖 చిట్ చాట్ తెలుగు యాప్ ఫీచర్లు\nగురించి అడగవచ్చు! ఏం మాట్లాడదాం? ✨`;
  }

  if (lower.includes('who are you') || lower.includes('nuvvu evaru') || lower.includes('మీరు ఎవరు') || lower.includes('about yourself')) {
    return `🤖 నేను **My AI** — Chit Chat Telugu యాప్‌లో మీ పర్సనల్ స్మార్ట్ AI అసిస్టెంట్ ని!\n\nనేను ChatGPT మరియు Meta AI తరహాలో తెలుగు మరియు ఇంగ్లీషులో ఎలాంటి ప్రశ్నలకైనా వేగంగా మరియు కచ్చితంగా సమాధానాలు ఇవ్వగలను. 🚀`;
  }

  if (lower.includes('joke') || lower.includes('జోక్') || lower.includes('comedy')) {
    const jokes = [
      "😂 **తెలుగు జోక్**:\nటీచర్: 'తాజ్‌మహల్ ఎక్కడ ఉంది?'\nస్టూడెంట్: 'నా ఫోన్ వాల్‌పేపర్‌లో ఉంది టీచర్!' 📱🤣",
      "😄 **సరదా సంభాషణ**:\nఫ్రెండ్ 1: 'బాస్ నన్ను చాలా పొగిడారురా!'\nఫ్రెండ్ 2: 'ఏమని?'\nఫ్రెండ్ 1: 'నువ్వు పనికి రాని వాడివి అని ఒప్పుకున్నావు కదా, కనీసం నిజాయితీ ఉంది అని!' 🤦‍♂️😂"
    ];
    return jokes[Math.floor(Math.random() * jokes.length)];
  }

  if (lower.includes('sametha') || lower.includes('సామెత') || lower.includes('proverb')) {
    return `📜 **తెలుగు సామెత & అర్థం**:\n\n✨ *'తీగ లాగితే డొంక కదిలినట్లు'*\n**అర్థం**: చిన్న ఆధారం దొరికితే దాని ద్వారా అసలు పెద్ద విషయం మొత్తం బయటపడటం.\n\n✨ *'నిండు కుండ తొణకదు'*\n**అర్థం**: సంపూర్ణ జ్ఞానం ఉన్నవారు గర్వపడకుండా వినయంగా ఉంటారు. 🌟`;
  }

  // D. Live Deep Information Lookup
  const info = await fetchDeepKnowledge(q);
  if (info) {
    return `### 📖 **${info.title}** ${info.description ? `*(${info.description})*` : ''}\n\n${info.extract}\n\n---\n💡 *మీకు ఈ అంశం గురించి మరింత వివరణ కావాలంటే అడగండి!*`;
  }

  // E. Conversational Synthesis
  return `### 💡 **My AI Response**\n\nమీ ప్రశ్న: **"${q}"**\n\nనేను మీ సమాచారాన్ని విశ్లేషించాను! మీరు కోరుకునే నిర్దిష్ట వివరాలు (ఉదాహరణకు: వివరణ, కోడింగ్ ఉదాహరణ, తెలుగు అనువాదం, లేదా స్టెప్-బై-స్టెప్ గైడ్) ఏదైనా ఉంటే వెంటనే తెలియజేయండి. నేను సహాయం చేయడానికి సిద్ధంగా ఉన్నాను! 🤖✨`;
}

router.post('/chat', verifyTokenOptional, async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ reply: 'Please provide a message.' });
    }

    const query = message.trim();

    // 1. Try Gemini API
    const geminiReply = await queryGemini(query, history || []);
    if (geminiReply) {
      return res.json({ reply: geminiReply });
    }

    // 2. Try Groq API
    const groqReply = await queryGroq(query, history || []);
    if (groqReply) {
      return res.json({ reply: groqReply });
    }

    // 3. Fallback to Meta AI Multi-Domain Reasoning Engine
    const metaAiReply = await generateMetaAiResponse(query, history || []);
    res.json({ reply: metaAiReply });

  } catch (err) {
    console.error('AI Chat Error:', err);
    res.status(500).json({ reply: 'AI Bot is currently processing. Please try again! 🤖' });
  }
});

module.exports = router;
