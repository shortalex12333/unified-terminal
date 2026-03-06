/**
 * Failure IPC Handlers - Graceful Failure UX
 *
 * IPC handlers for managing build failures, saved progress, and resume functionality.
 * This module is designed to be called from index.ts during app initialization.
 */

import { ipcMain, shell, BrowserWindow } from 'electron';
import {
  getProgressSaver,
  SavedProgress,
  SavedProgressSummary,
  DownloadOptions,
  DownloadResult,
  ResumeOptions,
  ResumeResult,
  FailureModalData,
  FAILURE_LABELS,
  FAILURE_DESCRIPTIONS,
} from './index';

// =============================================================================
// SETUP FUNCTION
// =============================================================================

/**
 * Set up failure IPC handlers and event forwarding.
 * Call this from index.ts during app initialization.
 */
export function setupFailureIPC(
  getMainWindow: () => BrowserWindow | null,
  getScheduler: () => { getStatus: () => { steps: any[] }; execute: (plan: any) => void },
  getConductor: () => { classify: (message: string, context?: Record<string, unknown>) => Promise<any> }
): void {
  const progressSaver = getProgressSaver();

  // Forward progress saved events to renderer
  progressSaver.on('progress-saved', (progress: SavedProgress) => {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('failure:progress-saved', progress);
    }
  });

  // Forward progress deleted events
  progressSaver.on('progress-deleted', (id: string) => {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('failure:progress-deleted', id);
    }
  });

  // ===========================================================================
  // IPC HANDLERS
  // ===========================================================================

  /**
   * Save current build progress
   */
  ipcMain.handle('failure:save-progress', async (
    _event,
    params: {
      planId: string;
      projectPath: string;
      projectName: string;
      failedStepId: number;
      error: string;
      statusCode?: number;
      originalMessage?: string;
      context?: Record<string, unknown>;
    }
  ): Promise<SavedProgress> => {
    console.log(`[IPC] failure:save-progress called for plan: ${params.planId}`);
    const scheduler = getScheduler();
    const status = scheduler.getStatus();
    const steps = status.steps;

    return progressSaver.save({
      planId: params.planId,
      projectPath: params.projectPath,
      projectName: params.projectName,
      steps,
      failedStepId: params.failedStepId,
      error: params.error,
      statusCode: params.statusCode,
      originalMessage: params.originalMessage,
      context: params.context,
    });
  });

  /**
   * List all saved progress
   */
  ipcMain.handle('failure:list-saved', async (): Promise<SavedProgressSummary[]> => {
    console.log('[IPC] failure:list-saved called');
    return progressSaver.list();
  });

  /**
   * Load a specific saved progress
   */
  ipcMain.handle('failure:load', async (
    _event,
    id: string
  ): Promise<SavedProgress | null> => {
    console.log(`[IPC] failure:load called: ${id}`);
    return progressSaver.load(id);
  });

  /**
   * Delete a saved progress
   */
  ipcMain.handle('failure:delete', async (
    _event,
    id: string
  ): Promise<boolean> => {
    console.log(`[IPC] failure:delete called: ${id}`);
    return progressSaver.delete(id);
  });

  /**
   * Check if saved progress can be resumed
   */
  ipcMain.handle('failure:can-resume', async (
    _event,
    id: string
  ): Promise<boolean> => {
    console.log(`[IPC] failure:can-resume called: ${id}`);
    return progressSaver.canResume(id);
  });

  /**
   * Resume from saved progress
   */
  ipcMain.handle('failure:resume', async (
    _event,
    id: string,
    options: ResumeOptions = {
      fromFailedStep: true,
      skipFailedStep: false,
      regeneratePlan: false,
      tryDifferentApproach: false,
    }
  ): Promise<ResumeResult> => {
    console.log(`[IPC] failure:resume called: ${id}`);
    const conductor = getConductor();
    const scheduler = getScheduler();

    try {
      const progress = await progressSaver.load(id);
      if (!progress) {
        return { success: false, error: 'Progress not found' };
      }

      if (!progress.canResume) {
        return { success: false, error: 'This progress cannot be resumed' };
      }

      let startFromStep = progress.failedStep;
      if (options.skipFailedStep) {
        const pendingAfterFailed = progress.steps
          .filter(s => s.status === 'pending' && s.id > progress.failedStep)
          .sort((a, b) => a.id - b.id);
        if (pendingAfterFailed.length > 0) {
          startFromStep = pendingAfterFailed[0].id;
        } else {
          return { success: false, error: 'No steps remaining after skipping failed step' };
        }
      }

      if (options.regeneratePlan || options.tryDifferentApproach) {
        if (!progress.originalMessage) {
          return { success: false, error: 'Original message not available for re-planning' };
        }

        const newPlan = await conductor.classify(progress.originalMessage, progress.context);
        const schedulerPlan = {
          planId: newPlan.planId || `plan-${Date.now()}`,
          name: `Resumed: ${progress.projectName}`,
          steps: newPlan.plan.map((step: any) => ({
            id: step.id,
            target: step.target as 'web' | 'cli' | 'service',
            action: step.action,
            detail: step.detail,
            waitFor: step.waitFor,
            parallel: step.parallel,
          })),
          context: { ...progress.context, projectDir: progress.projectPath },
        };

        scheduler.execute(schedulerPlan);
        await progressSaver.delete(id);

        return { success: true, newPlanId: schedulerPlan.planId, resumedFromStep: 1 };
      } else {
        const schedulerPlan = {
          planId: progress.planId,
          name: `Resumed: ${progress.projectName}`,
          steps: progress.steps
            .filter(s => s.status === 'pending' || (s.status === 'failed' && s.id === progress.failedStep))
            .map(step => ({
              id: step.id,
              target: step.target,
              action: step.action,
              detail: step.detail,
              waitFor: [],
              parallel: false,
            })),
          context: { ...progress.context, projectDir: progress.projectPath },
        };

        scheduler.execute(schedulerPlan);
        await progressSaver.delete(id);

        return { success: true, resumedFromStep: startFromStep };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[IPC] failure:resume error:', error);
      return { success: false, error: errorMessage };
    }
  });

  /**
   * Download partial outputs as zip
   */
  ipcMain.handle('failure:download-partial', async (
    _event,
    id: string,
    options: DownloadOptions = { completeOnly: false, includeSources: true, format: 'zip' }
  ): Promise<DownloadResult> => {
    console.log(`[IPC] failure:download-partial called: ${id}`);
    return progressSaver.downloadPartialOutputs(id, options);
  });

  /**
   * Open downloads directory in Finder
   */
  ipcMain.handle('failure:open-downloads', async (): Promise<{ success: boolean }> => {
    console.log('[IPC] failure:open-downloads called');
    const downloadsDir = progressSaver.getDownloadsDir();

    try {
      await shell.openPath(downloadsDir);
      return { success: true };
    } catch (error) {
      console.error('[IPC] failure:open-downloads error:', error);
      return { success: false };
    }
  });

  /**
   * Get failure modal data for a specific saved progress
   */
  ipcMain.handle('failure:get-modal-data', async (
    _event,
    id: string
  ): Promise<FailureModalData | null> => {
    console.log(`[IPC] failure:get-modal-data called: ${id}`);
    const progress = await progressSaver.load(id);

    if (!progress) {
      return null;
    }

    const completed = progress.completedSteps.length;
    const failed = 1;
    const skipped = progress.skippedSteps.length;
    const pending = progress.totalSteps - completed - failed - skipped;

    return {
      title: FAILURE_LABELS[progress.failureReason],
      description: FAILURE_DESCRIPTIONS[progress.failureReason],
      reason: progress.failureReason,
      progress: { completed, failed, pending, total: progress.totalSteps },
      partialOutputs: progress.partialOutputs,
      canResume: progress.canResume,
      canAutoResume: progress.canResume && ['api_unavailable', 'rate_limited', 'timeout', 'network_error'].includes(progress.failureReason),
      retryDelay: progress.canResume ? undefined : 0,
      progressId: progress.id,
    };
  });

  /**
   * Cleanup old saved progress
   */
  ipcMain.handle('failure:cleanup', async (_event, maxAgeMs?: number): Promise<number> => {
    console.log('[IPC] failure:cleanup called');
    return progressSaver.cleanup(maxAgeMs);
  });

  console.log('[App] Failure IPC handlers registered');
}
