const synonyms: Record<string, string[]> = {
  "india": ["the nation", "the subcontinent", "the country"],
  "journalist": ["reporter", "news writer", "correspondent", "journalist"],
  "propaganda": ["narratives", "biased reporting", "spin", "slanted coverage"],
  "secular": ["pluralistic", "inclusive", "multi-faith", "secular"],
  "people": ["individuals", "citizens", "the public", "folks"],
  "government": ["administration", "authorities", "governing body", "leadership"],
  "great": ["remarkable", "outstanding", "impressive", "significant"],
  "good": ["excellent", "positive", "worthwhile", "solid"],
  "fake": ["misleading", "fabricated", "unverified", "false"],
  "news": ["updates", "reports", "coverage", "headlines"],
  "world": ["global community", "society", "international stage"],
  "create": ["develop", "build", "craft", "generate"],
  "important": ["crucial", "vital", "essential", "key"],
  "make": ["produce", "generate", "formulate", "construct"],
  "change": ["transform", "shift", "revolutionize", "modify"],
  "problem": ["challenge", "obstacle", "issue", "concern"],
  "help": ["assist", "support", "enable", "facilitate"],
  "use": ["utilize", "employ", "leverage", "apply"],
  "fast": ["rapid", "swift", "accelerated", "quick"],
  "easy": ["simple", "straightforward", "effortless", "accessible"],
  "hard": ["difficult", "challenging", "demanding", "arduous"],
  "learn": ["understand", "grasp", "master", "acquire"],
  "build": ["construct", "establish", "develop", "strengthen"],
  "think": ["believe", "consider", "ponder", "suggest"],
  "say": ["state", "claim", "assert", "remark"],
  "show": ["demonstrate", "reveal", "exhibit", "indicate"],
  "new": ["fresh", "novel", "innovative", "alternative"],
  "old": ["traditional", "legacy", "existing", "outdated"],
  "big": ["massive", "substantial", "huge", "significant"],
  "small": ["minor", "slight", "modest", "limited"],
  "many": ["numerous", "various", "several", "a multitude of"],
  "very": ["highly", "extremely", "particularly", "supremely"],
  "basically": ["essentially", "fundamentally", "primarily", "at its core"],
  "actually": ["in fact", "genuinely", "really", "truly"],
  "work": ["operate", "function", "perform", "labor"],
  "business": ["enterprise", "company", "industry", "organization"],
  "money": ["capital", "funds", "resources", "finance"],
  "happy": ["delighted", "pleased", "content", "satisfied"],
  "sad": ["disappointed", "unfortunate", "somber", "regrettable"],
  "scary": ["concerning", "intimidating", "frightening", "alarming"],
  "wrong": ["incorrect", "flawed", "mistaken", "erroneous"],
  "right": ["correct", "accurate", "proper", "justified"],
  "start": ["launch", "initiate", "commence", "begin"],
  "stop": ["halt", "cease", "terminate", "pause"],
  "try": ["attempt", "strive", "endeavor"],
  "need": ["require", "demand", "necessitate"],
  "simple": ["uncomplicated", "clear-cut", "basic"],
  "different": ["distinct", "diverse", "varying"],
  "system": ["framework", "infrastructure", "setup"],
  "future": ["outlook", "horizon", "road ahead"],
  "success": ["achievement", "victory", "breakthrough"],
  "failure": ["setback", "breakdown", "misstep"],
};

const TONE_TEMPLATES: Record<string, string[]> = {
  viral: [
    "🚀 {intro}\n\n{content}\n\n💡 {cta}\n\n{hashtags}",
    "⚡️ {intro}\n\n\"{content}\"\n\n👇 {cta}\n\n{hashtags}",
    "🔥 {intro}\n\n{content}\n\n🎯 {cta}\n\n{hashtags}",
    "💎 {intro}\n\n{content}\n\n💭 {cta}\n\n{hashtags}"
  ],
  professional: [
    "💼 {intro}\n\n{content}\n\n📌 {cta}\n\n{hashtags}",
    "📈 {intro}\n\n\"{content}\"\n\n🧠 {cta}\n\n{hashtags}",
    "💡 {intro}\n\n{content}\n\n🔑 {cta}\n\n{hashtags}",
    "🎯 {intro}\n\n{content}\n\n💬 {cta}\n\n{hashtags}"
  ],
  humorous: [
    "😂 {intro}\n\n{content}\n\n🤫 {cta}\n\n{hashtags}",
    "🤡 {intro}\n\n\"{content}\"\n\n🤷‍♂️ {cta}\n\n{hashtags}",
    "🎭 {intro}\n\n{content}\n\n🍿 {cta}\n\n{hashtags}",
    "🤣 {intro}\n\n{content}\n\n👀 {cta}\n\n{hashtags}"
  ],
  educational: [
    "📚 {intro}\n\n{content}\n\n🔍 {cta}\n\n{hashtags}",
    "🧠 {intro}\n\n\"{content}\"\n\n💡 {cta}\n\n{hashtags}",
    "🔬 {intro}\n\n{content}\n\n📖 {cta}\n\n{hashtags}",
    "🎓 {intro}\n\n{content}\n\n📝 {cta}\n\n{hashtags}"
  ]
};

const TONE_ELEMENTS: Record<string, { intros: string[], ctas: string[], hashtags: string[] }> = {
  viral: {
    intros: [
      "UNPOPULAR OPINION:",
      "Read that again:",
      "This needs to be said:",
      "Game-changing insight:",
      "Mindset shift:"
    ],
    ctas: [
      "Agree or disagree? Let me know below! 👇",
      "What are we missing here? Share your thoughts!",
      "Do you agree with this? Drop a comment! 👇",
      "Thoughts? Hit reply!",
      "Let's discuss in the comments."
    ],
    hashtags: ["#viral", "#trending", "#mindset", "#success", "#growth", "#future"]
  },
  professional: {
    intros: [
      "Key industry takeaway:",
      "Strategic observation:",
      "Professional reflection:",
      "The future of work is shifting:",
      "Execution is everything:"
    ],
    ctas: [
      "How is your organization adapting to this?",
      "What is your perspective on this trend?",
      "Would love to hear how other leaders are navigating this.",
      "What's your experience with this in your industry?",
      "Let's connect and discuss."
    ],
    hashtags: ["#leadership", "#business", "#productivity", "#strategy", "#innovation"]
  },
  humorous: {
    intros: [
      "Unfiltered thoughts:",
      "Can't make this up:",
      "Just going to leave this here:",
      "Plot twist:",
      "Classic scenario:"
    ],
    ctas: [
      "Tag someone who needs to see this! 😂",
      "What's the worst that could happen? 🤷‍♂️",
      "Thoughts? (Wrong answers only) 👇",
      "Don't say I didn't warn you. 😉",
      "I'll just grab some popcorn. 🍿"
    ],
    hashtags: ["#humor", "#comedy", "#relatable", "#fun", "#vibes"]
  },
  educational: {
    intros: [
      "Quick breakdown:",
      "Let's dissect this:",
      "Here is what you need to know:",
      "The science behind it:",
      "Looking closer at the data:"
    ],
    ctas: [
      "What's your biggest takeaway from this?",
      "Save this post for later! 💾",
      "Have you encountered this before?",
      "Let me know if this helps clarify things!",
      "Hope this adds value to your day."
    ],
    hashtags: ["#education", "#learning", "#knowledge", "#tips", "#skills"]
  }
};

const TRANSITIONS = [
  "Interestingly, ",
  "Notably, ",
  "Essentially, ",
  "In reality, ",
  "Importantly, ",
  "Consequently, ",
  "Upon closer inspection, ",
  "Crucially, ",
  "Furthermore, ",
  "Basically, "
];

function matchCasing(original: string, replacement: string): string {
  if (original === original.toUpperCase()) {
    return replacement.toUpperCase();
  }
  if (original[0] === original[0].toUpperCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

function getRandomElement<T>(arr: T[]): T {
  const index = Math.floor(Math.random() * arr.length);
  return arr[index];
}

function pickSomeHashtags(tags: string[], count = 2): string {
  const shuffled = [...tags].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count).join(" ");
}

export function generateProceduralFallback(originalContent: string, tone: string): string {
  if (!originalContent) return "";

  // 1. Process words using synonym dictionary while preserving URL/Hashtag/Mention/HTML tokens
  // TOKEN_REGEX splits: URLs, mentions, hashtags, HTML tags, words, and non-words
  const TOKEN_REGEX = /(https?:\/\/[^\s]+|@[a-zA-Z0-9_]+|#[a-zA-Z0-9_]+|<[^>]+>|[a-zA-Z]+|[^a-zA-Z]+)/g;
  const tokens = originalContent.match(TOKEN_REGEX) || [];
  
  const processedTokens = tokens.map(token => {
    // Only translate plain alphabetical words
    if (/^[a-zA-Z]+$/.test(token)) {
      const lower = token.toLowerCase();
      if (synonyms[lower]) {
        const replacement = getRandomElement(synonyms[lower]);
        return matchCasing(token, replacement);
      }
    }
    return token;
  });

  const baseRemixedText = processedTokens.join("");

  // 2. Perform sentence-level structural variations
  const paragraphs = baseRemixedText.split(/\n+/);
  const processedParagraphs = paragraphs.map((para) => {
    const trimmed = para.trim();
    if (!trimmed) return "";

    // Split into sentences
    const sentences = trimmed.split(/(?<=[.!?])\s+/);
    const processedSentences = sentences.map((sentence, idx) => {
      // 20% chance to prepend a transition word, but only if it does not start with special characters or a transition itself
      const shouldPrependTransition = Math.random() < 0.20 && 
        sentence.length > 10 && 
        !/^[#@<]|^http/i.test(sentence) &&
        !TRANSITIONS.some(t => sentence.toLowerCase().startsWith(t.toLowerCase()));

      if (shouldPrependTransition) {
        const transition = getRandomElement(TRANSITIONS);
        // Ensure first letter of original sentence is lowercase if we prepend a transition
        let modifiedSentence = sentence;
        if (sentence.length > 0) {
          const firstChar = sentence.charAt(0);
          if (firstChar === firstChar.toUpperCase() && firstChar !== "I" && !/^[A-Z][a-z]*\b/.test(sentence.substring(0, 5))) {
            // Capitalized word, safely lowercase if it's not "I" or single-letter capital start of noun
            modifiedSentence = firstChar.toLowerCase() + sentence.slice(1);
          }
        }
        return transition + modifiedSentence;
      }
      return sentence;
    });

    return processedSentences.join(" ");
  }).filter(Boolean);

  const remixedBody = processedParagraphs.join("\n\n");

  // 3. Place into tone templates
  const toneKey = tone.toLowerCase();
  if (TONE_TEMPLATES[toneKey] && TONE_ELEMENTS[toneKey]) {
    const template = getRandomElement(TONE_TEMPLATES[toneKey]);
    const elements = TONE_ELEMENTS[toneKey];
    
    const intro = getRandomElement(elements.intros);
    const cta = getRandomElement(elements.ctas);
    const hashtags = pickSomeHashtags(elements.hashtags, 2);

    return template
      .replace("{intro}", intro)
      .replace("{content}", remixedBody)
      .replace("{cta}", cta)
      .replace("{hashtags}", hashtags);
  }

  // Default Fallback
  const defaultIntros = ["Thoughts:", "Analysis:", "Perspective:"];
  const intro = getRandomElement(defaultIntros);
  return `📝 ${intro}\n\n${remixedBody}\n\n#analysis`;
}
