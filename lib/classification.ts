// Rule-based content classifier — no LLM required.
// Returns null for any dimension that cannot be confidently detected.
// 9 topic buckets; more specific rules appear before broader ones so
// "AI SDR" matches "AI in Sales" before "Sales Enablement".

export interface ClassificationResult {
  topic: string | null;
  format: string | null;
  hook: string | null;
  angle: string | null;
  funnelStage: string | null;
  audiencePersona: string | null;
}

// ─── Topic ────────────────────────────────────────────────────────────────────

const TOPIC_RULES: Array<{ topic: string; keywords: string[] }> = [
  {
    topic: "AI in Sales",
    keywords: [
      "ai sdr", "ai workflow", "ai-powered sales", "ai sales",
      "llm", "generative ai", "chatgpt", "ai stack", "ai automation",
    ],
  },
  {
    topic: "GTM Automation",
    keywords: [
      "automation stack", "gtm automation", "automated workflow",
      "zapier", "clay", "n8n", "make.com", "automation tool",
    ],
  },
  {
    topic: "Sales Enablement",
    keywords: [
      "sdr", "prospecting", "cold email", "outbound", "account executive",
      "bdr", "sales development", "cold outreach", "sales sequence",
    ],
  },
  {
    topic: "Content ROI",
    keywords: [
      "content roi", "roi attribution", "content attribution",
      "content performance", "revenue from content", "content pipeline",
    ],
  },
  {
    topic: "GTM Strategy",
    keywords: [
      "go-to-market", "gtm strategy", "gtm stack", "positioning",
      "launch strategy", "market entry", "product launch", "founder-led",
    ],
  },
  {
    topic: "LinkedIn Strategy",
    keywords: [
      "linkedin", "personal brand", "thought leadership", "b2b content",
      "content engine", "creator", "newsletter",
    ],
  },
  {
    topic: "PLG",
    keywords: [
      "product-led", "product led", "plg", "self-serve",
      "freemium", "free trial", "product-led growth",
    ],
  },
  {
    topic: "RevOps",
    keywords: [
      "revops", "revenue operations", "crm", "hubspot",
      "salesforce", "ops stack",
    ],
  },
  {
    topic: "Demand Generation",
    keywords: [
      "demand gen", "demand generation", "inbound", "lead gen",
      "pipeline generation", "b2b demand",
    ],
  },
];

function detectTopic(text: string): string | null {
  for (const { topic, keywords } of TOPIC_RULES) {
    if (keywords.some((kw) => text.includes(kw))) return topic;
  }
  return null;
}

// ─── Format ───────────────────────────────────────────────────────────────────

function detectFormat(title: string): string | null {
  const t = title.toLowerCase();

  if (
    /\b\d+\s+(ways?|tips?|tools?|mistakes?|reasons?|things?|steps?|ideas?)\b/.test(t) ||
    /\btop\s+\d+\b/.test(t)
  ) {
    return "listicle";
  }
  if (
    /\bhow[\s-]to\b/.test(t) ||
    /\b(guide|walkthrough|step[\s-]by[\s-]step|tutorial)\b/.test(t)
  ) {
    return "tutorial";
  }
  if (
    /\bcase[\s-]study\b/.test(t) ||
    /\bhow\s+(i|we)\s/.test(t) ||
    /\b(results|scaled|grew|built|launched)\b/.test(t)
  ) {
    return "case-study";
  }
  if (
    /\bwhy\s+(you|i|we|most)\b/.test(t) ||
    /\b(stop|don'?t|hot\s+take|truth\s+(about|is)|unpopular|overrated|underrated)\b/.test(t)
  ) {
    return "opinion";
  }
  return null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

function detectHook(title: string): string | null {
  const t = title.toLowerCase().trim();

  if (t.endsWith("?")) return "question";

  // Genuine question openers — "how to" is a format signal, not a hook
  if (/^(why|what|when|should|can|is|are|do|does)\b/.test(t)) return "question";
  if (/^how\b/.test(t) && !/^how[\s-]to\b/.test(t)) return "question";

  // Stat: numeric claim with %, $, multiplier, or large standalone number
  if (/\b\d+(\.\d+)?%|\$\d+|\b\d+x\b|\b\d+(k|m)\b/.test(t)) return "stat";

  // Story: first-person narrative opener
  if (/^(i |we |how i |how we )/.test(t)) return "story";

  // Contrarian
  if (/\b(don'?t|stop|wrong|myth|truth|actually|overrated|underrated)\b/.test(t)) {
    return "contrarian";
  }

  return null;
}

// ─── Angle ────────────────────────────────────────────────────────────────────

function detectAngle(title: string, description: string): string | null {
  const text = (title + " " + description).toLowerCase();
  const t = title.toLowerCase();

  if (/\bvs\.?\b|\bversus\b|\bcompared\s+(to|with)\b|\balternative\b/.test(text)) {
    return "comparison";
  }
  if (/\bhow[\s-]to\b|\bstep[\s-]by[\s-]step\b/.test(t)) return "how-to";
  if (
    /\b(beginner|101|getting\s+started|starter\s+guide|basics|intro(duction)?|for\s+beginners)\b/.test(
      text
    )
  ) {
    return "beginner";
  }
  if (/\b(advanced|deep[\s-]dive|expert|pro\s+tip|mastering|mastery)\b/.test(text)) {
    return "advanced";
  }
  return null;
}

// ─── Derived fields ───────────────────────────────────────────────────────────

function deriveFunnelStage(format: string | null): string | null {
  switch (format) {
    case "opinion":
    case "listicle":
      return "awareness";
    case "tutorial":
    case "case-study":
      return "consideration";
    default:
      return null;
  }
}

function deriveAudiencePersona(topic: string | null): string | null {
  switch (topic) {
    case "Sales Enablement":
      return "SDR";
    case "AI in Sales":
    case "GTM Strategy":
    case "GTM Automation":
      return "Founder";
    case "RevOps":
      return "RevOps";
    case "PLG":
      return "Product";
    case "Content ROI":
    case "LinkedIn Strategy":
    case "Demand Generation":
      return "Content Marketer";
    default:
      return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function classifyContent(
  title: string,
  description: string
): ClassificationResult {
  const combinedText = (title + " " + description).toLowerCase();

  const topic = detectTopic(combinedText);
  const format = detectFormat(title);
  const hook = detectHook(title);
  const angle = detectAngle(title, description);
  const funnelStage = deriveFunnelStage(format);
  const audiencePersona = deriveAudiencePersona(topic);

  return { topic, format, hook, angle, funnelStage, audiencePersona };
}