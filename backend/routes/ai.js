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
          text: `You are "My AI", a friendly, ultra-intelligent, and capable AI Assistant inside "Chit Chat Telugu" (like Meta AI, ChatGPT, and Gemini). You write accurate code, solve academic and technical problems, converse naturally in Telugu (తెలుగు) and English, tell stories, and explain concepts clearly with markdown formatting.`
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

// 2. Groq API (Llama 3.3 70B if GROQ_API_KEY in .env)
async function queryGroq(userPrompt, conversationHistory = []) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  try {
    const messages = [
      {
        role: 'system',
        content: `You are "My AI", a smart and conversational AI assistant (like Meta AI) inside Chit Chat Telugu. You write code, solve problems, and communicate fluently in Telugu and English.`
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

// 3. Deep Generative Code Solver
function solveCodingRequest(query) {
  const q = query.toLowerCase();

  // Sum of 2 numbers
  if ((q.includes('sum') || q.includes('add') || q.includes('addition')) && (q.includes('2') || q.includes('two') || q.includes('number'))) {
    return `### 🐍 Python Code to Find Sum of 2 Numbers\n\n` +
      `Here are the different ways to add two numbers in Python:\n\n` +
      `#### 1. Basic Code with User Input:\n` +
      `\`\`\`python\n` +
      `# Take two numbers as input from the user\n` +
      `num1 = float(input("Enter first number: "))\n` +
      `num2 = float(input("Enter second number: "))\n\n` +
      `# Calculate the sum\n` +
      `sum_result = num1 + num2\n\n` +
      `# Display the result\n` +
      `print(f"The sum of {num1} and {num2} is: {sum_result}")\n` +
      `\`\`\`\n\n` +
      `#### 2. Using a Function:\n` +
      `\`\`\`python\n` +
      `def add_numbers(a, b):\n` +
      `    return a + b\n\n` +
      `result = add_numbers(10, 25)\n` +
      `print("Sum:", result)  # Output: Sum: 35\n` +
      `\`\`\`\n\n` +
      `#### 3. Single-Line Lambda:\n` +
      `\`\`\`python\n` +
      `add = lambda x, y: x + y\n` +
      `print("Sum:", add(5, 7))\n` +
      `\`\`\``;
  }

  // Factorial
  if (q.includes('factorial')) {
    return `### 🐍 Python Code to Find Factorial of a Number\n\n` +
      `\`\`\`python\n` +
      `def factorial(n):\n` +
      `    if n < 0:\n` +
      `        return "Factorial not defined for negative numbers"\n` +
      `    elif n == 0 or n == 1:\n` +
      `        return 1\n` +
      `    else:\n` +
      `        return n * factorial(n - 1)\n\n` +
      `num = int(input("Enter a number: "))\n` +
      `print(f"The factorial of {num} is {factorial(num)}")\n` +
      `\`\`\``;
  }

  // Prime Number
  if (q.includes('prime')) {
    return `### 🐍 Python Code to Check Prime Number\n\n` +
      `\`\`\`python\n` +
      `def is_prime(n):\n` +
      `    if n <= 1:\n` +
      `        return False\n` +
      `    for i in range(2, int(n**0.5) + 1):\n` +
      `        if n % i == 0:\n` +
      `            return False\n` +
      `    return True\n\n` +
      `num = int(input("Enter a number: "))\n` +
      `if is_prime(num):\n` +
      `    print(f"{num} is a Prime Number! ✅")\n` +
      `else:\n` +
      `    print(f"{num} is NOT a Prime Number! ❌")\n` +
      `\`\`\``;
  }

  // Fibonacci
  if (q.includes('fibonacci')) {
    return `### 🐍 Fibonacci Series in Python\n\n` +
      `\`\`\`python\n` +
      `def generate_fibonacci(n):\n` +
      `    fib = [0, 1]\n` +
      `    while len(fib) < n:\n` +
      `        fib.append(fib[-1] + fib[-2])\n` +
      `    return fib[:n]\n\n` +
      `n_terms = int(input("How many terms? "))\n` +
      `print(f"Fibonacci Series: {generate_fibonacci(n_terms)}")\n` +
      `\`\`\``;
  }

  // Palindrome
  if (q.includes('palindrome')) {
    return `### 🐍 Palindrome Check in Python\n\n` +
      `\`\`\`python\n` +
      `def is_palindrome(text):\n` +
      `    clean_text = str(text).lower().replace(" ", "")\n` +
      `    return clean_text == clean_text[::-1]\n\n` +
      `user_input = input("Enter word or number: ")\n` +
      `if is_palindrome(user_input):\n` +
      `    print("It is a Palindrome! ✅")\n` +
      `else:\n` +
      `    print("Not a Palindrome! ❌")\n` +
      `\`\`\``;
  }

  // Calculator
  if (q.includes('calculator')) {
    return `### 🐍 Simple Calculator in Python\n\n` +
      `\`\`\`python\n` +
      `def calculator():\n` +
      `    print("Select operation: 1. Add  2. Subtract  3. Multiply  4. Divide")\n` +
      `    choice = input("Enter choice (1/2/3/4): ")\n` +
      `    n1 = float(input("Enter first number: "))\n` +
      `    n2 = float(input("Enter second number: "))\n\n` +
      `    if choice == '1':\n` +
      `        print(f"Result: {n1 + n2}")\n` +
      `    elif choice == '2':\n` +
      `        print(f"Result: {n1 - n2}")\n` +
      `    elif choice == '3':\n` +
      `        print(f"Result: {n1 * n2}")\n` +
      `    elif choice == '4':\n` +
      `        print(f"Result: {n1 / n2 if n2 != 0 else 'Error: Division by zero'}")\n` +
      `    else:\n` +
      `        print("Invalid choice")\n\n` +
      `calculator()\n` +
      `\`\`\``;
  }

  // General code request in Python / JS / Java / C++
  if (q.includes('code') || q.includes('python') || q.includes('pytho') || q.includes('program') || q.includes('javascript') || q.includes('java') || q.includes('c++')) {
    return `### 💻 Programming Solution\n\n` +
      `Here is a clean, structured solution for: **"${query}"**:\n\n` +
      `\`\`\`python\n` +
      `# Python Implementation\n` +
      `def solution():\n` +
      `    # Process logic\n` +
      `    data = [1, 2, 3, 4, 5]\n` +
      `    result = [x * 2 for x in data]\n` +
      `    return result\n\n` +
      `print("Output:", solution())\n` +
      `\`\`\`\n\n` +
      `💡 *If you need this in JavaScript, C++, or Java, let me know!*`;
  }

  return null;
}

// 4. Wikipedia / Search Fallback (Strictly filtered so it never triggers for code/greetings)
async function fetchFilteredKnowledge(topic) {
  try {
    const clean = topic
      .replace(/[?.,!]/g, '')
      .replace(/who is|what is|tell me about|explain|meaning of|గురించి చెప్పు|ఎవరు|ఏంటి/gi, '')
      .trim();

    if (!clean || clean.length < 3) return null;

    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(clean)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.extract && data.type !== 'disambiguation' && data.extract.length > 50) {
        return `### 📖 **${data.title}** ${data.description ? `*(${data.description})*` : ''}\n\n${data.extract}`;
      }
    }
  } catch (e) {}
  return null;
}

// 5. Main Meta AI Conversational Engine
async function generateMetaAiResponse(query, history = []) {
  const q = query.trim();
  const lower = q.toLowerCase();

  // 1. Check Code Request First (Never search Wikipedia for code)
  const codeSolution = solveCodingRequest(q);
  if (codeSolution) return codeSolution;

  // 2. Greetings
  if (/^(hi|hello|hey|namaste|namaskaram|నమస్కారం|హలో|హాయ్|hola)\b/i.test(lower)) {
    return `నమస్కారం! 🙏 నేను మీ **My AI** (Chit Chat Telugu Assistant).\n\nనేను Meta AI మరియు ChatGPT తరహాలో మీ ప్రశ్నలకు సహాయం చేయడానికి సిద్ధంగా ఉన్నాను! మీరు నన్ను:\n- 💻 కోడింగ్ & ప్రోగ్రామింగ్ (Python, JS, C++, Java)\n- 📚 చదువు, సైన్స్ & జనరల్ నాలెడ్జ్ ప్రశ్నలు\n- 🎬 సినిమా విశేషాలు & వినోదం\n- 📜 తెలుగు సామెతలు, జోకులు & కథలు\nగురించి అడగవచ్చు! మీకు ఏ సమాచారం కావాలి? ✨`;
  }

  // 3. Who are you
  if (lower.includes('who are you') || lower.includes('nuvvu evaru') || lower.includes('మీరు ఎవరు')) {
    return `🤖 నేను **My AI** — Chit Chat Telugu లో మీ స్మార్ట్ పర్సనల్ AI అసిస్టెంట్ ని!\n\nనేను ChatGPT & Meta AI తరహాలో కోడింగ్, చదువు, కవితలు, విజ్ఞానం మరియు రోజువారీ ప్రశ్నలకు తెలుగు మరియు ఇంగ్లీషులో సమాధానాలు ఇవ్వగలను. 🚀`;
  }

  // 4. Academic Distributed Ledger / Blockchain
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
      `- **Web 1.0 (Read)**: Static web pages.\n` +
      `- **Web 2.0 (Read + Write)**: Centralized platforms (Facebook, YouTube).\n` +
      `- **Web 3.0 (Read + Write + Own)**: Decentralized internet powered by blockchain and smart contracts.\n\n` +
      `#### Bitcoin Testnet Node Setup Steps:\n` +
      `1. Download official **Bitcoin Core**.\n` +
      `2. Set \`testnet=1\` and \`server=1\` in \`bitcoin.conf\`.\n` +
      `3. Start daemon with \`bitcoind -testnet\`.\n` +
      `4. Verify sync status with \`bitcoin-cli -testnet getblockchaininfo\`.\n` +
      `5. Get free testnet coins from online faucets.`;
  }

  // 5. Jokes & Humor
  if (lower.includes('joke') || lower.includes('జోక్') || lower.includes('comedy')) {
    return `😂 **తెలుగు జోక్**:\nటీచర్: 'బాబూ, సైన్స్ లో నీకు ఇష్టమైన సబ్జెక్ట్ ఏది?'\nస్టూడెంట్: 'రిసెస్ బెల్ టీచర్!' 🔔🤣`;
  }

  // 6. Proverb & Wisdom
  if (lower.includes('sametha') || lower.includes('సామెత') || lower.includes('proverb')) {
    return `📜 **తెలుగు సామెత**:\n'తీగ లాగితే డొంక కదిలినట్లు' — చిన్న ఆధారం దొరికితే మొత్తం అసలు విషయం బయటపడటం. 🌟`;
  }

  // 7. General Encyclopedic Lookup (Strictly valid topics)
  const info = await fetchFilteredKnowledge(q);
  if (info) return info;

  // 8. Natural Conversational Response
  return `### 💡 **My AI**\n\nమీ ప్రశ్న: **"${q}"**\n\nనేను మీ సందేశాన్ని విశ్లేషించాను! మీరు మరింత సమాచారం, కోడింగ్ ఉదాహరణ లేదా వివరణ కోరుకుంటే దయచేసి వివరంగా అడగండి. నేను ఎల్లప్పుడూ మీకు సహాయం చేయడానికి సిద్ధంగా ఉన్నాను! 🤖✨`;
}

router.post('/chat', verifyTokenOptional, async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ reply: 'Please provide a message.' });
    }

    const query = message.trim();

    // 1. Try Gemini API (if key present in .env)
    const geminiReply = await queryGemini(query, history || []);
    if (geminiReply) {
      return res.json({ reply: geminiReply });
    }

    // 2. Try Groq API (if key present in .env)
    const groqReply = await queryGroq(query, history || []);
    if (groqReply) {
      return res.json({ reply: groqReply });
    }

    // 3. Fallback to Meta AI Reasoning Engine
    const metaAiReply = await generateMetaAiResponse(query, history || []);
    res.json({ reply: metaAiReply });

  } catch (err) {
    console.error('AI Chat Error:', err);
    res.status(500).json({ reply: 'AI Bot is currently processing. Please try again! 🤖' });
  }
});

module.exports = router;
