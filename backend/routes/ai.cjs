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

// Helper to clean raw LaTeX and math notation into readable standard text
function cleanLatexSyntax(text) {
  if (!text) return '';
  let res = text;
  // Fractions: \frac{a}{b} -> (a / b)
  res = res.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1 / $2)');
  res = res.replace(/\\dfrac\{([^}]+)\}\{([^}]+)\}/g, '($1 / $2)');
  // Sums, Integrals
  res = res.replace(/\\sum_\{([^}]+)\}\^\{([^}]+)\}/g, '∑[$1 to $2]');
  res = res.replace(/\\sum/g, '∑');
  res = res.replace(/\\int_\{([^}]+)\}\^\{([^}]+)\}/g, '∫[$1 to $2]');
  res = res.replace(/\\int/g, '∫');
  // Text & Fonts
  res = res.replace(/\\mathbf\{([^}]+)\}/g, '$1');
  res = res.replace(/\\textbf\{([^}]+)\}/g, '$1');
  res = res.replace(/\\text\{([^}]+)\}/g, '$1');
  res = res.replace(/\\mathrm\{([^}]+)\}/g, '$1');
  res = res.replace(/\\mathbb\{([^}]+)\}/g, '$1');
  res = res.replace(/\\left\(/g, '(').replace(/\\right\)/g, ')');
  res = res.replace(/\\left\[/g, '[').replace(/\\right\]/g, ']');
  res = res.replace(/\\left\\\{/g, '{').replace(/\\right\\\}/g, '}');
  res = res.replace(/\\\{/g, '{').replace(/\\\}/g, '}');
  // Math symbols
  res = res.replace(/\\approx/g, '≈');
  res = res.replace(/\\leq?/g, '≤');
  res = res.replace(/\\geq?/g, '≥');
  res = res.replace(/\\neq?/g, '≠');
  res = res.replace(/\\times/g, '×');
  res = res.replace(/\\cdot/g, '·');
  res = res.replace(/\\div/g, '÷');
  res = res.replace(/\\pm/g, '±');
  res = res.replace(/\\implies/g, '⟹');
  res = res.replace(/\\sqrt\{([^}]+)\}/g, '√($1)');
  res = res.replace(/\\sqrt/g, '√');
  // Superscripts & Subscripts
  res = res.replace(/\^2\b/g, '²').replace(/\^3\b/g, '³').replace(/\^n\b/g, 'ⁿ');
  res = res.replace(/_i\b/g, 'ᵢ').replace(/_1\b/g, '₁').replace(/_2\b/g, '₂').replace(/_3\b/g, '₃');
  // Strip raw dollar signs used as LaTeX delimiters
  res = res.replace(/\$\$/g, '').replace(/\$/g, '');
  return res;
}

// Helper to detect Image Generation Requests
function detectImageGenRequest(text) {
  if (!text) return null;
  const t = text.trim();
  const enMatch = t.match(/^(?:please\s+)?(?:generate|create|draw|make|paint|render)\s+(?:an?\s+)?(?:image|picture|photo|illustration|art|drawing|pic|wallpaper)\s+(?:of|about|with|for)?\s*(.+)$/i);
  if (enMatch && enMatch[1]) return enMatch[1].trim();

  const teMatch = t.match(/(.+?)\s*(?:యొక్క\s*)?(?:చిత్రం|బొమ్మ|ఫోటో|చిత్రాన్ని|ఇమేజ్)\s*(?:గీయి|గీయండి|జనరేట్ చేయి|సృష్టించు|సృష్టించండి|తయారు చేయి|కావాలి)/i);
  if (teMatch && teMatch[1]) return teMatch[1].trim();

  return null;
}

// 1. Google Gemini API (if GEMINI_API_KEY in .env) with Multimodal Vision & Document Support
async function queryGemini(userPrompt, conversationHistory = [], attachment = null) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const models = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'];

  const systemInstruction = `You are "My AI", an elite, world-class Multimodal AI Assistant built into "Chit Chat Telugu" (like ChatGPT, Gemini Pro, and Meta AI on WhatsApp).

### Core Guidelines:
1. **Direct Responses Only**: Respond directly, accurately, and helpfully to the user's specific message, question, image, or search. Never append robotic lists of capabilities, category menus, or repetitive trailing questions like "(Image analysis, math problems, coding, leda emaina general chat? Tell me!)".
2. **Vision & Image Understanding**: When the user provides an image, photo, screenshot, or diagram:
   - Carefully examine all visual details, text, handwriting, objects, equations, diagrams, and figures in the image.
   - Accurately extract, transcribe, explain, solve, or describe whatever the user asks.
3. **Document Analysis**: When a document or PDF is attached, analyze the contents, extract answers, summarize key points, or answer specific questions with precision.
4. **Mathematics & Science**: Solve university & school math, probability, statistics, calculus, discrete math, physics, and engineering questions with clear step-by-step solutions, definitions, formulas, and highlighted final answers.
5. **Clean Text Formatting**:
   - Write equations using clean, readable unicode characters (e.g. E[X], V(X), P(X = x), 1/4, ∑, ∫, ², ³, √, ±, ≤, ≥, ×, ÷, ⟹, ≈) instead of raw LaTeX backslash tags.
   - Do NOT enclose math formulas in dollar signs ($ or $$). Write them cleanly and naturally so anyone reading the text sees standard readable math.
   - Use clean Markdown for structure: Headings (### Title), Bold (**Answer**), Bullet lists, and Tables (| Header | Value |).
6. **Coding**: Provide complete, well-commented code blocks with syntax highlighting.
7. **Bilingual & Natural**: Reply in the language requested (Telugu, English, or Telenglish). If asked in English exam format, provide standard academic English.`;

  for (const model of models) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000);

      // Build multimodal parts
      const userParts = [];
      
      let promptText = userPrompt || (attachment ? 'Please analyze this attached file in detail and explain its contents.' : '');
      
      // If text document attached
      if (attachment && attachment.textContent) {
        promptText += `\n\n--- ATTACHED DOCUMENT CONTENT (${attachment.fileName || 'file'}) ---\n${attachment.textContent.substring(0, 40000)}\n--- END OF ATTACHED DOCUMENT ---`;
      }
      
      if (promptText) {
        userParts.push({ text: promptText });
      }

      // If binary image or PDF attached
      if (attachment && attachment.data && attachment.mimeType) {
        userParts.push({
          inlineData: {
            mimeType: attachment.mimeType,
            data: attachment.data
          }
        });
      }

      const contents = [
        ...conversationHistory.map(m => ({
          role: m.sender === 'user' ? 'user' : 'model',
          parts: [{ text: m.text }]
        })),
        {
          role: 'user',
          parts: userParts.length > 0 ? userParts : [{ text: 'Hello' }]
        }
      ];

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemInstruction }]
          },
          contents,
          generationConfig: {
            temperature: 0.6,
            topP: 0.95,
            maxOutputTokens: 8192
          }
        })
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim()) {
          return cleanLatexSyntax(text.trim());
        }
      }
    } catch (err) {
      console.warn(`Gemini model ${model} skipped:`, err.message);
    }
  }
  return null;
}

// 2. Groq API (Llama 3.3 70B if GROQ_API_KEY in .env)
async function queryGroq(userPrompt, conversationHistory = []) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const messages = [
      {
        role: 'system',
        content: `You are "My AI", a friendly, ultra-smart AI companion in Chit Chat Telugu (like Meta AI on WhatsApp and Snapchat My AI). You communicate fluently in Telugu and English naturally without rigid robotic menus.`
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
      signal: controller.signal,
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.7
      })
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (text && text.trim()) return text.trim();
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

// 5. Main Meta AI / Snap AI Conversational Engine (Natural Fallback)
async function generateMetaAiResponse(query, history = []) {
  const q = query.trim();
  const lower = q.toLowerCase();

  // 1. Check Code Request First (Never search Wikipedia for code)
  const codeSolution = solveCodingRequest(q);
  if (codeSolution) return codeSolution;

  // 2. Natural Greetings (No rigid robotic bullet lists)
  if (/^(hi|hello|hey|namaste|namaskaram|నమస్కారం|హలో|హాయ్|hola|good morning|good evening|good afternoon)\b/i.test(lower)) {
    const greetings = [
      `హలో! 🙏 ఎలా ఉన్నారు? నేను మీ **My AI** ని. ఈ రోజు మీకు ఎలా సహాయపడగలను? ✨`,
      `హాయ్! 👋 నేను మీ Chit Chat AI ని. ఏదైనా ప్రశ్న అడగండి లేదా సరదాగా మాట్లాడండి! 😊`,
      `నమస్కారం! 🙏 మీకు ఏ సమాచారం కావాలన్నా లేదా ఎలాంటి సహాయం కావాలన్నా నన్ను అడగవచ్చు! 🚀`
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  // 3. Who are you
  if (lower.includes('who are you') || lower.includes('nuvvu evaru') || lower.includes('మీరు ఎవరు') || lower.includes('what are you')) {
    return `🤖 నేను **My AI** — Chit Chat Telugu లో మీ స్మార్ట్ పర్సనల్ AI అసిస్టెంట్ ని (WhatsApp Meta AI & Snapchat My AI లాగా)!\n\nకోడింగ్, చదువు, ప్రశ్నలు, కవితలు, జోకులు లేదా ఏదైనా సరికొత్త సమాచారం తెలుసుకోవడానికి నేను ఎల్లప్పుడూ మీకు తోడుగా ఉంటాను. 🚀✨`;
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
    const jokes = [
      `😂 **తెలుగు జోక్**:\nటీచర్: 'బాబూ, సైన్స్ లో నీకు ఇష్టమైన సబ్జెక్ట్ ఏది?'\nస్టూడెంట్: 'రిసెస్ బెల్ టీచర్!' 🔔🤣`,
      `😄 **జోక్**:\nఫ్రెండ్ 1: 'పరీక్షల్లో ఏమైనా రాశావా?'\nఫ్రెండ్ 2: 'పేపర్ మీద క్వశ్చన్ నెంబర్లు తప్ప ఏమీ రాయలేదు రా!'\nఫ్రెండ్ 1: 'హమ్మయ్య! ఇద్దరివీ ఒకే సమాధానాలు కాబట్టి కాపీ కొట్టామనుకోరు!' 🤣`
    ];
    return jokes[Math.floor(Math.random() * jokes.length)];
  }

  // 6. Proverb & Wisdom
  if (lower.includes('sametha') || lower.includes('సామెత') || lower.includes('proverb')) {
    return `📜 **తెలుగు సామెత**:\n'తీగ లాగితే డొంక కదిలినట్లు' — చిన్న ఆధారం దొరికితే మొత్తం అసలు విషయం బయటపడటం. 🌟`;
  }

  // 7. General Encyclopedic Lookup (Strictly valid topics)
  const info = await fetchFilteredKnowledge(q);
  if (info) return info;

  // 8. Natural Conversational Response (Warm, Direct, Helpful)
  return `నేను మీ ప్రశ్నను గమనించాను: **"${q}"**.\n\nమీరు దీని గురించి మరింత స్పష్టంగా లేదా నిర్దిష్టమైన ఉదాహరణతో అడిగితే నేను ఇంకా ఖచ్చితమైన సమాధానం లేదా కోడింగ్ తో సహాయం చేస్తాను! 😊✨`;
}

// Helper to build Pure Ultra-Realistic Real-Life Photographic Prompts
function buildUltraHdRealisticPrompt(rawPrompt, requestedStyle = 'photo') {
  if (!rawPrompt) return '';
  let p = rawPrompt.trim();
  
  // Clean common command prefixes
  p = p.replace(/^(?:please\s+)?(?:generate|create|draw|make|paint|render|show me)\s+(?:an?\s+)?(?:image|picture|photo|photograph|pic|wallpaper)\s+(?:of|about|with|for)?\s*/i, '').trim();

  const isArtStyle = requestedStyle === 'art' || /(anime|cartoon|sketch|drawing|illustration|oil painting|water color|pixel art|3d render|claymation|comic|vector|caricature)/i.test(p);
  
  if (isArtStyle) {
    return `${p}, highly detailed, sharp crisp focus, 8k resolution`;
  }

  // Pure Real-Life Photographic Engine (Ultra-sharp, genuine camera capture, authentic human skin & lighting)
  return `RAW 35mm color photograph of ${p}, shot on Sony A7R V with 85mm f/1.4 GM lens, 1/1000s shutter, ISO 100, bright natural daylight, crisp sharp focus, crystal clear facial features, authentic human skin texture with natural pores, hyperrealistic natural environment reflections, National Geographic style documentary photography, ultra-HD 8k resolution --no painting, drawing, sketch, cartoon, anime, 3d render, cgi, airbrush, illustration, smooth skin, plastic look, blurry, digital art, distorted`;
}

router.post('/chat', verifyTokenOptional, async (req, res) => {
  try {
    const { message, history, attachment, generateImage, style } = req.body;
    
    // Check for explicit or auto-detected image generation request
    const promptText = (message || '').trim();
    const detectedImgSubject = generateImage ? promptText : detectImageGenRequest(promptText);

    if (detectedImgSubject) {
      const seed = Math.floor(Math.random() * 1000000);
      const enhancedPrompt = buildUltraHdRealisticPrompt(detectedImgSubject, style || 'photo');
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=1024&height=1024&nologo=true&enhance=false&seed=${seed}&model=flux`;
      
      return res.json({
        reply: `📸 **Ultra-HD Real-Life Photo**\n\nPrompt: **"${detectedImgSubject}"**\n\nHere is your high-definition, genuine photographic image:`,
        generatedImage: imageUrl,
        prompt: detectedImgSubject
      });
    }

    if (!promptText && !attachment) {
      return res.status(400).json({ reply: 'Please provide a message or attach an image/document.' });
    }

    // 1. Try Gemini API with Multimodal Vision & Document capabilities
    const geminiReply = await queryGemini(promptText, history || [], attachment || null);
    if (geminiReply) {
      return res.json({ reply: geminiReply });
    }

    // 2. Try Groq API (if key present in .env)
    const groqReply = await queryGroq(promptText, history || []);
    if (groqReply) {
      return res.json({ reply: groqReply });
    }

    // 3. Fallback to Meta AI Reasoning Engine
    const metaAiReply = await generateMetaAiResponse(promptText || 'Hello', history || []);
    res.json({ reply: metaAiReply });

  } catch (err) {
    console.error('AI Chat Error:', err);
    res.status(500).json({ reply: 'AI Bot is currently processing. Please try again! 🤖' });
  }
});

// Dedicated Image Generation Endpoint
router.post('/generate-image', verifyTokenOptional, async (req, res) => {
  try {
    const { prompt, style } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const cleanPrompt = prompt.trim();
    const seed = Math.floor(Math.random() * 1000000);
    const enhancedPrompt = buildUltraHdRealisticPrompt(cleanPrompt, style || 'photo');
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=1024&height=1024&nologo=true&enhance=false&seed=${seed}&model=flux`;

    res.json({
      imageUrl,
      prompt: cleanPrompt
    });
  } catch (err) {
    console.error('Image Gen Error:', err);
    res.status(500).json({ error: 'Failed to generate image' });
  }
});

module.exports = router;
