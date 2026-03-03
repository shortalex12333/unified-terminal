/**
 * GSD Integration - Deep integration with GSD workflow
 *
 * Gate 10: GSD + Plugin Orchestration
 *
 * Provides GSD-specific functionality including:
 * - Phase parsing from CLI output
 * - Phase state management
 * - Progress tracking
 * - GSD command orchestration
 */

import { EventEmitter } from 'events';
import { getPluginExecutor, PluginExecutor } from './plugin-executor';
import { PluginOutputEvent, PluginStatusEvent } from './plugin-schema';
import { ProjectBrief } from '../intake/types';

// ============================================================================
// GSD PHASE TYPES
// ============================================================================

/**
 * Status of a GSD phase.
 */
export type GSDPhaseStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

/**
 * Represents a single GSD phase.
 */
export interface GSDPhase {
  /** Phase number (e.g., 1, 2, 3, or 1.1 for inserted phases) */
  number: number | string;

  /** Phase name/description */
  name: string;

  /** Current status */
  status: GSDPhaseStatus;

  /** Progress percentage (0-100) */
  progress: number;

  /** Optional plan file path */
  planPath?: string;

  /** Phase start time */
  startedAt?: Date;

  /** Phase end time */
  endedAt?: Date;
}

/**
 * GSD project state.
 */
export interface GSDProjectState {
  /** Project path */
  projectPath: string;

  /** Current milestone number */
  currentMilestone: number;

  /** All phases in current milestone */
  phases: GSDPhase[];

  /** Currently active phase */
  activePhase: GSDPhase | null;

  /** Overall project progress (0-100) */
  overallProgress: number;

  /** Last updated timestamp */
  lastUpdated: Date;
}

/**
 * Event emitted when GSD phase changes.
 */
export interface GSDPhaseEvent {
  /** Project path */
  projectPath: string;

  /** Phase that changed */
  phase: GSDPhase;

  /** Previous status (if status changed) */
  previousStatus?: GSDPhaseStatus;

  /** Timestamp */
  timestamp: Date;
}

// ============================================================================
// OUTPUT PARSING PATTERNS
// ============================================================================

/**
 * Regex patterns for parsing GSD CLI output.
 */
const GSD_PATTERNS = {
  /** Phase progress: "Phase 3: Building authentication (45%)" */
  PHASE_PROGRESS: /Phase\s+(\d+(?:\.\d+)?)[:\s]+([^(]+)\s*\((\d+)%\)/i,

  /** Phase start: "Starting Phase 3: Authentication" */
  PHASE_START: /(?:Starting|Beginning|Executing)\s+Phase\s+(\d+(?:\.\d+)?)[:\s]+(.+)/i,

  /** Phase complete: "Phase 3 completed" or "Completed Phase 3" */
  PHASE_COMPLETE: /(?:Phase\s+(\d+(?:\.\d+)?)\s+completed|Completed\s+Phase\s+(\d+(?:\.\d+)?))/i,

  /** Phase failed: "Phase 3 failed" */
  PHASE_FAILED: /Phase\s+(\d+(?:\.\d+)?)\s+failed/i,

  /** Milestone info: "Milestone 1:" or "M1:" */
  MILESTONE: /(?:Milestone|M)\s*(\d+)/i,

  /** Overall progress: "Overall progress: 67%" */
  OVERALL_PROGRESS: /(?:Overall|Total)\s+progress[:\s]+(\d+)%/i,

  /** Phase list item: "1. Set up project structure [completed]" */
  PHASE_LIST_ITEM: /^\s*(\d+(?:\.\d+)?)\.\s+(.+?)\s*\[(pending|in_progress|completed|failed|skipped)\]/i,

  /** Current phase indicator: ">>> Phase 3: Building API" */
  CURRENT_PHASE: />>>\s*Phase\s+(\d+(?:\.\d+)?)[:\s]+(.+)/i,

  /** GSD status line: "GSD: Planning phase 2..." */
  GSD_STATUS: /GSD[:\s]+(.+)/i,
};

// ============================================================================
// GSD INTEGRATION CLASS
// ============================================================================

/**
 * GSD Integration - Manages GSD workflow state and provides
 * high-level methods for GSD operations.
 *
 * Events:
 * - 'phase-update': (GSDPhaseEvent) - Phase status changed
 * - 'progress': (projectPath, progress) - Overall progress changed
 * - 'error': (Error) - GSD error
 */
export class GSDIntegration extends EventEmitter {
  /** Map of project paths to their GSD state */
  private projectStates: Map<string, GSDProjectState> = new Map();

  /** Map of execution IDs to project paths */
  private executionToProject: Map<string, string> = new Map();

  /** Reference to plugin executor */
  private executor: PluginExecutor;

  constructor() {
    super();
    this.executor = getPluginExecutor();
    this.setupExecutorListeners();
  }

  // ==========================================================================
  // EXECUTOR EVENT HANDLING
  // ==========================================================================

  /**
   * Set up listeners for plugin executor events.
   */
  private setupExecutorListeners(): void {
    this.executor.on('output', (event: PluginOutputEvent) => {
      if (event.pluginName === 'gsd') {
        this.parseGSDOutput(event);
      }
    });

    this.executor.on('status', (event: PluginStatusEvent) => {
      if (event.pluginName === 'gsd') {
        this.handleGSDStatusChange(event);
      }
    });
  }

  /**
   * Parse GSD output and update state.
   */
  private parseGSDOutput(event: PluginOutputEvent): void {
    const projectPath = this.executionToProject.get(event.executionId);
    if (!projectPath) return;

    const state = this.projectStates.get(projectPath);
    if (!state) return;

    const output = event.data;
    const lines = output.split('\n');

    for (const line of lines) {
      // Check for phase progress
      const progressMatch = line.match(GSD_PATTERNS.PHASE_PROGRESS);
      if (progressMatch) {
        const phaseNum = parseFloat(progressMatch[1]);
        const phaseName = progressMatch[2].trim();
        const progress = parseInt(progressMatch[3], 10);

        this.updatePhase(projectPath, phaseNum, {
          name: phaseName,
          status: 'in_progress',
          progress,
        });
        continue;
      }

      // Check for phase start
      const startMatch = line.match(GSD_PATTERNS.PHASE_START);
      if (startMatch) {
        const phaseNum = parseFloat(startMatch[1]);
        const phaseName = startMatch[2].trim();

        this.updatePhase(projectPath, phaseNum, {
          name: phaseName,
          status: 'in_progress',
          progress: 0,
          startedAt: new Date(),
        });
        continue;
      }

      // Check for phase complete
      const completeMatch = line.match(GSD_PATTERNS.PHASE_COMPLETE);
      if (completeMatch) {
        const phaseNum = parseFloat(completeMatch[1] || completeMatch[2]);

        this.updatePhase(projectPath, phaseNum, {
          status: 'completed',
          progress: 100,
          endedAt: new Date(),
        });
        continue;
      }

      // Check for phase failed
      const failedMatch = line.match(GSD_PATTERNS.PHASE_FAILED);
      if (failedMatch) {
        const phaseNum = parseFloat(failedMatch[1]);

        this.updatePhase(projectPath, phaseNum, {
          status: 'failed',
          endedAt: new Date(),
        });
        continue;
      }

      // Check for overall progress
      const overallMatch = line.match(GSD_PATTERNS.OVERALL_PROGRESS);
      if (overallMatch) {
        const progress = parseInt(overallMatch[1], 10);
        state.overallProgress = progress;
        state.lastUpdated = new Date();
        this.emit('progress', projectPath, progress);
        continue;
      }

      // Check for phase list items (from gsd:progress output)
      const listMatch = line.match(GSD_PATTERNS.PHASE_LIST_ITEM);
      if (listMatch) {
        const phaseNum = parseFloat(listMatch[1]);
        const phaseName = listMatch[2].trim();
        const status = listMatch[3] as GSDPhaseStatus;

        this.updatePhase(projectPath, phaseNum, {
          name: phaseName,
          status,
          progress: status === 'completed' ? 100 : status === 'in_progress' ? 50 : 0,
        });
      }
    }
  }

  /**
   * Handle GSD execution status changes.
   */
  private handleGSDStatusChange(event: PluginStatusEvent): void {
    const projectPath = this.executionToProject.get(event.executionId);
    if (!projectPath) return;

    const state = this.projectStates.get(projectPath);
    if (!state) return;

    // If GSD execution failed, mark active phase as failed
    if (event.status === 'failed' && state.activePhase) {
      this.updatePhase(projectPath, state.activePhase.number, {
        status: 'failed',
        endedAt: new Date(),
      });
    }

    // If GSD execution completed, mark active phase as completed
    if (event.status === 'completed' && state.activePhase) {
      this.updatePhase(projectPath, state.activePhase.number, {
        status: 'completed',
        progress: 100,
        endedAt: new Date(),
      });
    }
  }

  // ==========================================================================
  // PROJECT INITIALIZATION
  // ==========================================================================

  /**
   * Initialize a GSD project from a project brief.
   *
   * @param projectPath - Path to the project
   * @param brief - Project brief from intake
   * @returns Execution ID for the initialization
   */
  async initProject(projectPath: string, brief: ProjectBrief): Promise<string> {
    console.log(`[GSDIntegration] Initializing project at ${projectPath}`);

    // Initialize state
    const state: GSDProjectState = {
      projectPath,
      currentMilestone: 1,
      phases: [],
      activePhase: null,
      overallProgress: 0,
      lastUpdated: new Date(),
    };

    this.projectStates.set(projectPath, state);

    // Build GSD init arguments
    const args = ['--brief', JSON.stringify(brief)];

    // Execute GSD new-project command
    const executionId = this.executor.executeCommand('gsd', 'gsd:new-project', projectPath, args);

    this.executionToProject.set(executionId, projectPath);

    return executionId;
  }

  // ==========================================================================
  // PHASE MANAGEMENT
  // ==========================================================================

  /**
   * Get all phases for a project.
   * @param projectPath - Project path
   * @returns Array of phases
   */
  getPhases(projectPath: string): GSDPhase[] {
    const state = this.projectStates.get(projectPath);
    return state ? [...state.phases] : [];
  }

  /**
   * Get the current active phase.
   * @param projectPath - Project path
   * @returns Current phase or null
   */
  getCurrentPhase(projectPath: string): GSDPhase | null {
    const state = this.projectStates.get(projectPath);
    return state?.activePhase ?? null;
  }

  /**
   * Execute a specific phase.
   *
   * @param projectPath - Project path
   * @param phaseNumber - Phase number to execute
   * @returns Execution ID
   */
  async executePhase(projectPath: string, phaseNumber: number | string): Promise<string> {
    const state = this.projectStates.get(projectPath);
    if (!state) {
      throw new Error(`No GSD state for project: ${projectPath}`);
    }

    console.log(`[GSDIntegration] Executing phase ${phaseNumber} at ${projectPath}`);

    // Update active phase
    const phase = state.phases.find((p) => p.number === phaseNumber);
    if (phase) {
      state.activePhase = phase;
      this.updatePhase(projectPath, phaseNumber, {
        status: 'in_progress',
        progress: 0,
        startedAt: new Date(),
      });
    }

    // Execute the phase
    const executionId = this.executor.executeCommand(
      'gsd',
      'gsd:execute-phase',
      projectPath,
      [String(phaseNumber)]
    );

    this.executionToProject.set(executionId, projectPath);

    return executionId;
  }

  /**
   * Get progress status (run gsd:progress).
   *
   * @param projectPath - Project path
   * @returns Execution ID
   */
  async refreshProgress(projectPath: string): Promise<string> {
    const executionId = this.executor.executeCommand('gsd', 'gsd:progress', projectPath, []);
    this.executionToProject.set(executionId, projectPath);
    return executionId;
  }

  // ==========================================================================
  // STATE QUERIES
  // ==========================================================================

  /**
   * Get the full project state.
   * @param projectPath - Project path
   * @returns Project state or null
   */
  getProjectState(projectPath: string): GSDProjectState | null {
    const state = this.projectStates.get(projectPath);
    return state ? { ...state, phases: [...state.phases] } : null;
  }

  /**
   * Check if a project is being tracked.
   * @param projectPath - Project path
   * @returns True if project has GSD state
   */
  hasProject(projectPath: string): boolean {
    return this.projectStates.has(projectPath);
  }

  /**
   * Get all tracked projects.
   * @returns Array of project paths
   */
  getTrackedProjects(): string[] {
    return Array.from(this.projectStates.keys());
  }

  // ==========================================================================
  // OUTPUT PARSING (PUBLIC)
  // ==========================================================================

  /**
   * Parse GSD output to extract phases (public utility).
   * Useful for parsing output from external sources.
   *
   * @param output - Raw GSD CLI output
   * @returns Array of parsed phases
   */
  parseGSDOutputToPhases(output: string): GSDPhase[] {
    const phases: GSDPhase[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      const listMatch = line.match(GSD_PATTERNS.PHASE_LIST_ITEM);
      if (listMatch) {
        const phaseNum = parseFloat(listMatch[1]);
        const phaseName = listMatch[2].trim();
        const status = listMatch[3] as GSDPhaseStatus;

        phases.push({
          number: phaseNum,
          name: phaseName,
          status,
          progress: status === 'completed' ? 100 : status === 'in_progress' ? 50 : 0,
        });
      }
    }

    return phases;
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  /**
   * Update a phase in the project state.
   */
  private updatePhase(
    projectPath: string,
    phaseNumber: number | string,
    updates: Partial<GSDPhase>
  ): void {
    const state = this.projectStates.get(projectPath);
    if (!state) return;

    // Find or create phase
    let phase = state.phases.find((p) => p.number === phaseNumber);
    const previousStatus = phase?.status;

    if (!phase) {
      phase = {
        number: phaseNumber,
        name: updates.name || `Phase ${phaseNumber}`,
        status: 'pending',
        progress: 0,
      };
      state.phases.push(phase);
      state.phases.sort((a, b) => {
        const numA = typeof a.number === 'string' ? parseFloat(a.number) : a.number;
        const numB = typeof b.number === 'string' ? parseFloat(b.number) : b.number;
        return numA - numB;
      });
    }

    // Apply updates
    Object.assign(phase, updates);

    // Update active phase if this one is in progress
    if (phase.status === 'in_progress') {
      state.activePhase = phase;
    } else if (state.activePhase?.number === phaseNumber) {
      state.activePhase = null;
    }

    state.lastUpdated = new Date();

    // Calculate overall progress
    if (state.phases.length > 0) {
      const totalProgress = state.phases.reduce((sum, p) => sum + p.progress, 0);
      state.overallProgress = Math.round(totalProgress / state.phases.length);
    }

    // Emit phase update event
    if (previousStatus !== phase.status || updates.progress !== undefined) {
      const event: GSDPhaseEvent = {
        projectPath,
        phase: { ...phase },
        previousStatus,
        timestamp: new Date(),
      };
      this.emit('phase-update', event);
    }
  }

  /**
   * Clear state for a project.
   */
  clearProject(projectPath: string): void {
    this.projectStates.delete(projectPath);

    // Clean up execution mappings
    for (const [execId, path] of this.executionToProject) {
      if (path === projectPath) {
        this.executionToProject.delete(execId);
      }
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/** Singleton GSD integration instance */
let gsdInstance: GSDIntegration | null = null;

/**
 * Get the singleton GSD integration instance.
 */
export function getGSDIntegration(): GSDIntegration {
  if (!gsdInstance) {
    gsdInstance = new GSDIntegration();
  }
  return gsdInstance;
}

/**
 * Reset GSD integration (for testing).
 */
export function resetGSDIntegration(): void {
  if (gsdInstance) {
    gsdInstance.removeAllListeners();
  }
  gsdInstance = null;
}
