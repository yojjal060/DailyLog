// ─── Mission Engine ─────────────────────────────────────
// Rule-based mission generator. Picks ONE task based on check-in data.
// No AI API needed — pure logic + randomization.

const MISSION_POOL = {
  DSA: {
    easy: [
      { title: "Solve 2 easy array problems on LeetCode", description: "Pick from 'Top Interview 150'. Focus on understanding the pattern, not speed." },
      { title: "Review & re-solve a previously attempted DSA problem", description: "Go back to one you struggled with. Can you do it from memory now?" },
      { title: "Learn one new data structure concept", description: "Read about it, draw it out, understand when to use it. No coding needed." },
      { title: "Solve 1 easy string manipulation problem", description: "Focus on edge cases — empty strings, single chars, unicode." },
      { title: "Watch a 20-min DSA explanation video and take notes", description: "Visual learning counts. Write down 3 takeaways." },
    ],
    medium: [
      { title: "Solve 1 medium difficulty problem on LeetCode", description: "Take your time. Understand the approach before coding. It's okay to look at hints." },
      { title: "Implement a basic sorting algorithm from scratch", description: "Merge sort or quicksort. Write it, test it, understand the time complexity." },
      { title: "Practice 3 easy problems with a 15-min timer each", description: "Speed drill. Even partial solutions count." },
      { title: "Study one algorithm pattern (sliding window, two pointer, etc.)", description: "Read the theory, then solve 1 problem using that pattern." },
    ],
    hard: [
      { title: "Solve 1 medium + 1 easy problem back to back", description: "Build stamina. No breaks between problems. Timer on." },
      { title: "Attempt a hard problem for 45 minutes", description: "You don't need to solve it. The struggle IS the learning. Document what you tried." },
      { title: "Code a data structure from scratch (linked list, BST, graph)", description: "Implement insert, delete, search, and traverse. Test with edge cases." },
    ]
  },
  Frontend: {
    easy: [
      { title: "Build a small UI component (button, card, modal)", description: "Pure HTML + CSS. No framework. Focus on polish and responsiveness." },
      { title: "Read React docs for 30 minutes and build a tiny demo", description: "Pick a concept you're fuzzy on (hooks, context, effects) and build a sandbox." },
      { title: "Recreate a UI you saw on a website you like", description: "Screenshot it, then build it. Great for CSS muscle memory." },
    ],
    medium: [
      { title: "Build a functional to-do list with local storage", description: "Add, delete, toggle, persist. Focus on clean code and good UX." },
      { title: "Implement responsive design for a past project", description: "Make something mobile-friendly. Test at 3 breakpoints." },
      { title: "Learn and implement one CSS animation technique", description: "Transitions, keyframes, or scroll-triggered animations. Make it smooth." },
    ],
    hard: [
      { title: "Build a mini project: weather app, quiz app, or markdown editor", description: "Full feature. Start to finish. Deploy it." },
      { title: "Refactor an old project with better component architecture", description: "Apply what you've learned. Clean, reusable, documented." },
    ]
  },
  Backend: {
    easy: [
      { title: "Set up a basic Express API with 3 routes", description: "GET, POST, DELETE. Test with Postman or curl." },
      { title: "Read about REST API best practices for 30 minutes", description: "Status codes, naming conventions, error handling." },
      { title: "Write a simple CRUD API for a resource (users, posts, etc.)", description: "Use in-memory storage. Focus on clean route structure." },
    ],
    medium: [
      { title: "Add database integration to an existing API", description: "Connect to SQLite or MongoDB. Implement proper error handling." },
      { title: "Implement authentication (JWT or session-based)", description: "Register, login, protected routes. Understand the flow." },
      { title: "Write API tests for an existing backend project", description: "Use Jest or any test framework. Cover happy path + error cases." },
    ],
    hard: [
      { title: "Build a full REST API with auth, validation, and error handling", description: "Production-quality. Middleware, logging, proper HTTP codes." },
      { title: "Implement a real-time feature (WebSockets or SSE)", description: "Chat, notifications, or live updates. Deploy and test." },
    ]
  },
  DevOps: {
    easy: [
      { title: "Learn about Docker — read docs and run your first container", description: "Pull an image, run it, understand what happened. 30 minutes." },
      { title: "Set up a .env file and learn about environment variables", description: "Why they matter, how to use them, never commit secrets." },
      { title: "Deploy a static site to Vercel or Netlify", description: "Pick any project. Make it live. Share the URL." },
    ],
    medium: [
      { title: "Write a Dockerfile for one of your projects", description: "Build it, run it, verify it works the same as locally." },
      { title: "Set up a basic CI/CD pipeline with GitHub Actions", description: "Auto-lint, auto-test on push. Start simple." },
    ],
    hard: [
      { title: "Set up a multi-stage Docker build and docker-compose", description: "Frontend + backend + database, all containerized." },
    ]
  },
  'AI/ML': {
    easy: [
      { title: "Read an AI/ML introductory article and summarize 3 key concepts", description: "What is a model? What is training? What is inference? Write it in your own words." },
      { title: "Run a pre-built Python ML notebook (Kaggle or Colab)", description: "Don't build from scratch. Run, observe, tweak one parameter, observe again." },
      { title: "Learn about one AI API (OpenAI, Hugging Face, etc.)", description: "Read the docs, make one API call, understand the response format." },
    ],
    medium: [
      { title: "Build a simple Python script that uses an AI API", description: "Text generation, image classification, sentiment analysis. Keep it simple." },
      { title: "Follow a beginner ML tutorial end-to-end", description: "Linear regression, classification, or clustering. Understand each step." },
    ],
    hard: [
      { title: "Build a small project integrating AI into a web app", description: "Chatbot, content generator, recommendation engine. Full stack." },
    ]
  },
  Reading: {
    easy: [
      { title: "Read 10 pages of a tech book or documentation", description: "No pressure to finish. 10 pages is the mission. Take notes on 1 thing you learned." },
      { title: "Read 3 short tech blog posts on a topic you're curious about", description: "Hacker News, Dev.to, Medium. Curate, don't scroll." },
      { title: "Watch a conference talk (30 min max) and write 3 takeaways", description: "YouTube has hundreds of great ones. Pick a topic you're weak on." },
    ],
    medium: [
      { title: "Deep-read one technical article and implement what it teaches", description: "Don't just read — build the thing the article describes." },
      { title: "Read 20 pages of a coding book and solve one exercise from it", description: "Active reading. Write code as you read." },
    ],
    hard: [
      { title: "Read and summarize a technical paper or RFC", description: "Doesn't need to be perfect. Just understand the problem and proposed solution." },
    ]
  }
}

const CATEGORIES = Object.keys(MISSION_POOL)

const ANTI_PROCRASTINATION_RULES = [
  "If you feel the urge to check your phone, do 5 push-ups first. Then decide.",
  "Tab switching is a trap. Close every tab except what you need RIGHT NOW.",
  "Set your phone face-down in another room for the entire focus block.",
  "If stuck for 5+ minutes, write down WHAT you're stuck on. Then search specifically for that.",
  "The first 5 minutes are hardest. Promise yourself just 5 minutes. Then decide.",
  "Don't open social media 'just for a second'. There's no such thing.",
  "If you feel overwhelmed, shrink the task. What's the smallest piece you can do?",
  "Put on headphones even if you're not playing music. It's a 'focus mode' signal to your brain.",
  "If you catch yourself scrolling, don't shame yourself. Just close the app and return.",
  "Set a visible timer. Your brain needs to SEE time passing.",
]

export function generateMission(checkin) {
  if (!checkin) {
    // Fallback: medium difficulty, random category
    return pickMission('DSA', 'medium')
  }

  const { energy, gym, sleep_hours } = checkin

  // Determine difficulty based on energy + gym + sleep
  let difficulty
  const score = energy + (gym === 'yes' ? 1 : 0) + (sleep_hours >= 7 ? 1 : 0)
  
  if (score <= 3) {
    difficulty = 'easy'
  } else if (score <= 5) {
    difficulty = 'medium'
  } else {
    difficulty = 'hard'
  }

  // Pick category — weighted random, slight bias toward DSA
  const weights = {
    'DSA': 3,
    'Frontend': 2,
    'Backend': 2,
    'DevOps': 1,
    'AI/ML': 1,
    'Reading': 1,
  }

  // On low energy, boost Reading weight
  if (energy <= 2) {
    weights['Reading'] = 3
    weights['DSA'] = 1
  }

  const category = weightedRandom(weights)
  return pickMission(category, difficulty)
}

function pickMission(category, difficulty) {
  const pool = MISSION_POOL[category]
  if (!pool) return fallbackMission()

  let missions = pool[difficulty]
  if (!missions || missions.length === 0) {
    // Fall back to easy
    missions = pool.easy
  }
  if (!missions || missions.length === 0) return fallbackMission()

  const picked = missions[Math.floor(Math.random() * missions.length)]
  const difficultyNum = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3
  const estimatedBlocks = difficultyNum === 1 ? 1 : difficultyNum === 2 ? 2 : 3

  return {
    title: picked.title,
    description: picked.description,
    category,
    difficulty: difficultyNum,
    estimated_blocks: estimatedBlocks,
  }
}

function fallbackMission() {
  return {
    title: "Read 10 pages of any tech content",
    description: "When in doubt, learn. Pick anything that interests you.",
    category: 'Reading',
    difficulty: 1,
    estimated_blocks: 1,
  }
}

function weightedRandom(weights) {
  const entries = Object.entries(weights)
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  let rand = Math.random() * total
  for (const [key, weight] of entries) {
    rand -= weight
    if (rand <= 0) return key
  }
  return entries[0][0]
}
