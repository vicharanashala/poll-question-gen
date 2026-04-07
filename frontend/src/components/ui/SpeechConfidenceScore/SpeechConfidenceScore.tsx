import React, { useState } from 'react';

interface SpeechAnalysisResult {
  message: string;
  fillerWordCount: number;
  fillerWordsFound: string[];
  wordsPerMinute: number;
  pacingLabel: 'Too Slow' | 'Good' | 'Too Fast';
  avgSentenceLength: number;
  clarityLabel: 'Clear' | 'Moderate' | 'Complex';
  overallScore: number;
  tips: string[];
}

const getScoreColor = (score: number) => {
  if (score > 80) return '#3B6D11';
  if (score > 50) return '#854F0B';
  return '#A32D2D';
};

const getScoreBg = (score: number) => {
  if (score > 80) return '#EAF3DE';
  if (score > 50) return '#FAEEDA';
  return '#FCEBEB';
};

const getScoreLabel = (score: number) => {
  if (score > 80) return 'Excellent';
  if (score > 60) return 'Good';
  if (score > 40) return 'Moderate';
  return 'Needs Work';
};

const getPacingColor = (label: string) => {
  if (label === 'Good') return '#3B6D11';
  return '#854F0B';
};

const getClarityColor = (label: string) => {
  if (label === 'Clear') return '#3B6D11';
  if (label === 'Moderate') return '#854F0B';
  return '#A32D2D';
};

const SpeechConfidenceScore: React.FC = () => {
  const [transcript, setTranscript] = useState('');
  const [duration, setDuration] = useState<number>(60);
  const [result, setResult] = useState<SpeechAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (!transcript.trim()) {
      setError('Please enter a transcript.');
      return;
    }
    if (!duration || duration <= 0) {
      setError('Please enter a valid duration in seconds.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('http://localhost:8000/api/speech-scorer/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, durationInSeconds: duration }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Backend error');
      }

      const data: SpeechAnalysisResult = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze. Make sure the backend is running on port 8000.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'sans-serif' }}>
      <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Speech Confidence Analyzer</h2>
      <p style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>
        Paste a session transcript and duration to get an AI-powered confidence score.
      </p>

      {/* Inputs */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 13, color: '#444', display: 'block', marginBottom: 4 }}>Transcript</label>
        <textarea
          placeholder="Paste or type the transcript here..."
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          rows={6}
          style={{
            width: '100%',
            padding: '10px 12px',
            border: '1px solid #ddd',
            borderRadius: 8,
            fontSize: 14,
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
        <div>
          <label style={{ fontSize: 13, color: '#444', display: 'block', marginBottom: 4 }}>
            Duration (seconds)
          </label>
          <input
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            style={{
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: 8,
              fontSize: 14,
              width: 140,
            }}
          />
        </div>
        <button
          onClick={handleAnalyze}
          disabled={loading}
          style={{
            padding: '9px 22px',
            background: loading ? '#aaa' : '#185FA5',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Analyzing...' : 'Analyze Transcript'}
        </button>
      </div>

      {error && (
        <div style={{
          background: '#FCEBEB', color: '#A32D2D', padding: '10px 14px',
          borderRadius: 8, fontSize: 13, marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Overall Score */}
          <div style={{
            background: getScoreBg(result.overallScore),
            border: `1px solid ${getScoreColor(result.overallScore)}40`,
            borderRadius: 12, padding: '1.25rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: '#555' }}>Overall Confidence Score</span>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '3px 10px',
                background: getScoreColor(result.overallScore), color: '#fff', borderRadius: 6,
              }}>
                {getScoreLabel(result.overallScore)}
              </span>
            </div>
            <div style={{ fontSize: 40, fontWeight: 700, color: getScoreColor(result.overallScore), lineHeight: 1 }}>
              {result.overallScore}<span style={{ fontSize: 18, fontWeight: 400 }}>/100</span>
            </div>

            {/* Score bar */}
            <div style={{ marginTop: 14 }}>
              <div style={{
                height: 8, background: '#ddd', borderRadius: 4, overflow: 'hidden', marginBottom: 4,
              }}>
                <div style={{
                  height: '100%', width: `${result.overallScore}%`,
                  background: getScoreColor(result.overallScore),
                  borderRadius: 4, transition: 'width 0.6s ease',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888' }}>
                <span>Low</span>
                <span>Medium</span>
                <span>High</span>
              </div>
            </div>
          </div>

          {/* Metrics row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>

            <div style={{ background: '#f5f5f5', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Words / min</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{result.wordsPerMinute}</div>
              <div style={{
                fontSize: 11, fontWeight: 500, marginTop: 4,
                color: getPacingColor(result.pacingLabel),
              }}>
                {result.pacingLabel}
              </div>
            </div>

            <div style={{ background: '#f5f5f5', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Filler words</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{result.fillerWordCount}</div>
              <div style={{ fontSize: 11, color: result.fillerWordCount > 10 ? '#A32D2D' : '#3B6D11', marginTop: 4, fontWeight: 500 }}>
                {result.fillerWordCount > 10 ? 'Too many' : result.fillerWordCount > 5 ? 'A few' : 'Great'}
              </div>
            </div>

            <div style={{ background: '#f5f5f5', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Clarity</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{result.avgSentenceLength}</div>
              <div style={{
                fontSize: 11, fontWeight: 500, marginTop: 4,
                color: getClarityColor(result.clarityLabel),
              }}>
                {result.clarityLabel}
              </div>
            </div>
          </div>

          {/* Filler words found */}
          {result.fillerWordsFound.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>Filler words detected</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {result.fillerWordsFound.map((w, i) => (
                  <span key={i} style={{
                    background: '#FAEEDA', color: '#854F0B',
                    fontSize: 12, padding: '3px 10px', borderRadius: 6,
                  }}>
                    {w}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tips */}
          {result.tips.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>Suggestions</div>
              {result.tips.map((tip, i) => (
                <div key={i} style={{
                  borderLeft: '2px solid #ddd', paddingLeft: 10,
                  marginBottom: 8, fontSize: 13, color: '#444', lineHeight: 1.6,
                }}>
                  {tip}
                </div>
              ))}
            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default SpeechConfidenceScore;
