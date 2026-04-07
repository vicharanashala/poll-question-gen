import { injectable } from 'inversify';

export interface SpeechAnalysisResult {
  // Existing
  fillerWordCount: number;
  fillerWordsFound: string[];
  wordsPerMinute: number;
  pacingLabel: 'Too Slow' | 'Good' | 'Too Fast';
  avgSentenceLength: number;
  clarityLabel: 'Clear' | 'Moderate' | 'Complex';
  overallScore: number;
  tips: string[];

  // New
  engagementScore: number;
  engagementLabel: 'Low' | 'Moderate' | 'High';
  engagementDescription: string;

  relevanceScore: number | null;
  relevanceLabel: 'Off-Topic' | 'Somewhat Relevant' | 'Relevant' | 'Highly Relevant' | null;
  relevanceDescription: string | null;
  topicKeywordsMatched: string[];

  scoreDescriptions: {
    overall: string;
    pacing: string;
    clarity: string;
    filler: string;
    engagement: string;
    relevance: string;
  };
}

// ── Topic keyword bank ───────────────────────────────────────────────────────
const TOPIC_KEYWORD_BANK: Record<string, string[]> = {
  // CS / Engineering
  'data structures': ['array', 'linked list', 'stack', 'queue', 'tree', 'graph', 'heap', 'hash', 'node', 'pointer', 'traversal', 'recursion', 'sorting', 'searching'],
  'algorithms': ['complexity', 'big o', 'sorting', 'searching', 'divide', 'conquer', 'dynamic programming', 'greedy', 'backtracking', 'recursion', 'iteration'],
  'machine learning': ['model', 'training', 'dataset', 'feature', 'label', 'neural', 'gradient', 'loss', 'accuracy', 'overfitting', 'bias', 'variance', 'classification', 'regression', 'clustering'],
  'deep learning': ['neural network', 'layer', 'activation', 'backpropagation', 'convolution', 'cnn', 'rnn', 'lstm', 'transformer', 'attention', 'gradient', 'epoch', 'batch'],
  'operating systems': ['process', 'thread', 'scheduling', 'deadlock', 'memory', 'paging', 'segmentation', 'kernel', 'interrupt', 'cpu', 'file system', 'synchronization', 'mutex', 'semaphore'],
  'databases': ['sql', 'nosql', 'query', 'table', 'index', 'join', 'transaction', 'acid', 'normalization', 'schema', 'primary key', 'foreign key', 'mongodb', 'relational'],
  'networking': ['protocol', 'tcp', 'ip', 'http', 'dns', 'router', 'packet', 'bandwidth', 'latency', 'firewall', 'osi', 'socket', 'port', 'ssl', 'network'],
  'react': ['component', 'state', 'props', 'hook', 'useeffect', 'usestate', 'jsx', 'render', 'virtual dom', 'context', 'redux', 'lifecycle', 'effect', 'ref'],
  'javascript': ['function', 'async', 'await', 'promise', 'callback', 'closure', 'prototype', 'event', 'dom', 'arrow', 'destructuring', 'module', 'class', 'scope'],
  'python': ['def', 'class', 'list', 'dict', 'tuple', 'loop', 'function', 'module', 'import', 'exception', 'lambda', 'comprehension', 'generator', 'decorator'],
  // Maths
  'calculus': ['derivative', 'integral', 'limit', 'differentiation', 'integration', 'function', 'slope', 'tangent', 'chain rule', 'product rule', 'differential'],
  'linear algebra': ['matrix', 'vector', 'eigenvalue', 'eigenvector', 'determinant', 'transpose', 'inverse', 'dot product', 'cross product', 'rank', 'span'],
  'probability': ['probability', 'random', 'distribution', 'expected value', 'variance', 'normal', 'binomial', 'bayes', 'conditional', 'independence', 'sample space'],
  // Physics
  'mechanics': ['force', 'velocity', 'acceleration', 'momentum', 'energy', 'newton', 'friction', 'gravity', 'torque', 'work', 'power', 'kinetic', 'potential'],
  'thermodynamics': ['heat', 'temperature', 'entropy', 'pressure', 'volume', 'ideal gas', 'carnot', 'first law', 'second law', 'thermodynamic', 'energy'],
  // Generic fallback
  'general': [],
};

@injectable()
export class SpeechAnalysisService {
  private readonly FILLER_WORDS = [
    'um', 'uh', 'like', 'you know', 'so', 'basically',
    'literally', 'right', 'okay so', 'kind of', 'sort of', 'i mean',
  ];

  private readonly ENGAGEMENT_POSITIVE = [
    'imagine', 'think about', 'consider', 'for example', 'for instance',
    'notice', 'observe', 'interesting', 'importantly', 'key point',
    'remember', 'in other words', 'that means', 'what this tells us',
    'why does', 'how does', 'what if', 'let me show', 'look at',
    'question', 'answer', 'understand', 'make sense', 'does that make sense',
  ];

  private readonly ENGAGEMENT_NEGATIVE = [
    'anyway', 'moving on', 'next slide', 'as i said', 'like i mentioned',
    'blah', 'et cetera', 'and so on', 'whatever', 'stuff',
  ];

  analyze(transcript: string, durationInSeconds: number, topic?: string): SpeechAnalysisResult {
    const fillerResult = this.analyzeFillerWords(transcript);
    const pacingResult = this.analyzePacing(transcript, durationInSeconds);
    const clarityResult = this.analyzeClarity(transcript);
    const engagementResult = this.analyzeEngagement(transcript);
    const relevanceResult = topic ? this.analyzeRelevance(transcript, topic) : null;

    const overallScore = this.calculateOverallScore(
      fillerResult.fillerWordCount,
      pacingResult.wordsPerMinute,
      clarityResult.avgSentenceLength,
      engagementResult.engagementScore,
    );

    const tips = this.generateTips(fillerResult, pacingResult, clarityResult, engagementResult);

    return {
      ...fillerResult,
      ...pacingResult,
      ...clarityResult,
      ...engagementResult,
      relevanceScore: relevanceResult?.relevanceScore ?? null,
      relevanceLabel: relevanceResult?.relevanceLabel ?? null,
      relevanceDescription: relevanceResult?.relevanceDescription ?? null,
      topicKeywordsMatched: relevanceResult?.topicKeywordsMatched ?? [],
      overallScore,
      tips,
      scoreDescriptions: this.buildDescriptions(
        pacingResult,
        clarityResult,
        fillerResult,
        engagementResult,
        relevanceResult,
      ),
    };
  }

  // ── Filler words ──────────────────────────────────────────────────────────
  private analyzeFillerWords(transcript: string) {
    const lower = transcript.toLowerCase();
    const fillerWordsFound: string[] = [];
    let fillerWordCount = 0;

    for (const filler of this.FILLER_WORDS) {
      const regex = new RegExp(`\\b${filler.replace(/\s+/g, '\\s+')}\\b`, 'gi');
      const matches = lower.match(regex);
      if (matches && matches.length > 0) {
        fillerWordCount += matches.length;
        fillerWordsFound.push(`${filler} (×${matches.length})`);
      }
    }

    return { fillerWordCount, fillerWordsFound };
  }

  // ── Pacing ────────────────────────────────────────────────────────────────
  private analyzePacing(transcript: string, durationInSeconds: number) {
    const wordCount = transcript.trim().split(/\s+/).length;
    const durationInMinutes = durationInSeconds / 60;
    const wordsPerMinute = Math.round(wordCount / durationInMinutes);

    let pacingLabel: 'Too Slow' | 'Good' | 'Too Fast';
    if (wordsPerMinute < 110) pacingLabel = 'Too Slow';
    else if (wordsPerMinute > 160) pacingLabel = 'Too Fast';
    else pacingLabel = 'Good';

    return { wordsPerMinute, pacingLabel };
  }

  // ── Clarity ───────────────────────────────────────────────────────────────
  private analyzeClarity(transcript: string) {
    const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const wordCount = transcript.trim().split(/\s+/).length;
    const avgSentenceLength = Math.round(wordCount / (sentences.length || 1));

    let clarityLabel: 'Clear' | 'Moderate' | 'Complex';
    if (avgSentenceLength <= 12) clarityLabel = 'Clear';
    else if (avgSentenceLength <= 20) clarityLabel = 'Moderate';
    else clarityLabel = 'Complex';

    return { avgSentenceLength, clarityLabel };
  }

  // ── Engagement (NEW) ──────────────────────────────────────────────────────
  private analyzeEngagement(transcript: string) {
    const lower = transcript.toLowerCase();
    const wordCount = transcript.trim().split(/\s+/).length;

    let positiveHits = 0;
    let negativeHits = 0;

    for (const phrase of this.ENGAGEMENT_POSITIVE) {
      const regex = new RegExp(`\\b${phrase.replace(/\s+/g, '\\s+')}\\b`, 'gi');
      const matches = lower.match(regex);
      if (matches) positiveHits += matches.length;
    }

    for (const phrase of this.ENGAGEMENT_NEGATIVE) {
      const regex = new RegExp(`\\b${phrase.replace(/\s+/g, '\\s+')}\\b`, 'gi');
      const matches = lower.match(regex);
      if (matches) negativeHits += matches.length;
    }

    // Questions asked signal engagement
    const questionCount = (transcript.match(/\?/g) || []).length;
    const questionBonus = Math.min(questionCount * 5, 20);

    // Normalize over word count to avoid penalising short transcripts
    const normalizedPositive = (positiveHits / Math.max(wordCount, 1)) * 1000;
    const normalizedNegative = (negativeHits / Math.max(wordCount, 1)) * 1000;

    const raw = Math.min(100, Math.max(0,
      40 + (normalizedPositive * 8) - (normalizedNegative * 6) + questionBonus,
    ));
    const engagementScore = Math.round(raw);

    let engagementLabel: 'Low' | 'Moderate' | 'High';
    let engagementDescription: string;

    if (engagementScore >= 70) {
      engagementLabel = 'High';
      engagementDescription = 'Your delivery is interactive and student-focused. You use questions, examples, and signposting language that keeps students mentally active.';
    } else if (engagementScore >= 45) {
      engagementLabel = 'Moderate';
      engagementDescription = 'You have some engaging moments but the delivery is mostly lecture-style. Adding more questions and concrete examples will pull students in.';
    } else {
      engagementLabel = 'Low';
      engagementDescription = 'The speech reads as a monologue with few cues that invite student thinking. Try incorporating "what do you think?", analogies, and pauses for reflection.';
    }

    return { engagementScore, engagementLabel, engagementDescription };
  }

  // ── Relevance (NEW) ───────────────────────────────────────────────────────
  private analyzeRelevance(transcript: string, topic: string) {
    const lower = transcript.toLowerCase();
    const topicLower = topic.toLowerCase().trim();

    // Find best matching keyword set
    let keywordSet: string[] = [];
    let bestMatch = '';

    for (const [key, keywords] of Object.entries(TOPIC_KEYWORD_BANK)) {
      if (topicLower.includes(key) || key.includes(topicLower)) {
        keywordSet = keywords;
        bestMatch = key;
        break;
      }
    }

    // Also inject the topic words themselves as keywords
    const topicWords = topicLower.split(/\s+/).filter(w => w.length > 3);
    const allKeywords = [...new Set([...keywordSet, ...topicWords])];

    const topicKeywordsMatched: string[] = [];
    let matchCount = 0;

    for (const kw of allKeywords) {
      const regex = new RegExp(`\\b${kw.replace(/\s+/g, '\\s+')}\\b`, 'gi');
      if (regex.test(lower)) {
        matchCount++;
        topicKeywordsMatched.push(kw);
      }
    }

    const coverage = allKeywords.length > 0 ? matchCount / allKeywords.length : 0;
    const relevanceScore = Math.round(Math.min(100, coverage * 130)); // scale up slightly

    let relevanceLabel: 'Off-Topic' | 'Somewhat Relevant' | 'Relevant' | 'Highly Relevant';
    let relevanceDescription: string;

    if (relevanceScore >= 70) {
      relevanceLabel = 'Highly Relevant';
      relevanceDescription = `The transcript closely covers "${topic}" with strong keyword alignment. Students are likely receiving content well-matched to the learning objective.`;
    } else if (relevanceScore >= 45) {
      relevanceLabel = 'Relevant';
      relevanceDescription = `The transcript covers "${topic}" reasonably well. A few more domain-specific terms and depth would strengthen alignment.`;
    } else if (relevanceScore >= 20) {
      relevanceLabel = 'Somewhat Relevant';
      relevanceDescription = `Some content relates to "${topic}" but significant portions drift off-topic. Refocus the lecture around core concepts.`;
    } else {
      relevanceLabel = 'Off-Topic';
      relevanceDescription = `Very little of the transcript aligns with "${topic}". Consider structuring the session around key domain concepts.`;
    }

    return { relevanceScore, relevanceLabel, relevanceDescription, topicKeywordsMatched };
  }

  // ── Overall score ─────────────────────────────────────────────────────────
  private calculateOverallScore(
    fillerCount: number,
    wpm: number,
    avgSentenceLength: number,
    engagementScore: number,
  ): number {
    const fillerScore = Math.max(0, 100 - fillerCount * 3);

    let pacingScore = 100;
    if (wpm < 110 || wpm > 170) pacingScore = 50;
    else if (wpm < 120 || wpm > 160) pacingScore = 75;

    let clarityScore = 100;
    if (avgSentenceLength > 20) clarityScore = 50;
    else if (avgSentenceLength > 12) clarityScore = 75;

    return Math.round(
      fillerScore     * 0.30 +
      pacingScore     * 0.25 +
      clarityScore    * 0.20 +
      engagementScore * 0.25,
    );
  }

  // ── Score descriptions ────────────────────────────────────────────────────
  private buildDescriptions(
    pacing: { wordsPerMinute: number; pacingLabel: string },
    clarity: { avgSentenceLength: number; clarityLabel: string },
    filler: { fillerWordCount: number },
    engagement: { engagementScore: number; engagementLabel: string },
    relevance: { relevanceScore: number; relevanceLabel: string } | null,
  ) {
    return {
      overall: 'A weighted composite of pacing (25%), clarity (20%), filler word control (30%), and engagement (25%). Scores above 80 indicate a confident, clear, engaging delivery.',
      pacing: `At ${pacing.wordsPerMinute} WPM, your pace is "${pacing.pacingLabel}". Ideal teaching pace is 110–160 WPM — fast enough to maintain interest, slow enough for comprehension.`,
      clarity: `Average sentence length is ${clarity.avgSentenceLength} words — rated "${clarity.clarityLabel}". Shorter sentences (≤12 words) are easier for students to follow in a live session.`,
      filler: `${filler.fillerWordCount} filler words detected. These disrupt the flow of ideas and can undermine perceived confidence. Fewer than 5 per session is excellent.`,
      engagement: `Engagement is measured by how often you use interactive language — questions, examples, signposting, and direct student address. Higher engagement keeps students mentally active.`,
      relevance: relevance
        ? `Relevance checks how much of the transcript vocabulary overlaps with the stated topic's domain keywords. Score: ${relevance.relevanceScore}/100 (${relevance.relevanceLabel}).`
        : 'Enter a topic above to get a relevance score showing how well your speech aligned with the intended subject.',
    };
  }

  // ── Tips ──────────────────────────────────────────────────────────────────
  private generateTips(
    fillerResult: { fillerWordCount: number },
    pacingResult: { wordsPerMinute: number; pacingLabel: string },
    clarityResult: { avgSentenceLength: number; clarityLabel: string },
    engagementResult: { engagementScore: number; engagementLabel: string },
  ): string[] {
    const tips: string[] = [];

    if (fillerResult.fillerWordCount > 10)
      tips.push('High filler word usage detected. Practise pausing silently instead of filling gaps with "um" or "uh" — silence reads as confidence.');
    else if (fillerResult.fillerWordCount > 5)
      tips.push('A handful of filler words were detected. Awareness is the first step — try recording yourself to self-monitor.');

    if (pacingResult.pacingLabel === 'Too Fast')
      tips.push(`You spoke at ${pacingResult.wordsPerMinute} WPM, above the ideal range. Slow down deliberately after key concepts to let students catch up.`);
    else if (pacingResult.pacingLabel === 'Too Slow')
      tips.push(`At ${pacingResult.wordsPerMinute} WPM your pace may lose student attention. Aim for 120–150 WPM for most topics.`);

    if (clarityResult.clarityLabel === 'Complex')
      tips.push('Your sentences average more than 20 words — hard to follow in real-time. Break ideas into two shorter sentences whenever possible.');
    else if (clarityResult.clarityLabel === 'Moderate')
      tips.push('Sentence length is moderate. You can improve clarity by occasionally using very short, punchy sentences for emphasis.');

    if (engagementResult.engagementLabel === 'Low')
      tips.push('Try adding rhetorical questions ("Why does this matter?"), quick examples, or "Does that make sense?" checkpoints to involve students actively.');
    else if (engagementResult.engagementLabel === 'Moderate')
      tips.push('Good engagement foundation — push it higher by opening with a provocative question or surprising fact to hook attention early.');

    if (tips.length === 0)
      tips.push('Excellent session across all dimensions! Your speech was clear, well-paced, confident, and engaging. Keep it up.');

    return tips;
  }
}