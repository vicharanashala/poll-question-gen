const TYPES = {
  // Controllers
  PollRoomController: Symbol.for('PollRoomController'),
  DashboardController: Symbol.for('DashboardController'),

  // Services
  PollService: Symbol.for('PollService'),
  RoomService: Symbol.for('RoomService'),
  DashboardService: Symbol.for('DashboardService'),

  // ✅ Add GenAI / media services
  VideoService: Symbol.for('VideoService'),
  AudioService: Symbol.for('AudioService'),
  TranscriptionService: Symbol.for('TranscriptionService'),
  AIContentService: Symbol.for('AIContentService'),
  RAGAIContentService: Symbol.for('RAGAIContentService'),
  CleanupService: Symbol.for('CleanupService'),

  // Socket.IO
  PollSocket: Symbol.for('PollSocket'),
};

export { TYPES as LIVE_QUIZ_TYPES };
