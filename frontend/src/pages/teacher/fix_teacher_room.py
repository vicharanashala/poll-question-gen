import sys
import os

filepath = r'c:\question-generation-module\frontend\src\pages\teacher\TeacherPollRoom.tsx'

if not os.path.exists(filepath):
    print(f"File not found: {filepath}")
    sys.exit(1)

with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the point where the main content area ends (div 2580)
# We know it's around 4282 (was Modal end).
# The lines 4283, 4284, 4285 were the closers we want to fix.

# Actually, let's find the FIRST occurrence of the AI Sidebar comment
sidebar_comment = '{/* ── Right AI Results Sidebar ── */}'
sidebar_index = -1
for i, line in enumerate(lines):
    if sidebar_comment in line:
        sidebar_index = i
        break

if sidebar_index == -1:
    print("Sidebar comment not found")
    sys.exit(1)

# Keep everything before the Sidebar, but remove the extra closing divs if any.
# We know the Main Content area ends just before the sidebar.
# Let's find the last '/>' before the sidebar comment.
modal_end_index = -1
for i in range(sidebar_index - 1, 0, -1):
    if '/>' in lines[i]:
        modal_end_index = i
        break

if modal_end_index == -1:
    print("Modal end not found before sidebar")
    sys.exit(1)

# The content up to modal_end_index + 1 is the Modal.
# Then we need to close the Main Content (div 2580).
core_content = lines[:modal_end_index + 1]
core_content.append('          </div>\n') # Closes 2580 (Main content area)

sidebar_code = """          {/* ── Right AI Results Sidebar ── */}
          {(isProcessing || queuedGeneratedQuestions.length > 0) && (
            <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 flex flex-col h-full transition-all duration-300">
              <div className="p-4 flex flex-col h-full overflow-hidden">
                {/* Generating indicator */}
                {isProcessing && (
                  <div className="bg-white dark:bg-gray-900 border border-purple-300 dark:border-purple-700 rounded-xl shadow-lg px-4 py-3 mb-4 flex items-center gap-3 animate-pulse">
                    <Loader2 className="h-5 w-5 text-purple-500 animate-spin flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-purple-700 dark:text-purple-300">AI Generating…</p>
                      <p className="text-xs text-muted-foreground whitespace-nowrap">Processing speech history</p>
                    </div>
                  </div>
                )}

                {/* Generated questions list */}
                {queuedGeneratedQuestions.length > 0 ? (
                  <div className="bg-white dark:bg-gray-900 border border-purple-200 dark:border-purple-800 rounded-xl shadow-md overflow-hidden flex flex-col flex-1">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-purple-50 to-white dark:from-purple-900/30 dark:to-gray-900">
                      <div className="flex items-center gap-2">
                        <Wand2 className="h-4 w-4 text-purple-500" />
                        <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">AI Results</span>
                        <span className="text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded-full font-medium">
                          {queuedGeneratedQuestions.length}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => {
                          setQueuedGeneratedQuestions([]);
                          queuedGeneratedQuestionsRef.current = [];
                        }}
                      >
                        Clear
                      </Button>
                    </div>

                    {/* Scrollable question list */}
                    <ScrollArea className="flex-1 overflow-y-auto">
                      <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {queuedGeneratedQuestions.map((q, idx) => (
                          <div key={idx} className="p-3 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-colors">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 leading-snug">
                              {q.question}
                            </p>
                            <div className="flex flex-col gap-1 mb-3">
                              {q.options.map((opt, optIdx) => (
                                <div
                                  key={optIdx}
                                  className={`px-2 py-1 rounded text-[10px] sm:text-xs ${
                                    optIdx === q.correctOptionIndex
                                      ? 'bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 font-medium'
                                      : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                                  }`}
                                >
                                  {opt || `Option ${optIdx + 1}`}
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="flex-1 h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white"
                                onClick={() => {
                                  setQuestion(q.question);
                                  setOptions(q.options);
                                  setCorrectOptionIndex(q.correctOptionIndex);
                                  toast.success('Question loaded to form');
                                }}
                              >
                                Load into form
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                onClick={() => {
                                  const newQ = [...queuedGeneratedQuestions];
                                  newQ.splice(idx, 1);
                                  setQueuedGeneratedQuestions(newQ);
                                  queuedGeneratedQuestionsRef.current = newQ;
                                }}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center opacity-40 text-center px-4">
                    <Wand2 className="h-8 w-8 mb-2 text-purple-400" />
                    <p className="text-xs">No questions yet. Keep talking to generate questions automatically.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <ConfirmationModal {...modalProps} />
    </div>
  );
}
"""

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(core_content)
    f.write(sidebar_code)

print("File fixed successfully")
