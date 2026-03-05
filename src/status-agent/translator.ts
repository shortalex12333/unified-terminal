/**
 * Status Agent Translator
 *
 * Pure lookup-based translation from backend StatusEvents to user-facing StatusLines.
 * NO LLM calls - all translations are pre-defined.
 */

import {
  StatusEvent,
  StatusLine,
  StatusState,
  TranslationResult,
  TranslationMap,
} from './types';

import {
  processVoice,
  humanizeFileName,
  humanizeTask,
  simplifyReason,
  truncate,
} from './voice';

// =============================================================================
// HELPER FUNCTIONS - Parse event details
// =============================================================================

/**
 * Safely parses JSON detail string
 */
function parseDetail<T = Record<string, unknown>>(detail: string): T | null {
  try {
    return JSON.parse(detail) as T;
  } catch {
    return null;
  }
}

/**
 * Extracts a human-friendly file reference from detail
 */
function extractFileName(detail: string): string {
  const data = parseDetail<{ file?: string; path?: string; filename?: string }>(detail);
  const filePath = data?.file || data?.path || data?.filename || '';
  return humanizeFileName(filePath);
}

/**
 * Extracts step number from detail
 */
function extractStepId(detail: string): number | null {
  const data = parseDetail<{ stepId?: number; step?: number }>(detail);
  return data?.stepId ?? data?.step ?? null;
}

/**
 * Extracts progress percentage from detail
 */
function extractProgress(detail: string): number | null {
  const data = parseDetail<{ progress?: number; percent?: number }>(detail);
  const progress = data?.progress ?? data?.percent;
  return typeof progress === 'number' ? Math.min(100, Math.max(0, progress)) : null;
}

/**
 * Extracts URL from detail
 */
function extractUrl(detail: string): string {
  const data = parseDetail<{ url?: string; link?: string }>(detail);
  return data?.url || data?.link || '';
}

// =============================================================================
// CONDUCTOR TRANSLATIONS
// =============================================================================

const conductorTranslations: TranslationMap = {
  'conductor:classify': () => ({
    text: 'Understanding what you need...',
    icon: '💭',
    state: 'active' as StatusState,
  }),

  'conductor:plan-ready': (detail) => {
    const data = parseDetail<{ stepCount?: number }>(detail);
    const steps = data?.stepCount;
    return {
      text: steps ? `Got it! Planning ${steps} steps...` : 'Got it! Making a plan...',
      icon: '📋',
      state: 'active' as StatusState,
    };
  },

  'conductor:re-plan': (detail) => {
    const data = parseDetail<{ reason?: string }>(detail);
    const reason = data?.reason ? simplifyReason(data.reason) : '';
    return {
      text: reason ? `Adjusting plan: ${truncate(reason, 4)}` : 'Adjusting the plan...',
      icon: '🔄',
      state: 'active' as StatusState,
    };
  },

  'conductor:start': () => ({
    text: 'Starting your task...',
    icon: '🚀',
    state: 'active' as StatusState,
  }),

  'conductor:complete': () => ({
    text: 'All done!',
    icon: '✅',
    state: 'done' as StatusState,
  }),

  'conductor:error': (detail) => {
    const data = parseDetail<{ reason?: string }>(detail);
    const reason = data?.reason ? simplifyReason(data.reason) : 'something went wrong';
    return {
      text: `Hit a snag: ${truncate(reason, 4)}`,
      icon: '❌',
      state: 'error' as StatusState,
    };
  },
};

// =============================================================================
// WORKER TRANSLATIONS
// =============================================================================

const workerTranslations: TranslationMap = {
  'worker:spawn': (detail) => {
    const data = parseDetail<{ task?: string }>(detail);
    const task = data?.task ? humanizeTask(data.task) : 'task';
    return {
      text: `${task}...`,
      icon: '⚙️',
      state: 'active' as StatusState,
      stepId: extractStepId(detail),
    };
  },

  'worker:file-created': (detail) => {
    const name = extractFileName(detail);
    return {
      text: `Created ${name}`,
      icon: '📄',
      state: 'done' as StatusState,
      expandable: true,
    };
  },

  'worker:file-edited': (detail) => {
    const name = extractFileName(detail);
    return {
      text: `Updated ${name}`,
      icon: '✏️',
      state: 'done' as StatusState,
      expandable: true,
    };
  },

  'worker:file-deleted': (detail) => {
    const name = extractFileName(detail);
    return {
      text: `Removed ${name}`,
      icon: '🗑️',
      state: 'done' as StatusState,
    };
  },

  'worker:complete': (detail) => {
    const data = parseDetail<{ result?: string }>(detail);
    return {
      text: 'Finished this step',
      icon: '✓',
      state: 'done' as StatusState,
      expandedText: data?.result || null,
    };
  },

  'worker:step-start': (detail) => {
    const data = parseDetail<{ description?: string; task?: string }>(detail);
    const task = data?.description || data?.task;
    return {
      text: task ? processVoice(task) : 'Working on this step...',
      icon: '▶️',
      state: 'active' as StatusState,
      stepId: extractStepId(detail),
    };
  },

  'worker:step-progress': (detail) => {
    const progress = extractProgress(detail);
    const data = parseDetail<{ message?: string }>(detail);
    return {
      text: data?.message ? processVoice(data.message) : 'Making progress...',
      icon: '⏳',
      state: 'active' as StatusState,
      progress,
      stepId: extractStepId(detail),
    };
  },

  'worker:step-complete': (detail) => {
    const data = parseDetail<{ summary?: string }>(detail);
    return {
      text: data?.summary ? truncate(data.summary, 6) : 'Step complete',
      icon: '✅',
      state: 'done' as StatusState,
      stepId: extractStepId(detail),
    };
  },

  'worker:error': (detail) => {
    const data = parseDetail<{ reason?: string }>(detail);
    return {
      text: simplifyReason(data?.reason || 'hit a snag'),
      icon: '⚠️',
      state: 'error' as StatusState,
    };
  },

  'worker:retry': (detail) => {
    const data = parseDetail<{ attempt?: number }>(detail);
    const attempt = data?.attempt || 2;
    return {
      text: `Trying again (attempt ${attempt})...`,
      icon: '🔄',
      state: 'active' as StatusState,
    };
  },
};

// =============================================================================
// BODYGUARD TRANSLATIONS
// =============================================================================

const bodyguardTranslations: TranslationMap = {
  'bodyguard:checking': (detail) => {
    const data = parseDetail<{ item?: string; file?: string }>(detail);
    const item = data?.item || (data?.file ? humanizeFileName(data.file) : 'changes');
    return {
      text: `Checking ${truncate(item, 4)}...`,
      icon: '🔍',
      state: 'active' as StatusState,
    };
  },

  'bodyguard:pass': () => ({
    text: 'Looks good!',
    icon: '✅',
    state: 'done' as StatusState,
  }),

  'bodyguard:fail-heuristic': (detail) => {
    const data = parseDetail<{ issue?: string }>(detail);
    return {
      text: data?.issue ? `Potential issue: ${truncate(data.issue, 4)}` : 'Found a potential issue',
      icon: '⚠️',
      state: 'active' as StatusState,
      expandable: true,
    };
  },

  'bodyguard:fail-definitive': (detail) => {
    const data = parseDetail<{ reason?: string }>(detail);
    return {
      text: data?.reason ? simplifyReason(data.reason) : 'Found a problem',
      icon: '🛑',
      state: 'error' as StatusState,
      expandable: true,
    };
  },

  'bodyguard:reviewing': () => ({
    text: 'Reviewing the changes...',
    icon: '👀',
    state: 'active' as StatusState,
  }),
};

// =============================================================================
// PA (PERSONAL ASSISTANT) TRANSLATIONS
// =============================================================================

const paTranslations: TranslationMap = {
  'pa:handoff': () => ({
    text: 'Taking over from here...',
    icon: '🤝',
    state: 'active' as StatusState,
  }),

  'pa:format-mismatch': (detail) => {
    const data = parseDetail<{ expected?: string; got?: string }>(detail);
    return {
      text: 'Formatting the output...',
      icon: '📝',
      state: 'active' as StatusState,
      expandable: true,
      expandedText: data?.expected ? `Adjusting to ${data.expected} format` : null,
    };
  },

  'pa:correction-routed': () => ({
    text: 'Making adjustments...',
    icon: '🔧',
    state: 'active' as StatusState,
  }),

  'pa:question': () => ({
    text: 'Need a quick answer from you',
    icon: '❓',
    state: 'waiting_user' as StatusState,
  }),

  'pa:waiting': () => ({
    text: 'Waiting for your input...',
    icon: '⏸️',
    state: 'waiting_user' as StatusState,
  }),

  'pa:response-received': () => ({
    text: 'Got it, continuing...',
    icon: '👍',
    state: 'active' as StatusState,
  }),
};

// =============================================================================
// RATE LIMIT TRANSLATIONS
// =============================================================================

const rateLimitTranslations: TranslationMap = {
  'rate-limit:hit': (detail) => {
    const data = parseDetail<{ retryAfter?: number }>(detail);
    const seconds = data?.retryAfter ? Math.ceil(data.retryAfter / 1000) : null;
    return {
      text: seconds ? `Pausing briefly (${seconds}s)...` : 'Pausing briefly...',
      icon: '⏳',
      state: 'paused' as StatusState,
    };
  },

  'rate-limit:resumed': () => ({
    text: 'Resuming work...',
    icon: '▶️',
    state: 'active' as StatusState,
  }),

  'rate-limit:warning': (detail) => {
    const data = parseDetail<{ remaining?: number }>(detail);
    return {
      text: data?.remaining ? `${data.remaining} calls remaining` : 'Running low on calls',
      icon: '⚡',
      state: 'active' as StatusState,
    };
  },
};

// =============================================================================
// CONTEXT WARDEN TRANSLATIONS
// =============================================================================

const contextWardenTranslations: TranslationMap = {
  'context-warden:kill': () => ({
    text: 'Saving memory, pausing helper...',
    icon: '💾',
    state: 'active' as StatusState,
  }),

  'context-warden:respawn': () => ({
    text: 'Bringing helper back...',
    icon: '🔄',
    state: 'active' as StatusState,
  }),

  'context-warden:compact': () => ({
    text: 'Tidying up memory...',
    icon: '🧹',
    state: 'active' as StatusState,
  }),

  'context-warden:checkpoint': () => ({
    text: 'Saving progress...',
    icon: '💾',
    state: 'active' as StatusState,
  }),
};

// =============================================================================
// ARCHIVIST TRANSLATIONS
// =============================================================================

const archivistTranslations: TranslationMap = {
  'archivist:archiving': (detail) => {
    const data = parseDetail<{ item?: string }>(detail);
    return {
      text: data?.item ? `Archiving ${truncate(data.item, 4)}...` : 'Archiving...',
      icon: '📦',
      state: 'active' as StatusState,
    };
  },

  'archivist:complete': () => ({
    text: 'Archived successfully',
    icon: '✅',
    state: 'done' as StatusState,
  }),

  'archivist:reopen': (detail) => {
    const data = parseDetail<{ item?: string }>(detail);
    return {
      text: data?.item ? `Reopening ${truncate(data.item, 4)}...` : 'Reopening...',
      icon: '📂',
      state: 'active' as StatusState,
    };
  },

  'archivist:indexing': () => ({
    text: 'Indexing for quick access...',
    icon: '📑',
    state: 'active' as StatusState,
  }),
};

// =============================================================================
// IMAGE GENERATION TRANSLATIONS
// =============================================================================

const imageGenTranslations: TranslationMap = {
  'image-gen:start': (detail) => {
    const data = parseDetail<{ style?: string }>(detail);
    return {
      text: data?.style ? `Creating ${data.style} image...` : 'Creating image...',
      icon: '🎨',
      state: 'active' as StatusState,
    };
  },

  'image-gen:complete': () => ({
    text: 'Image ready!',
    icon: '🖼️',
    state: 'done' as StatusState,
    expandable: true,
  }),

  'image-gen:progress': (detail) => {
    const progress = extractProgress(detail);
    return {
      text: 'Generating...',
      icon: '🎨',
      state: 'active' as StatusState,
      progress,
    };
  },

  'image-gen:error': (detail) => {
    const data = parseDetail<{ reason?: string }>(detail);
    return {
      text: simplifyReason(data?.reason || 'image creation failed'),
      icon: '❌',
      state: 'error' as StatusState,
    };
  },
};

// =============================================================================
// DEPLOY TRANSLATIONS
// =============================================================================

const deployTranslations: TranslationMap = {
  'deploy:start': (detail) => {
    const data = parseDetail<{ target?: string; platform?: string }>(detail);
    const target = data?.target || data?.platform || 'site';
    return {
      text: `Deploying ${truncate(target, 4)}...`,
      icon: '🚀',
      state: 'active' as StatusState,
    };
  },

  'deploy:live': (detail) => {
    const url = extractUrl(detail);
    return {
      text: 'Live and ready!',
      icon: '🌐',
      state: 'done' as StatusState,
      expandable: !!url,
      expandedText: url || null,
    };
  },

  'deploy:building': () => ({
    text: 'Building for production...',
    icon: '🔨',
    state: 'active' as StatusState,
  }),

  'deploy:uploading': (detail) => {
    const progress = extractProgress(detail);
    return {
      text: 'Uploading files...',
      icon: '📤',
      state: 'active' as StatusState,
      progress,
    };
  },

  'deploy:error': (detail) => {
    const data = parseDetail<{ reason?: string }>(detail);
    return {
      text: simplifyReason(data?.reason || 'deploy failed'),
      icon: '❌',
      state: 'error' as StatusState,
      expandable: true,
    };
  },
};

// =============================================================================
// RESEARCH TRANSLATIONS
// =============================================================================

const researchTranslations: TranslationMap = {
  'research:searching': (detail) => {
    const data = parseDetail<{ query?: string; topic?: string }>(detail);
    const topic = data?.query || data?.topic;
    return {
      text: topic ? `Searching for ${truncate(topic, 4)}...` : 'Searching...',
      icon: '🔎',
      state: 'active' as StatusState,
    };
  },

  'research:complete': (detail) => {
    const data = parseDetail<{ results?: number }>(detail);
    return {
      text: data?.results ? `Found ${data.results} results` : 'Search complete',
      icon: '📚',
      state: 'done' as StatusState,
      expandable: true,
    };
  },

  'research:reading': (detail) => {
    const data = parseDetail<{ source?: string }>(detail);
    return {
      text: data?.source ? `Reading ${truncate(data.source, 4)}...` : 'Reading sources...',
      icon: '📖',
      state: 'active' as StatusState,
    };
  },

  'research:summarizing': () => ({
    text: 'Summarizing findings...',
    icon: '📝',
    state: 'active' as StatusState,
  }),
};

// =============================================================================
// FILE SYSTEM TRANSLATIONS
// =============================================================================

const fileSystemTranslations: TranslationMap = {
  'file-system:reading': (detail) => {
    const name = extractFileName(detail);
    return {
      text: `Reading ${name}...`,
      icon: '📖',
      state: 'active' as StatusState,
    };
  },

  'file-system:writing': (detail) => {
    const name = extractFileName(detail);
    return {
      text: `Writing ${name}...`,
      icon: '✏️',
      state: 'active' as StatusState,
    };
  },

  'file-system:scanning': (detail) => {
    const data = parseDetail<{ directory?: string; folder?: string }>(detail);
    const folder = data?.directory || data?.folder;
    return {
      text: folder ? `Scanning ${truncate(folder, 4)}...` : 'Scanning files...',
      icon: '📂',
      state: 'active' as StatusState,
    };
  },

  'file-system:complete': () => ({
    text: 'File operation complete',
    icon: '✅',
    state: 'done' as StatusState,
  }),
};

// =============================================================================
// GIT TRANSLATIONS
// =============================================================================

const gitTranslations: TranslationMap = {
  'git:commit': (detail) => {
    const data = parseDetail<{ message?: string }>(detail);
    return {
      text: 'Saving your changes...',
      icon: '💾',
      state: 'active' as StatusState,
      expandable: !!data?.message,
      expandedText: data?.message || null,
    };
  },

  'git:push': () => ({
    text: 'Pushing to remote...',
    icon: '📤',
    state: 'active' as StatusState,
  }),

  'git:pull': () => ({
    text: 'Getting latest changes...',
    icon: '📥',
    state: 'active' as StatusState,
  }),

  'git:complete': () => ({
    text: 'Git operation complete',
    icon: '✅',
    state: 'done' as StatusState,
  }),
};

// =============================================================================
// TERMINAL TRANSLATIONS
// =============================================================================

const terminalTranslations: TranslationMap = {
  'terminal:running': (detail) => {
    const data = parseDetail<{ command?: string }>(detail);
    // Don't expose actual commands
    return {
      text: 'Running a command...',
      icon: '💻',
      state: 'active' as StatusState,
    };
  },

  'terminal:complete': (detail) => {
    const data = parseDetail<{ exitCode?: number }>(detail);
    const success = data?.exitCode === 0;
    return {
      text: success ? 'Command finished' : 'Command finished with issues',
      icon: success ? '✅' : '⚠️',
      state: success ? 'done' as StatusState : 'error' as StatusState,
    };
  },

  'terminal:output': () => ({
    text: 'Processing output...',
    icon: '📄',
    state: 'active' as StatusState,
  }),
};

// =============================================================================
// COMBINED TRANSLATIONS MAP
// =============================================================================

/**
 * All translations combined into a single map.
 * Key format: "source:type"
 */
export const TRANSLATIONS: TranslationMap = {
  ...conductorTranslations,
  ...workerTranslations,
  ...bodyguardTranslations,
  ...paTranslations,
  ...rateLimitTranslations,
  ...contextWardenTranslations,
  ...archivistTranslations,
  ...imageGenTranslations,
  ...deployTranslations,
  ...researchTranslations,
  ...fileSystemTranslations,
  ...gitTranslations,
  ...terminalTranslations,
};

// =============================================================================
// DEFAULT/FALLBACK TRANSLATION
// =============================================================================

/**
 * Fallback translation for unknown events
 */
function defaultTranslation(event: StatusEvent): TranslationResult {
  // Try to make something reasonable from the event
  const type = event.type.replace(/[-_]/g, ' ');
  const text = processVoice(type);

  return {
    text: text || 'Working...',
    icon: '⚙️',
    state: 'active' as StatusState,
  };
}

// =============================================================================
// MAIN TRANSLATE FUNCTION
// =============================================================================

let idCounter = 0;

/**
 * Generates a unique ID for status lines
 */
function generateId(): string {
  return `status-${Date.now()}-${++idCounter}`;
}

/**
 * Translates a StatusEvent to a StatusLine.
 * Pure lookup-based, no LLM calls.
 */
export function translate(event: StatusEvent): StatusLine {
  const key = `${event.source}:${event.type}`;
  const translationFn = TRANSLATIONS[key];

  // Get translation result (partial StatusLine)
  const partial = translationFn
    ? translationFn(event.detail)
    : defaultTranslation(event);

  // Build complete StatusLine with defaults
  const statusLine: StatusLine = {
    id: generateId(),
    text: partial.text,
    expandable: partial.expandable ?? false,
    expandedText: partial.expandedText ?? null,
    state: partial.state ?? 'active',
    stepId: partial.stepId ?? extractStepId(event.detail),
    parentId: partial.parentId ?? null,
    progress: partial.progress ?? null,
    icon: partial.icon,
  };

  return statusLine;
}

// =============================================================================
// BATCH TRANSLATION
// =============================================================================

/**
 * Translates multiple events at once
 */
export function translateBatch(events: StatusEvent[]): StatusLine[] {
  return events.map(translate);
}

// =============================================================================
// EXPORTS FOR TESTING
// =============================================================================

export {
  parseDetail,
  extractFileName,
  extractStepId,
  extractProgress,
  extractUrl,
  defaultTranslation,
  generateId,
};

// Re-export helper functions from voice
export { humanizeFileName, humanizeTask, simplifyReason } from './voice';
