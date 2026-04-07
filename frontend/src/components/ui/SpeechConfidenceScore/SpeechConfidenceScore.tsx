import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from 'next-themes';

interface SpeechAnalysisResult {
  message: string;
  fillerWordCount: number;
  fillerWordsFound: string[];
  wordsPerMinute: number;
  pacingLabel: 'Too Slow' | 'Good' | 'Too Fast';
  avgSentenceLength: number;
  clarityLabel: 'Clear' | 'Moderate' | 'Complex';
  overallScore: number;
  // engagementScore: number;
  // engagementLabel: 'Low' | 'Moderate' | 'High';
  // engagementDescription: string;
  relevanceScore: number | null;
  relevanceLabel: 'Off-Topic' | 'Somewhat Relevant' | 'Relevant' | 'Highly Relevant' | null;
  relevanceDescription: string | null;
  topicKeywordsMatched: string[];
  tips: string[];
  scoreDescriptions?: {
    overall: string;
    pacing: string;
    clarity: string;
    filler: string;
    // engagement: string;
    relevance: string;
  };
}

const scoreGradient = (score: number) => {
  if (score >= 80) return { from: '#10b981', to: '#059669', text: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)' };
  if (score >= 55) return { from: '#f59e0b', to: '#d97706', text: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' };
  return { from: '#ef4444', to: '#dc2626', text: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)' };
};

const scoreLabel = (score: number) => {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Moderate';
  if (score >= 30) return 'Needs Work';
  return 'Poor';
};

const relevanceColor = (label: string | null) => {
  if (label === 'Highly Relevant') return { text: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)' };
  if (label === 'Relevant') return { text: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.25)' };
  if (label === 'Somewhat Relevant') return { text: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' };
  return { text: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)' };
};

const pacingColor = (label: string) => label === 'Good' ? '#10b981' : '#f59e0b';
const clarityColor = (label: string) =>
  label === 'Clear' ? '#10b981' : label === 'Moderate' ? '#f59e0b' : '#ef4444';

// ── Tooltip ───────────────────────────────────────────────────────────────────
const Tooltip: React.FC<{ text: string; isDark: boolean }> = ({ text, isDark }) => {
  const [show, setShow] = useState(false);
  if (!text) return null;
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#6b7280', fontSize: 12, marginLeft: 4, padding: '0 2px', lineHeight: 1,
        }}
      >ⓘ</button>
      {show && (
        <span style={{
          position: 'absolute', left: '50%', bottom: '130%',
          transform: 'translateX(-50%)',
          background: isDark ? '#1e293b' : '#ffffff',
          color: isDark ? '#e2e8f0' : '#1f2937',
          border: isDark ? 'none' : '1px solid #e5e7eb',
          fontSize: 11, lineHeight: 1.5,
          padding: '8px 12px', borderRadius: 8, width: 220, zIndex: 100,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)', pointerEvents: 'none',
        }}>
          {text}
        </span>
      )}
    </span>
  );
};

// ── Score ring ────────────────────────────────────────────────────────────────
const ScoreRing: React.FC<{ score: number; size?: number; strokeWidth?: number }> = ({
  score, size = 100, strokeWidth = 8,
}) => {
  const col = scoreGradient(score);
  const r = (size - strokeWidth * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const id = `grad-${score}`;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={col.from} />
          <stop offset="100%" stopColor={col.to} />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={`url(#${id})`} strokeWidth={strokeWidth}
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
      />
    </svg>
  );
};

// ── Mini bar ──────────────────────────────────────────────────────────────────
const MiniBar: React.FC<{ value: number; color: string; label?: string; isDark: boolean }> = ({ value, color, label, isDark }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <div style={{ flex: 1, height: 5, background: isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${value}%`, background: color,
        borderRadius: 99, transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
      }} />
    </div>
    {label && <span style={{ fontSize: 11, color: '#9ca3af', minWidth: 28, textAlign: 'right' }}>{label}</span>}
  </div>
);

// ── Metric card ───────────────────────────────────────────────────────────────
const MetricCard: React.FC<{
  title: string;
  value: string | number;
  sub: string;
  subColor: string;
  description: string;
  scoreValue?: number;
  isDark: boolean;
}> = ({ title, value, sub, subColor, description, scoreValue, isDark }) => (
  <div style={{
    background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
    border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e5e7eb',
    borderRadius: 14, padding: '1rem 1.1rem',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
      <span style={{ fontSize: 11, color: isDark ? '#9ca3af' : '#6b7280', letterSpacing: '.03em', textTransform: 'uppercase' }}>
        {title}
      </span>
      <span style={{
        fontSize: 10, fontWeight: 600, padding: '2px 8px',
        background: subColor + '22', color: subColor,
        borderRadius: 6, border: `1px solid ${subColor}44`,
      }}>{sub}</span>
    </div>
    <div style={{ fontSize: 28, fontWeight: 700, color: isDark ? '#f1f5f9' : '#1f2937', lineHeight: 1, marginBottom: 6 }}>
      {value}
    </div>
    {scoreValue !== undefined && (
      <MiniBar value={scoreValue} color={subColor} label={`${scoreValue}`} isDark={isDark} />
    )}
    <p style={{ fontSize: 11.5, color: isDark ? '#6b7280' : '#9ca3af', lineHeight: 1.6, marginTop: 8 }}>{description}</p>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
const SpeechConfidenceScore: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [duration, setDuration] = useState<number>(60);
  const [topic, setTopic] = useState('');
  const [result, setResult] = useState<SpeechAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // Prevent flash of wrong theme before mount
  if (!mounted) return null;

  const isDark = resolvedTheme === 'dark';

  const handleAnalyze = async () => {
    if (!transcript.trim()) { setError('Please enter a transcript.'); return; }
    if (!duration || duration <= 0) { setError('Please enter a valid duration in seconds.'); return; }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('http://localhost:8000/api/speech-scorer/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, durationInSeconds: duration, topic: topic.trim() || undefined }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Backend error');
      }
      const data: SpeechAnalysisResult = await res.json();
      setResult(data);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const col = result ? scoreGradient(result.overallScore) : null;

  return (
    <div style={{
      maxWidth: 720, margin: '0 auto', padding: '1.5rem 1.25rem',
      fontFamily: "'Inter', system-ui, sans-serif",
      color: isDark ? '#f1f5f9' : '#1f2937',
    }}>
      {/* ── Input panel ── */}
      <div style={{
        background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
        border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e5e7eb',
        borderRadius: 18, padding: '1.5rem', marginBottom: '1.5rem',
      }}>
        {/* Topic */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{
            fontSize: 12, color: isDark ? '#9ca3af' : '#6b7280', display: 'block', marginBottom: 6,
            letterSpacing: '.03em', textTransform: 'uppercase',
          }}>
            Topic / Course{' '}
            <span style={{ color: isDark ? '#6b7280' : '#9ca3af', textTransform: 'none', letterSpacing: 0 }}>
              (optional — enables relevance scoring)
            </span>
          </label>
          <input
            placeholder="e.g. Data Structures, React, Machine Learning, Calculus…"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            style={{
              width: '100%', padding: '0.6rem 0.9rem',
              background: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb',
              border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
              borderRadius: 10,
              color: isDark ? '#f1f5f9' : '#1f2937',
              fontSize: 14,
              outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s',
            }}
          />
        </div>

        {/* Transcript */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{
            fontSize: 12, color: isDark ? '#9ca3af' : '#6b7280', display: 'block', marginBottom: 6,
            letterSpacing: '.03em', textTransform: 'uppercase',
          }}>
            Transcript
          </label>
          <textarea
            placeholder="Paste the session transcript here…"
            value={transcript}
            onChange={e => setTranscript(e.target.value)}
            rows={6}
            style={{
              width: '100%', padding: '0.7rem 0.9rem',
              background: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb',
              border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
              borderRadius: 10,
              color: isDark ? '#f1f5f9' : '#1f2937',
              fontSize: 14,
              resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6,
            }}
          />
          {transcript && (
            <div style={{ fontSize: 11, color: isDark ? '#6b7280' : '#9ca3af', marginTop: 4 }}>
              {transcript.trim().split(/\s+/).length} words
            </div>
          )}
        </div>

        {/* Duration + Analyze */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <label style={{
              fontSize: 12, color: isDark ? '#9ca3af' : '#6b7280', display: 'block', marginBottom: 6,
              letterSpacing: '.03em', textTransform: 'uppercase',
            }}>
              Duration (seconds)
            </label>
            <input
              type="number" min={1} value={duration}
              onChange={e => setDuration(Number(e.target.value))}
              style={{
                padding: '0.6rem 0.9rem', width: 130,
                background: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb',
                border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                borderRadius: 10,
                color: isDark ? '#f1f5f9' : '#1f2937',
                fontSize: 14, outline: 'none',
              }}
            />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading}
            style={{
              flex: 1, padding: '0.65rem 1rem',
              background: loading ? (isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6') : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: loading ? '#6b7280' : '#fff',
              border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s', letterSpacing: '.01em',
            }}
          >
            {loading
              ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{
                    display: 'inline-block', width: 14, height: 14,
                    border: '2px solid #6b7280', borderTopColor: isDark ? '#f1f5f9' : '#1f2937',
                    borderRadius: '50%', animation: 'spin 0.7s linear infinite',
                  }} />
                  Analyzing…
                </span>
              )
              : '⚡ Analyze Speech'}
          </button>
        </div>

        {error && (
          <div style={{
            marginTop: 12, padding: '10px 14px', borderRadius: 10,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            color: '#fca5a5', fontSize: 13,
          }}>
            {error}
          </div>
        )}
      </div>

      {/* ── Results ── */}
      {result && col && (
        <div ref={resultsRef} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Overall score hero */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.08))',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 18, padding: '1.75rem',
            display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap',
          }}>
            {/* Ring */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <ScoreRing score={result.overallScore} size={108} strokeWidth={9} />
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 26, fontWeight: 800, color: col.text, lineHeight: 1 }}>
                  {result.overallScore}
                </span>
                <span style={{ fontSize: 10, color: isDark ? '#9ca3af' : '#6b7280', marginTop: 2 }}>/100</span>
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: isDark ? '#f1f5f9' : '#1f2937' }}>Overall Score</span>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '3px 10px',
                  background: col.bg, color: col.text,
                  border: `1px solid ${col.border}`, borderRadius: 20,
                }}>
                  {scoreLabel(result.overallScore)}
                </span>
                <Tooltip text={result.scoreDescriptions?.overall ?? ''} isDark={isDark} />
              </div>

              {/* Sub-score bars */}
              {[
  { label: 'Filler Control', value: Math.max(0, 100 - result.fillerWordCount * 3), color: scoreGradient(Math.max(0, 100 - result.fillerWordCount * 3)).from },
  { label: 'Pacing', value: result.pacingLabel === 'Good' ? 100 : 50, color: pacingColor(result.pacingLabel) },
  { label: 'Clarity', value: result.clarityLabel === 'Clear' ? 100 : result.clarityLabel === 'Moderate' ? 75 : 50, color: clarityColor(result.clarityLabel) },
  //{ label: 'Engagement', value: result.engagementScore, color: scoreGradient(result.engagementScore).from },
].map(s => (
  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
    
    {/* Label */}
    <span style={{ fontSize: 11, color: '#9ca3af', width: 90 }}>
      {s.label}
    </span>

    {/* Bar */}
    <div style={{ flex: 1 }}>
      <MiniBar value={s.value} color={s.color} />
    </div>

    {/* VALUE (THIS WAS MISSING) */}
    <span style={{
      fontSize: 11,
      fontWeight: 600,
      color: s.color,
      minWidth: 28,
      textAlign: 'right'
    }}>
      {s.value}
    </span>

  </div>
))}
            </div>
          </div>

          {/* 4-metric grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 12 }}>
            <MetricCard
              title="Pacing"
              value={`${result.wordsPerMinute} wpm`}
              sub={result.pacingLabel}
              subColor={pacingColor(result.pacingLabel)}
              description={result.scoreDescriptions?.pacing ?? ''}
              scoreValue={result.pacingLabel === 'Good' ? 100 : 50}
              isDark={isDark}
            />
            <MetricCard
              title="Filler Words"
              value={result.fillerWordCount}
              sub={result.fillerWordCount > 10 ? 'Too many' : result.fillerWordCount > 5 ? 'A few' : 'Great'}
              subColor={result.fillerWordCount > 10 ? '#ef4444' : result.fillerWordCount > 5 ? '#f59e0b' : '#10b981'}
              description={result.scoreDescriptions?.filler ?? ''}
              scoreValue={Math.max(0, 100 - result.fillerWordCount * 3)}
              isDark={isDark}
            />
            <MetricCard
              title="Clarity"
              value={`${result.avgSentenceLength}w`}
              sub={result.clarityLabel}
              subColor={clarityColor(result.clarityLabel)}
              description={result.scoreDescriptions?.clarity ?? ''}
              scoreValue={result.clarityLabel === 'Clear' ? 100 : result.clarityLabel === 'Moderate' ? 75 : 50}
              isDark={isDark}
            />
            {/* <MetricCard
              title="Engagement"
              value={result.engagementScore}
              sub={result.engagementLabel}
              subColor={scoreGradient(result.engagementScore).from}
              description={result.engagementDescription}
              scoreValue={result.engagementScore}
              isDark={isDark}
            /> */}
          </div>

          {/* Relevance card */}
          {result.relevanceScore !== null && result.relevanceLabel
            ? (() => {
              const rc = relevanceColor(result.relevanceLabel);
              return (
                <div style={{ background: rc.bg, border: `1px solid ${rc.border}`, borderRadius: 14, padding: '1.25rem' }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#f1f5f9' : '#1f2937' }}>📌 Topic Relevance</span>
                      <Tooltip text={result.scoreDescriptions?.relevance ?? ''} isDark={isDark} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 26, fontWeight: 700, color: rc.text }}>{result.relevanceScore}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '3px 10px',
                        background: rc.bg, color: rc.text,
                        border: `1px solid ${rc.border}`, borderRadius: 20,
                      }}>{result.relevanceLabel}</span>
                    </div>
                  </div>
                  <MiniBar value={result.relevanceScore} color={rc.text} isDark={isDark} />
                  <p style={{ fontSize: 12.5, color: isDark ? '#9ca3af' : '#6b7280', marginTop: 10, lineHeight: 1.6 }}>
                    {result.relevanceDescription}
                  </p>
                  {result.topicKeywordsMatched.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <span style={{ fontSize: 11, color: isDark ? '#6b7280' : '#9ca3af', marginBottom: 6, display: 'block' }}>
                        Keywords matched ({result.topicKeywordsMatched.length})
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {result.topicKeywordsMatched.map((kw, i) => (
                          <span key={i} style={{
                            fontSize: 11, padding: '2px 8px',
                            background: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6',
                            borderRadius: 6, color: rc.text,
                            border: `1px solid ${rc.border}`,
                          }}>{kw}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()
            : (
              <div style={{
                background: isDark ? 'rgba(255,255,255,0.02)' : '#f9fafb',
                border: isDark ? '1px dashed rgba(255,255,255,0.1)' : '1px dashed #e5e7eb',
                borderRadius: 14, padding: '1rem 1.25rem',
                fontSize: 13, color: isDark ? '#6b7280' : '#9ca3af',
              }}>
                📌 <b style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Topic Relevance</b> —{' '}
                {result.scoreDescriptions?.relevance ?? 'Enter a topic above to enable relevance scoring.'}
              </div>
            )
          }

          {/* Filler words detected */}
          {result.fillerWordsFound.length > 0 && (
            <div style={{
              background: 'rgba(245,158,11,0.06)',
              border: '1px solid rgba(245,158,11,0.15)',
              borderRadius: 14, padding: '1.1rem 1.25rem',
            }}>
              <span style={{ fontSize: 12, color: isDark ? '#9ca3af' : '#6b7280', display: 'block', marginBottom: 8 }}>
                Filler words detected
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {result.fillerWordsFound.map((w, i) => (
                  <span key={i} style={{
                    fontSize: 12, padding: '4px 10px',
                    background: 'rgba(245,158,11,0.12)',
                    color: '#fbbf24', borderRadius: 8,
                    border: '1px solid rgba(245,158,11,0.25)', fontWeight: 500,
                  }}>{w}</span>
                ))}
              </div>
            </div>
          )}

          {/* Tips */}
          <div style={{
            background: isDark ? 'rgba(255,255,255,0.02)' : '#f9fafb',
            border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e5e7eb',
            borderRadius: 14, padding: '1.25rem',
          }}>
            <span style={{
              fontSize: 12, color: isDark ? '#9ca3af' : '#6b7280', display: 'block', marginBottom: 12,
              textTransform: 'uppercase', letterSpacing: '.04em',
            }}>
              Suggestions
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {result.tips.map((tip, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                  padding: '10px 12px', borderRadius: 10,
                  background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
                  border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e5e7eb',
                }}>
                  <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>
                    {i === 0 ? '🎯' : i === 1 ? '⏱' : i === 2 ? '✂️' : '💡'}
                  </span>
                  <p style={{ fontSize: 13, color: isDark ? '#cbd5e1' : '#374151', lineHeight: 1.65, margin: 0 }}>{tip}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        textarea:focus, input:focus { border-color: rgba(99,102,241,0.5) !important; }
      `}</style>
    </div>
  );
};

export default SpeechConfidenceScore;