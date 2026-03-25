const TYPES = {
  LLMController: Symbol.for('LLMController'),

  // Controllers
  GenAIVideoController: Symbol.for('GenAIVideoController'),
  
  // Services
  VideoService: Symbol.for('VideoService'),
  AudioService: Symbol.for('AudioService'),
  AIContentService: Symbol.for('AIContentService'),
  RAGAIContentService: Symbol.for('RAGAIContentService'),
  CleanupService: Symbol.for('CleanupService'),
};

export {TYPES as GENAI_TYPES};
