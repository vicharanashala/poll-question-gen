import { injectable } from 'inversify';

export interface SpeechAnalysisResult {
  fillerWordCount: number;
  fillerWordsFound: string[];
  wordsPerMinute: number;
  pacingLabel: 'Too Slow' | 'Good' | 'Too Fast';
  avgSentenceLength: number;
  clarityLabel: 'Clear' | 'Moderate' | 'Complex';
  overallScore: number;
  tips: string[];
}

@injectable()
export class SpeechAnalysisService {
  private readonly FILLER_WORDS = ['um', 'uh', 'like', 'you know', 'so', 'basically', 'literally', 'right'];

  analyze(transcript: string, durationInSeconds: number): SpeechAnalysisResult {
    const fillerResult = this.analyzeFillerWords(transcript);
    const pacingResult = this.analyzePacing(transcript, durationInSeconds);
    const clarityResult = this.analyzeClarity(transcript);
    const overallScore = this.calculateOverallScore(
      fillerResult.fillerWordCount,
      pacingResult.wordsPerMinute,
      clarityResult.avgSentenceLength,
    );
    const tips = this.generateTips(fillerResult, pacingResult, clarityResult);

    return {
      ...fillerResult,
      ...pacingResult,
      ...clarityResult,
      overallScore,
      tips,
    };
  }

  private analyzeFillerWords(transcript: string) {
    const lower = transcript.toLowerCase();
    const fillerWordsFound: string[] = [];
    let fillerWordCount = 0;

    for (const filler of this.FILLER_WORDS) {
      const regex = new RegExp(`\\b${filler}\\b`, 'gi');
      const matches = lower.match(regex);
      if (matches && matches.length > 0) {
        fillerWordCount += matches.length;
        fillerWordsFound.push(`${filler} (${matches.length}x)`);
      }
    }

    return { fillerWordCount, fillerWordsFound };
  }

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

  private calculateOverallScore(fillerCount: number, wpm: number, avgSentenceLength: number): number {
    const fillerScore = Math.max(0, 100 - fillerCount * 3);

    let pacingScore = 100;
    if (wpm < 110 || wpm > 170) pacingScore = 50;
    else if (wpm < 120 || wpm > 160) pacingScore = 75;

    let clarityScore = 100;
    if (avgSentenceLength > 20) clarityScore = 50;
    else if (avgSentenceLength > 12) clarityScore = 75;

    return Math.round((fillerScore * 0.4) + (pacingScore * 0.35) + (clarityScore * 0.25));
  }

  private generateTips(
    fillerResult: { fillerWordCount: number },
    pacingResult: { wordsPerMinute: number; pacingLabel: string },
    clarityResult: { avgSentenceLength: number; clarityLabel: string },
  ): string[] {
    const tips: string[] = [];

    if (fillerResult.fillerWordCount > 10)
      tips.push('You used many filler words. Try pausing silently instead of saying "um" or "uh".');
    else if (fillerResult.fillerWordCount > 5)
      tips.push('A few filler words detected. Being mindful of them will improve your confidence.');

    if (pacingResult.pacingLabel === 'Too Fast')
      tips.push('You are speaking too fast. Slow down to give students time to absorb content.');
    else if (pacingResult.pacingLabel === 'Too Slow')
      tips.push('Your pace is a bit slow. Picking up speed slightly will keep students engaged.');

    if (clarityResult.clarityLabel === 'Complex')
      tips.push('Your sentences are quite long. Try breaking them into shorter, clearer statements.');

    if (tips.length === 0)
      tips.push('Great session! Your speech was clear, well-paced, and confident.');

    return tips;
  }
}