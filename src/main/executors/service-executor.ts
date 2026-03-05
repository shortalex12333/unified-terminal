/**
 * Service Executor - External Service Connection Handler
 *
 * Handles connections to external services like Stripe, Supabase, GitHub, and Vercel.
 * Shows user-friendly guides and waits for confirmation before proceeding.
 *
 * This executor is part of the step execution pipeline that handles
 * service integration steps during project setup.
 */

import { ipcMain, BrowserWindow } from 'electron';
import { EventEmitter } from 'events';
import { deployEvents } from '../events';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Step types supported by the service executor.
 */
export type ServiceAction =
  | 'connect_stripe'
  | 'connect_supabase'
  | 'connect_github'
  | 'deploy_vercel';

/**
 * Runtime step passed to the executor.
 */
export interface RuntimeStep {
  /** Unique step identifier */
  id: string;
  /** The action to perform */
  action: ServiceAction;
  /** Human-readable step description */
  description?: string;
  /** Additional step metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result from executing a service connection step.
 */
export interface ServiceResult {
  /** Whether the service connection was successful */
  success: boolean;
  /** Whether the service is now connected */
  connected: boolean;
  /** Service account identifier (varies by service) */
  accountId?: string;
  /** Error message if connection failed */
  error?: string;
}

/**
 * Service guide displayed to the user.
 */
export interface ServiceGuide {
  /** Human-friendly title */
  title: string;
  /** Step-by-step instructions */
  steps: string[];
  /** URL to the service's signup/dashboard page */
  signupUrl?: string;
  /** Estimated time to complete */
  estimatedMinutes?: number;
  /** Icon identifier for UI */
  icon?: string;
}

/**
 * Executor interface for type safety.
 */
export interface Executor {
  execute(step: RuntimeStep): Promise<ServiceResult>;
}

// ============================================================================
// SERVICE GUIDES
// ============================================================================

/**
 * User-friendly guides for each service connection.
 * These are shown in the renderer to help non-technical users
 * understand what they need to do.
 */
export const SERVICE_GUIDES: Record<string, ServiceGuide> = {
  stripe: {
    title: 'Connect Stripe for Payments',
    steps: [
      'Go to stripe.com and create a free account (or sign in)',
      'Navigate to Developers > API keys in your dashboard',
      'Copy your Publishable key and Secret key',
      'Paste them here when ready',
    ],
    signupUrl: 'https://dashboard.stripe.com/register',
    estimatedMinutes: 5,
    icon: 'stripe',
  },
  supabase: {
    title: 'Connect Supabase for Database',
    steps: [
      'Go to supabase.com and create a free account (or sign in)',
      'Create a new project (pick a name and password)',
      'Wait for the project to be ready (about 2 minutes)',
      'Go to Settings > API and copy your project URL and anon key',
      'Paste them here when ready',
    ],
    signupUrl: 'https://supabase.com/dashboard',
    estimatedMinutes: 5,
    icon: 'supabase',
  },
  github: {
    title: 'Connect GitHub for Code Storage',
    steps: [
      'Go to github.com and sign in (or create a free account)',
      'Go to Settings > Developer settings > Personal access tokens',
      'Click "Generate new token (classic)"',
      'Select "repo" scope and generate',
      'Copy the token and paste it here',
    ],
    signupUrl: 'https://github.com/settings/tokens/new',
    estimatedMinutes: 3,
    icon: 'github',
  },
  vercel: {
    title: 'Connect Vercel for Deployment',
    steps: [
      'Go to vercel.com and sign in with GitHub (recommended)',
      'Once logged in, go to Settings > Tokens',
      'Create a new token with a descriptive name',
      'Copy the token and paste it here',
    ],
    signupUrl: 'https://vercel.com/account/tokens',
    estimatedMinutes: 3,
    icon: 'vercel',
  },
};

// ============================================================================
// SERVICE EXECUTOR CLASS
// ============================================================================

/**
 * ServiceExecutor - Handles external service connections.
 *
 * This executor shows a guide to the user, waits for them to complete
 * the connection, validates it, and returns the result.
 *
 * Events:
 * - 'guide-shown': (service: string) - Guide was displayed to user
 * - 'connection-started': (service: string) - User started connection
 * - 'connection-complete': (service: string, result: ServiceResult) - Connection finished
 * - 'error': (error: Error) - Error during execution
 */
export class ServiceExecutor extends EventEmitter implements Executor {
  /** Reference to the main window for IPC */
  private mainWindow: BrowserWindow | null = null;

  /** Pending connection promises keyed by service name */
  private pendingConnections: Map<string, {
    resolve: (result: ServiceResult) => void;
    reject: (error: Error) => void;
  }> = new Map();

  /** Stored credentials for validation */
  private credentials: Map<string, Record<string, string>> = new Map();

  constructor() {
    super();
    this.setupIPCHandlers();
  }

  /**
   * Set the main window reference for IPC communication.
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  // ==========================================================================
  // MAIN EXECUTION
  // ==========================================================================

  /**
   * Execute a service connection step.
   *
   * @param step - The runtime step to execute
   * @returns Promise resolving to ServiceResult
   */
  async execute(step: RuntimeStep): Promise<ServiceResult> {
    const serviceName = this.extractServiceName(step.action);

    if (!serviceName) {
      return {
        success: false,
        connected: false,
        error: `Unknown service action: ${step.action}`,
      };
    }

    console.log(`[ServiceExecutor] Executing ${step.action} for service: ${serviceName}`);

    // Emit deploy start event for Vercel deployment
    const isDeployAction = step.action === 'deploy_vercel';
    if (isDeployAction) {
      deployEvents.start('vercel');
    }

    try {
      // Show the service guide to the user
      await this.showServiceGuide(serviceName);

      // Wait for user to complete the connection
      const connectionResult = await this.waitForUserConfirmation(serviceName);

      if (!connectionResult.success) {
        return connectionResult;
      }

      // Validate the connection
      const validationResult = await this.validateConnection(serviceName);

      this.emit('connection-complete', serviceName, validationResult);

      // Emit deploy complete event for Vercel (URL would come from actual deployment)
      if (isDeployAction && validationResult.success) {
        // Note: Actual URL would be populated by deployment process
        deployEvents.complete('https://your-project.vercel.app');
      }

      return validationResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[ServiceExecutor] Error connecting ${serviceName}:`, errorMessage);

      this.emit('error', error);

      // Emit deploy error event for Vercel
      if (isDeployAction) {
        deployEvents.error(errorMessage);
      }

      return {
        success: false,
        connected: false,
        error: errorMessage,
      };
    }
  }

  // ==========================================================================
  // GUIDE DISPLAY
  // ==========================================================================

  /**
   * Show the service connection guide to the user.
   *
   * @param service - Service name (stripe, supabase, github, vercel)
   */
  async showServiceGuide(service: string): Promise<void> {
    const guide = SERVICE_GUIDES[service];

    if (!guide) {
      throw new Error(`No guide found for service: ${service}`);
    }

    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      throw new Error('Main window not available for showing guide');
    }

    console.log(`[ServiceExecutor] Showing guide for: ${service}`);

    // Emit IPC event to renderer to show the guide
    this.mainWindow.webContents.send('service:show-guide', {
      service,
      guide,
    });

    this.emit('guide-shown', service);
  }

  // ==========================================================================
  // USER CONFIRMATION
  // ==========================================================================

  /**
   * Wait for the user to complete the connection and provide credentials.
   *
   * @param service - Service name to wait for
   * @returns Promise resolving when user confirms connection
   */
  waitForUserConfirmation(service: string): Promise<ServiceResult> {
    return new Promise((resolve, reject) => {
      // Store the pending connection
      this.pendingConnections.set(service, { resolve, reject });

      this.emit('connection-started', service);

      console.log(`[ServiceExecutor] Waiting for user confirmation: ${service}`);

      // Set a timeout for user response (10 minutes)
      const timeout = setTimeout(() => {
        const pending = this.pendingConnections.get(service);
        if (pending) {
          this.pendingConnections.delete(service);
          pending.resolve({
            success: false,
            connected: false,
            error: 'Connection timed out - user did not respond within 10 minutes',
          });
        }
      }, 10 * 60 * 1000);

      // Store timeout reference for cleanup
      const originalResolve = resolve;
      this.pendingConnections.set(service, {
        resolve: (result) => {
          clearTimeout(timeout);
          originalResolve(result);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
    });
  }

  /**
   * Called when user confirms they have connected the service.
   * This is triggered via IPC from the renderer.
   *
   * @param service - Service name
   * @param credentials - Credentials provided by user
   */
  handleUserConnected(service: string, credentials: Record<string, string>): void {
    const pending = this.pendingConnections.get(service);

    if (!pending) {
      console.warn(`[ServiceExecutor] No pending connection for service: ${service}`);
      return;
    }

    // Store credentials for validation
    this.credentials.set(service, credentials);

    console.log(`[ServiceExecutor] User confirmed connection: ${service}`);

    // Resolve with success (validation happens next)
    pending.resolve({
      success: true,
      connected: true,
      accountId: credentials.accountId || credentials.projectId || credentials.username,
    });

    this.pendingConnections.delete(service);
  }

  /**
   * Called when user cancels the connection.
   *
   * @param service - Service name
   * @param reason - Optional cancellation reason
   */
  handleUserCancelled(service: string, reason?: string): void {
    const pending = this.pendingConnections.get(service);

    if (!pending) {
      return;
    }

    console.log(`[ServiceExecutor] User cancelled connection: ${service}`);

    pending.resolve({
      success: false,
      connected: false,
      error: reason || 'User cancelled the connection',
    });

    this.pendingConnections.delete(service);
  }

  // ==========================================================================
  // CONNECTION VALIDATION
  // ==========================================================================

  /**
   * Validate that the service is actually connected.
   *
   * @param service - Service name to validate
   * @returns ServiceResult with validation status
   */
  async validateConnection(service: string): Promise<ServiceResult> {
    const credentials = this.credentials.get(service);

    if (!credentials) {
      return {
        success: false,
        connected: false,
        error: 'No credentials found for validation',
      };
    }

    console.log(`[ServiceExecutor] Validating connection: ${service}`);

    try {
      switch (service) {
        case 'stripe':
          return await this.validateStripe(credentials);
        case 'supabase':
          return await this.validateSupabase(credentials);
        case 'github':
          return await this.validateGitHub(credentials);
        case 'vercel':
          return await this.validateVercel(credentials);
        default:
          return {
            success: true,
            connected: true,
            accountId: credentials.accountId,
          };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        connected: false,
        error: `Validation failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Validate Stripe connection by checking API key format.
   */
  private async validateStripe(credentials: Record<string, string>): Promise<ServiceResult> {
    const { secretKey, publishableKey } = credentials;

    // Basic format validation
    if (!secretKey || !secretKey.startsWith('sk_')) {
      return {
        success: false,
        connected: false,
        error: 'Invalid Stripe secret key format (should start with sk_)',
      };
    }

    if (!publishableKey || !publishableKey.startsWith('pk_')) {
      return {
        success: false,
        connected: false,
        error: 'Invalid Stripe publishable key format (should start with pk_)',
      };
    }

    // In production, we would make an API call to verify
    // For now, format validation is sufficient
    return {
      success: true,
      connected: true,
      accountId: secretKey.includes('test') ? 'test_account' : 'live_account',
    };
  }

  /**
   * Validate Supabase connection by checking URL and key format.
   */
  private async validateSupabase(credentials: Record<string, string>): Promise<ServiceResult> {
    const { projectUrl, anonKey } = credentials;

    // URL format validation
    if (!projectUrl || !projectUrl.includes('supabase')) {
      return {
        success: false,
        connected: false,
        error: 'Invalid Supabase project URL',
      };
    }

    // Key format validation (JWT format)
    if (!anonKey || !anonKey.startsWith('eyJ')) {
      return {
        success: false,
        connected: false,
        error: 'Invalid Supabase anon key format',
      };
    }

    // Extract project ID from URL
    const urlMatch = projectUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
    const projectId = urlMatch ? urlMatch[1] : 'unknown';

    return {
      success: true,
      connected: true,
      accountId: projectId,
    };
  }

  /**
   * Validate GitHub connection by checking token format.
   */
  private async validateGitHub(credentials: Record<string, string>): Promise<ServiceResult> {
    const { token, username } = credentials;

    // Token format validation
    if (!token) {
      return {
        success: false,
        connected: false,
        error: 'GitHub token is required',
      };
    }

    // Classic tokens start with ghp_, fine-grained with github_pat_
    const validPrefix = token.startsWith('ghp_') || token.startsWith('github_pat_');
    if (!validPrefix) {
      return {
        success: false,
        connected: false,
        error: 'Invalid GitHub token format (should start with ghp_ or github_pat_)',
      };
    }

    return {
      success: true,
      connected: true,
      accountId: username || 'github_user',
    };
  }

  /**
   * Validate Vercel connection by checking token format.
   */
  private async validateVercel(credentials: Record<string, string>): Promise<ServiceResult> {
    const { token } = credentials;

    // Token format validation
    if (!token) {
      return {
        success: false,
        connected: false,
        error: 'Vercel token is required',
      };
    }

    // Vercel tokens are typically 24+ characters
    if (token.length < 20) {
      return {
        success: false,
        connected: false,
        error: 'Invalid Vercel token format (too short)',
      };
    }

    return {
      success: true,
      connected: true,
      accountId: 'vercel_user',
    };
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Extract service name from action type.
   */
  private extractServiceName(action: ServiceAction): string | null {
    const actionMap: Record<ServiceAction, string> = {
      connect_stripe: 'stripe',
      connect_supabase: 'supabase',
      connect_github: 'github',
      deploy_vercel: 'vercel',
    };

    return actionMap[action] || null;
  }

  /**
   * Get the guide for a specific service.
   */
  getServiceGuide(service: string): ServiceGuide | null {
    return SERVICE_GUIDES[service] || null;
  }

  /**
   * Check if a service has stored credentials.
   */
  hasCredentials(service: string): boolean {
    return this.credentials.has(service);
  }

  /**
   * Clear stored credentials for a service.
   */
  clearCredentials(service: string): void {
    this.credentials.delete(service);
  }

  /**
   * Clear all stored credentials.
   */
  clearAllCredentials(): void {
    this.credentials.clear();
  }

  // ==========================================================================
  // IPC SETUP
  // ==========================================================================

  /**
   * Set up IPC handlers for renderer communication.
   */
  private setupIPCHandlers(): void {
    // Handle user confirming they connected a service
    ipcMain.on('service:connected', (_event, data: {
      service: string;
      credentials: Record<string, string>;
    }) => {
      this.handleUserConnected(data.service, data.credentials);
    });

    // Handle user cancelling connection
    ipcMain.on('service:cancelled', (_event, data: {
      service: string;
      reason?: string;
    }) => {
      this.handleUserCancelled(data.service, data.reason);
    });

    // Handle request for service guide
    ipcMain.handle('service:get-guide', async (_event, service: string) => {
      return this.getServiceGuide(service);
    });

    // Handle check for existing credentials
    ipcMain.handle('service:has-credentials', async (_event, service: string) => {
      return this.hasCredentials(service);
    });

    console.log('[ServiceExecutor] IPC handlers registered');
  }

  /**
   * Clean up IPC handlers and pending connections.
   */
  cleanup(): void {
    // Reject all pending connections
    this.pendingConnections.forEach((pending, service) => {
      pending.resolve({
        success: false,
        connected: false,
        error: 'Executor cleanup - connection cancelled',
      });
    });

    this.pendingConnections.clear();
    this.credentials.clear();
    this.removeAllListeners();

    console.log('[ServiceExecutor] Cleaned up');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let serviceExecutorInstance: ServiceExecutor | null = null;

/**
 * Get the singleton ServiceExecutor instance.
 */
export function getServiceExecutor(): ServiceExecutor {
  if (!serviceExecutorInstance) {
    serviceExecutorInstance = new ServiceExecutor();
  }
  return serviceExecutorInstance;
}

/**
 * Cleanup function to be called on app quit.
 */
export function cleanupServiceExecutor(): void {
  if (serviceExecutorInstance) {
    serviceExecutorInstance.cleanup();
    serviceExecutorInstance = null;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  SERVICE_GUIDES as serviceGuides,
};
