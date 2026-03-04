/**
 * Unified Terminal - Electron Main Process
 * 
 * Creates main window with BrowserView for ChatGPT.
 * Handles OAuth popups, session persistence, and bot detection avoidance.
 */

import {
  app,
  BrowserWindow,
  BrowserView,
  session,
  shell,
  ipcMain,
  HandlerDetails,
  PermissionRequestHandlerHandlerDetails,
} from 'electron';
import * as os from 'os';
import {
  injectText,
  triggerSend,
  injectAndSend,
  isPageReady,
  waitForPageReady,
  getInputContent,
  clearInput,
  setupCaptureIPC,
  InjectionResult,
  SendResult,
} from './chatgpt-adapter';
import {
  scanSystem,
  isToolInstalled,
  getToolInfo,
  SystemProfile,
  ToolInfo,
} from './system-scanner';
import {
  installMissingTools,
  installTool,
  retryFailedInstalls,
  estimateInstallTime,
  InstallProgress,
  InstallResult,
} from './auto-installer';
import {
  getCLIRunner,
  cleanupCLIRunner,
  CLIRunner,
  ProcessInfo,
  ProcessOutput,
  ProcessStatusEvent,
  SpawnOptions,
} from './cli-runner';
import {
  translateOutput,
  translateCleanOutput,
  getProgressStatus,
  TranslationResult,
} from './output-translator';
import {
  setupCliAuthIPC,
  setMainWindow,
  isAuthenticated,
  checkAllAuthStatus,
  signOut,
  AuthStatus,
  CLITool,
} from './cli-auth';
import { backgroundCLI, Provider } from './background-cli';
import { setupCLIProviderIPC, setMainWindow as setProviderMainWindow } from './cli-provider-manager';
import {
  TaskRouter,
  getTaskRouter,
  routeTask,
  routeBrief,
  RoutingDecision,
} from './task-router';
import { ProjectBrief } from '../intake/types';
import {
  getFileWatcher,
  cleanupFileWatcher,
  FileWatcher,
  FileNode,
  FileChange,
} from './file-watcher';
import {
  getProjectManager,
  ProjectManager,
  Project,
  ProjectDescription,
  PROJECT_ROOT,
} from './project-manager';
import {
  initializePluginSystem,
  cleanupPluginSystem,
  getPluginRegistry,
  getPluginExecutor,
  getGSDIntegration,
  PluginConfig,
  PluginInstance,
  PluginStatusEvent,
  PluginOutputEvent,
  GSDPhase,
  GSDProjectState,
  GSDPhaseEvent,
} from '../plugins';
import {
  getUpdater,
  setupUpdaterIPC,
  checkForUpdatesAfterDelay,
  UpdateStatus,
} from './updater';
import {
  getStateManager,
  cleanupStateManager,
  setupStateIPC,
  StateManager,
  TaskState,
  TaskStatus,
  AppSettings,
  AppState,
  TaskUpdateEvent,
} from './state-manager';
import {
  getTrayManager,
  cleanupTrayManager,
  TrayManager,
} from './tray';
import {
  getErrorHandler,
  cleanupErrorHandler,
  handleError,
  getActiveErrors,
  dismissError,
  retryError,
  ErrorHandler,
} from './error-handler';
import {
  ErrorCategory,
  AppError,
  ErrorOccurredEvent,
  ErrorRecoveredEvent,
  RecoveryFailedEvent,
} from './error-types';
import * as path from 'path';

// Conductor System (Intelligent Routing)
import { fastPathCheck, FastPathResult } from './fast-path';
import {
  getConductor,
  cleanupConductor,
  ExecutionPlan,
  Step,
} from './conductor';
import {
  getStepScheduler,
  cleanupStepScheduler,
  RuntimeStep,
} from './step-scheduler';
import { getRateLimitRecovery, cleanupRateLimitRecovery } from './rate-limit-recovery';
import { installInterceptor, setupInterceptorIPC } from './send-interceptor';

// ============================================================================
// CONSTANTS
// ============================================================================

const WINDOW_WIDTH = 1400;
const WINDOW_HEIGHT = 900;

// Provider URLs - ALL providers use BrowserView with their official websites
type ProviderType = 'chatgpt' | 'gemini' | 'claude';
const PROVIDER_URLS: Record<ProviderType, string> = {
  chatgpt: 'https://chatgpt.com',
  gemini: 'https://gemini.google.com',
  claude: 'https://claude.ai',
};

// Session partitions - each provider gets isolated cookies/storage
const SESSION_PARTITIONS: Record<ProviderType, string> = {
  chatgpt: 'persist:chatgpt',
  gemini: 'persist:gemini',
  claude: 'persist:claude',
};

// Currently active provider
let activeProvider: ProviderType | null = null;

// OAuth domains that should open in popup windows
const OAUTH_DOMAINS = [
  'accounts.google.com',
  'login.microsoftonline.com',
  'appleid.apple.com',
  'auth0.com',
  'auth.openai.com',
  'login.live.com',
  'github.com/login',
  'api.twitter.com',
];

// User agent mimicking real Chrome on macOS to avoid bot detection
const CHROME_USER_AGENT = 
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// ============================================================================
// GLOBAL REFERENCES
// ============================================================================

let mainWindow: BrowserWindow | null = null;
let chatGPTView: BrowserView | null = null;

// Track OAuth popup windows so we can manage them
const oauthWindows: Set<BrowserWindow> = new Set();

// ============================================================================
// SINGLE INSTANCE LOCK
// ============================================================================

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is already running
  app.quit();
} else {
  // Focus the existing window if a second instance is launched
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });
}

// ============================================================================
// SESSION CONFIGURATION
// ============================================================================

/**
 * Configure the persistent session for a provider.
 * Each provider gets isolated cookies/storage across app restarts.
 */
function configureSession(provider: ProviderType = 'chatgpt'): Electron.Session {
  const partition = SESSION_PARTITIONS[provider];
  const providerSession = session.fromPartition(partition, { cache: true });

  // Set up permission handler for clipboard and notifications
  providerSession.setPermissionRequestHandler(
    (
      webContents,
      permission: string,
      callback: (permissionGranted: boolean) => void,
      details: PermissionRequestHandlerHandlerDetails
    ) => {
      const allowedPermissions = [
        'clipboard-read',
        'clipboard-write',
        'clipboard-sanitized-write',
        'notifications',
      ];

      if (allowedPermissions.includes(permission)) {
        callback(true);
      } else {
        // Log denied permissions for debugging
        console.log(`[Permission Denied] ${permission} from ${details.requestingUrl}`);
        callback(false);
      }
    }
  );

  // Set up permission check handler
  providerSession.setPermissionCheckHandler(
    (
      webContents,
      permission: string,
      requestingOrigin: string,
    ): boolean => {
      const allowedPermissions = [
        'clipboard-read',
        'clipboard-write',
        'clipboard-sanitized-write',
        'notifications',
        'media', // For potential future voice features
      ];

      return allowedPermissions.includes(permission);
    }
  );

  return providerSession;
}

// ============================================================================
// OAUTH POPUP HANDLING
// ============================================================================

/**
 * Check if a URL is from an OAuth provider.
 */
function isOAuthURL(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const fullPath = hostname + urlObj.pathname;

    return OAUTH_DOMAINS.some(domain =>
      hostname === domain ||
      hostname.endsWith('.' + domain) ||
      fullPath.startsWith(domain)
    );
  } catch {
    return false;
  }
}

/**
 * Check if a URL indicates user has logged out (login/auth pages).
 * When detected, we should return to ProfilePicker.
 */
function isLogoutURL(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    const hostname = urlObj.hostname.toLowerCase();

    // ChatGPT/OpenAI logout indicators
    if (hostname.includes('chatgpt.com') || hostname.includes('openai.com')) {
      if (
        pathname.includes('/auth') ||
        pathname.includes('/login') ||
        pathname.includes('/logout') ||
        pathname === '/' && urlObj.search.includes('logout')
      ) {
        return true;
      }
    }

    // Auth provider pages (user was redirected to login)
    if (hostname.includes('auth0.com') || hostname === 'auth.openai.com') {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Create an OAuth popup window that shares the same session.
 */
function createOAuthPopup(url: string, parentWindow: BrowserWindow): BrowserWindow {
  const popup = new BrowserWindow({
    width: 500,
    height: 700,
    parent: parentWindow,
    modal: false,
    show: true,
    webPreferences: {
      partition: SESSION_PARTITIONS[activeProvider || 'chatgpt'],
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  // Set the same user agent
  popup.webContents.setUserAgent(CHROME_USER_AGENT);

  // Track this window
  oauthWindows.add(popup);

  // Clean up when closed
  popup.on('closed', () => {
    oauthWindows.delete(popup);
  });

  // Monitor navigation to detect auth completion
  popup.webContents.on('will-navigate', (event, navUrl) => {
    handleOAuthNavigation(popup, navUrl);
  });

  popup.webContents.on('did-navigate', (event, navUrl) => {
    handleOAuthNavigation(popup, navUrl);
  });

  // Handle new window requests from within OAuth popup
  popup.webContents.setWindowOpenHandler((details: HandlerDetails) => {
    // Open in the same popup or shell depending on the URL
    if (isOAuthURL(details.url)) {
      popup.loadURL(details.url);
    } else {
      shell.openExternal(details.url);
    }
    return { action: 'deny' };
  });

  popup.loadURL(url);

  return popup;
}

/**
 * Handle navigation within OAuth flow.
 * Close the popup when auth is complete (redirected back to ChatGPT).
 */
function handleOAuthNavigation(popup: BrowserWindow, url: string): void {
  try {
    const urlObj = new URL(url);
    
    // Auth is complete when we're redirected back to chatgpt.com or openai.com
    if (
      urlObj.hostname === 'chatgpt.com' ||
      urlObj.hostname === 'chat.openai.com' ||
      urlObj.hostname.endsWith('.openai.com')
    ) {
      // Small delay to ensure cookies are set
      setTimeout(() => {
        if (!popup.isDestroyed()) {
          popup.close();
        }
      }, 500);
    }
  } catch {
    // Invalid URL, ignore
  }
}

// ============================================================================
// BROWSER VIEW MANAGEMENT
// ============================================================================

/**
 * Create and configure the BrowserView for a provider.
 */
function createProviderView(parentWindow: BrowserWindow, provider: ProviderType): BrowserView {
  const partition = SESSION_PARTITIONS[provider];
  const view = new BrowserView({
    webPreferences: {
      partition: partition,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      // Enable necessary web features
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  // Set custom user agent to avoid bot detection
  view.webContents.setUserAgent(CHROME_USER_AGENT);

  // Handle OAuth popup windows
  view.webContents.setWindowOpenHandler((details: HandlerDetails) => {
    const { url } = details;

    // Check if this is an OAuth URL
    if (isOAuthURL(url)) {
      createOAuthPopup(url, parentWindow);
      return { action: 'deny' };
    }

    // For other URLs, open in default browser
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Handle OAuth redirects (some providers use redirects instead of popups)
  view.webContents.on('will-navigate', (event, url) => {
    // Allow navigation within ChatGPT and OpenAI domains
    try {
      const urlObj = new URL(url);
      if (
        urlObj.hostname === 'chatgpt.com' ||
        urlObj.hostname === 'chat.openai.com' ||
        urlObj.hostname.endsWith('.openai.com')
      ) {
        return; // Allow
      }

      // For OAuth URLs, let them navigate in the view
      if (isOAuthURL(url)) {
        return; // Allow OAuth in-view navigation
      }

      // Block navigation to other external sites
      event.preventDefault();
      shell.openExternal(url);
    } catch {
      // Invalid URL, block
      event.preventDefault();
    }
  });

  // Log page load events for debugging
  view.webContents.on('did-finish-load', async () => {
    const url = view.webContents.getURL();
    console.log('[ChatGPT View] Page loaded:', url);

    // Install send interceptor on ChatGPT pages
    if (url.includes('chatgpt.com') || url.includes('chat.openai.com')) {
      console.log('[ChatGPT View] Installing send interceptor...');
      const success = await installInterceptor(view.webContents);
      if (success) {
        console.log('[ChatGPT View] Send interceptor installed - messages will route through Conductor');
      } else {
        console.error('[ChatGPT View] Failed to install send interceptor');
      }
    }
  });

  // Detect logout: When user logs out in ChatGPT, navigate back to ProfilePicker
  view.webContents.on('did-navigate', (event, url) => {
    if (isLogoutURL(url)) {
      console.log('[ChatGPT View] Logout detected, notifying renderer');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('provider:logout-detected', 'chatgpt');
      }
    }
  });

  view.webContents.on('did-navigate-in-page', (event, url) => {
    if (isLogoutURL(url)) {
      console.log('[ChatGPT View] Logout detected (in-page), notifying renderer');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('provider:logout-detected', 'chatgpt');
      }
    }
  });

  view.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('[ChatGPT View] Failed to load:', validatedURL, errorCode, errorDescription);
  });

  return view;
}

/**
 * Update BrowserView bounds to match window size.
 * Leaves space at bottom for navigation bar (Switch AI button).
 */
const NAV_BAR_HEIGHT = 56; // Height reserved for our navigation overlay

function updateViewBounds(window: BrowserWindow, view: BrowserView): void {
  const contentBounds = window.getContentBounds();
  const windowBounds = window.getBounds();

  // Use window size as fallback if content bounds are invalid
  const width = contentBounds.width > 0 ? contentBounds.width : windowBounds.width;
  const height = contentBounds.height > 0 ? contentBounds.height : windowBounds.height;

  // Leave space at bottom for our navigation bar
  const viewHeight = height - NAV_BAR_HEIGHT;

  console.log(`[BrowserView] Setting bounds: ${width}x${viewHeight} (nav bar: ${NAV_BAR_HEIGHT}px)`);

  view.setBounds({
    x: 0,
    y: 0,
    width: width,
    height: viewHeight,
  });
}

// ============================================================================
// MAIN WINDOW CREATION
// ============================================================================

/**
 * Check if running in development mode
 */
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

/**
 * Create the main application window.
 */
function createMainWindow(): void {
  // Configure the persistent session
  const chatGPTSession = configureSession();

  // Create main window with macOS-specific styling
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: 800,
    minHeight: 600,
    show: true,
    backgroundColor: '#f8f9fa',

    // macOS specific: hidden titlebar with traffic lights
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },

    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Load the React app (ProfilePicker → ChatInterface flow)
  if (isDev) {
    // In development, load from Vite dev server
    mainWindow.loadURL('http://localhost:3000');
    console.log('[App] Loading React app from Vite dev server');
  } else {
    // In production, load from built renderer
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    console.log('[App] Loading React app from built files');
  }

  // BrowserView will be created when user selects a provider
  // Don't create it initially - ProfilePicker handles provider selection

  // Handle window close
  mainWindow.on('closed', () => {
    // Close any remaining OAuth windows
    oauthWindows.forEach(win => {
      if (!win.isDestroyed()) {
        win.close();
      }
    });
    oauthWindows.clear();

    mainWindow = null;
    chatGPTView = null;
  });
}

// ============================================================================
// APP LIFECYCLE
// ============================================================================

// Wait for app to be ready
app.whenReady().then(() => {
  createMainWindow();

  // Set up response capture IPC handlers (Gate 3)
  setupCaptureIPC(() => chatGPTView);

  // Set up send interceptor IPC handlers (Conductor routing)
  setupInterceptorIPC();
  console.log('[App] Send interceptor IPC handlers registered');

  // Set up CLI authentication IPC handlers (Gate 6)
  setupCliAuthIPC(() => mainWindow);
  if (mainWindow) {
    setMainWindow(mainWindow);
  }

  // Set up CLI provider manager IPC handlers (Gate 17 - Isolated Provider Auth)
  setupCLIProviderIPC(() => mainWindow);
  if (mainWindow) {
    setProviderMainWindow(mainWindow);
  }

  // Initialize plugin system (Gate 10)
  initializePluginSystem();
  setupPluginIPC();

  // Initialize auto-updater (Gate 12)
  setupUpdaterIPC(() => mainWindow);
  if (mainWindow) {
    const updater = getUpdater();
    updater.setMainWindow(mainWindow);
  }
  // Check for updates after 5 second delay (let app settle)
  checkForUpdatesAfterDelay(5000);

  // Initialize state manager and tray (Gate 11)
  const stateManager = getStateManager();
  setupStateIPC();

  // Initialize tray icon
  const trayManager = getTrayManager();
  if (mainWindow) {
    trayManager.create(mainWindow);

    // Handle minimize to tray
    mainWindow.on('minimize', () => {
      const settings = stateManager.getSettings();
      if (settings.minimizeToTray && trayManager.isCreated()) {
        mainWindow?.hide();
      }
    });

    // Handle close to tray (macOS behavior)
    mainWindow.on('close', (event) => {
      const settings = stateManager.getSettings();
      if (settings.minimizeToTray && trayManager.isCreated() && !(app as any).isQuitting) {
        event.preventDefault();
        mainWindow?.hide();
      }
    });
  }

  // Forward state manager task events to renderer
  stateManager.on('task-update', (event: TaskUpdateEvent) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('state:task-update', event);
    }
  });

  // Handle tray events
  trayManager.on('show-window', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Check for interrupted tasks on startup
  const interruptedTasks = stateManager.getInterruptedTasks();
  if (interruptedTasks.length > 0) {
    const settings = stateManager.getSettings();
    if (settings.autoResumeOnStartup) {
      console.log(`[App] Found ${interruptedTasks.length} interrupted tasks`);
      // Notify renderer about interrupted tasks
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('state:interrupted-tasks', interruptedTasks);
        }
      }, 1000);
    }
  }

  // Initialize Conductor System (Tier 1 Router)
  console.log('[App] Initializing Conductor routing system...');
  const conductor = getConductor();

  // Background auto-install (Option A: non-blocking during startup)
  (async () => {
    try {
      const systemProfile = await scanSystem();
      const missingTools = Object.entries(systemProfile.tools)
        .filter(([_, tool]) => !tool.installed)
        .map(([name]) => name);

      if (missingTools.length > 0) {
        console.log(`[App] Found ${missingTools.length} missing CLIs. Starting background installer...`);
        console.log(`[App] Missing: ${missingTools.join(', ')}`);

        // Run installer in background (non-blocking)
        const progressCallback = (progress: InstallProgress): void => {
          console.log(`[App] Install progress: ${progress.currentStep} [${progress.stepIndex}/${progress.totalSteps}] - ${Math.round(progress.percentComplete)}%`);
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('system:install-progress', progress);
          }
        };

        const result = await installMissingTools(progressCallback);
        console.log('[App] Background installer complete:', {
          success: result.success,
          installed: result.installedTools.length,
          failed: result.failedTools.length,
        });

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('system:install-complete', result);
        }
      } else {
        console.log('[App] All CLIs already installed');
      }
    } catch (err) {
      console.error('[App] Background installer error:', err);
    }
  })(); // Fire-and-forget, doesn't block app startup

  conductor.initialize().then(() => {
    console.log('[App] Conductor initialized successfully');
  }).catch((err) => {
    console.error('[App] Conductor initialization failed:', err);
  });

  // Initialize Rate Limit Recovery (check for deferred work from previous session)
  const rateLimitRecovery = getRateLimitRecovery();
  // Note: Full scheduler integration happens when a plan is executed
  console.log('[App] Rate limit recovery initialized');

  // Set up Conductor IPC handlers
  setupConductorIPC();

  // macOS: Re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle certificate errors (for development)
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  // In production, you should NOT do this
  // For development, you might want to allow certain certificates
  callback(false); // Reject by default
});

// Track if we're quitting (for close to tray behavior)
(app as any).isQuitting = false;

app.on('before-quit', () => {
  (app as any).isQuitting = true;
});

// Clean up before quit
app.on('will-quit', async () => {
  // Kill all CLI processes and cleanup
  console.log('[App] Shutting down...');

  // Save state and cleanup (Gate 11)
  cleanupStateManager();
  cleanupTrayManager();

  // Cleanup Conductor system
  cleanupConductor();
  cleanupStepScheduler();
  cleanupRateLimitRecovery();

  cleanupPluginSystem();
  cleanupCLIRunner();
  cleanupCodexAdapter();
  cleanupErrorHandler();
  await cleanupFileWatcher();
});

// ============================================================================
// IPC HANDLERS - ChatGPT Injection (Gate 2)
// ============================================================================

/**
 * Helper to get ChatGPT webContents safely
 */
function getChatGPTWebContents(): Electron.WebContents | null {
  if (!chatGPTView) {
    console.error('[IPC] ChatGPT view not initialized');
    return null;
  }
  return chatGPTView.webContents;
}

/**
 * IPC: Inject text into ChatGPT's input field
 * @param text - The text to inject
 * @returns InjectionResult with success status and strategy used
 */
ipcMain.handle('chatgpt:inject', async (_event, text: string): Promise<InjectionResult> => {
  console.log('[IPC] chatgpt:inject called');

  const webContents = getChatGPTWebContents();
  if (!webContents) {
    return { success: false, error: 'ChatGPT view not available' };
  }

  return await injectText(webContents, text);
});

/**
 * IPC: Trigger send button click in ChatGPT
 * @returns SendResult with success status and method used
 */
ipcMain.handle('chatgpt:send', async (): Promise<SendResult> => {
  console.log('[IPC] chatgpt:send called');

  const webContents = getChatGPTWebContents();
  if (!webContents) {
    return { success: false, error: 'ChatGPT view not available' };
  }

  return await triggerSend(webContents);
});

/**
 * IPC: Inject text and send in one operation
 * Includes 300ms delay between inject and send for React state update
 * @param text - The text to inject and send
 * @returns Combined injection and send results
 */
ipcMain.handle('chatgpt:inject-and-send', async (_event, text: string): Promise<{
  injection: InjectionResult;
  send: SendResult;
}> => {
  console.log('[IPC] chatgpt:inject-and-send called');

  const webContents = getChatGPTWebContents();
  if (!webContents) {
    return {
      injection: { success: false, error: 'ChatGPT view not available' },
      send: { success: false, error: 'ChatGPT view not available' },
    };
  }

  return await injectAndSend(webContents, text);
});

/**
 * IPC: Check if ChatGPT page is ready for interaction
 * @returns boolean indicating readiness
 */
ipcMain.handle('chatgpt:is-ready', async (): Promise<boolean> => {
  console.log('[IPC] chatgpt:is-ready called');

  const webContents = getChatGPTWebContents();
  if (!webContents) {
    return false;
  }

  return await isPageReady(webContents);
});

/**
 * IPC: Wait for ChatGPT page to be ready
 * @param timeout - Optional timeout in milliseconds (default 5000)
 * @returns boolean indicating if page became ready before timeout
 */
ipcMain.handle('chatgpt:wait-ready', async (_event, timeout?: number): Promise<boolean> => {
  console.log('[IPC] chatgpt:wait-ready called');

  const webContents = getChatGPTWebContents();
  if (!webContents) {
    return false;
  }

  return await waitForPageReady(webContents, timeout);
});

/**
 * IPC: Get current content of ChatGPT's input field
 * @returns Current input field content as string
 */
ipcMain.handle('chatgpt:get-input', async (): Promise<string> => {
  console.log('[IPC] chatgpt:get-input called');

  const webContents = getChatGPTWebContents();
  if (!webContents) {
    return '';
  }

  return await getInputContent(webContents);
});

/**
 * IPC: Clear ChatGPT's input field
 * @returns boolean indicating success
 */
ipcMain.handle('chatgpt:clear-input', async (): Promise<boolean> => {
  console.log('[IPC] chatgpt:clear-input called');

  const webContents = getChatGPTWebContents();
  if (!webContents) {
    return false;
  }

  return await clearInput(webContents);
});

// ============================================================================
// IPC HANDLERS - System Scanner & Auto-Installer (Gate 5)
// ============================================================================

/**
 * IPC: Run full system scan to detect installed tools
 * @returns SystemProfile with all tool information
 */
ipcMain.handle('system:scan', async (): Promise<SystemProfile> => {
  console.log('[IPC] system:scan called');
  return await scanSystem();
});

/**
 * IPC: Check if a specific tool is installed
 * @param toolKey - Key of the tool to check (homebrew, git, node, python, codex, claudeCode, gsd)
 * @returns boolean indicating if tool is installed
 */
ipcMain.handle('system:is-installed', async (_event, toolKey: string): Promise<boolean> => {
  console.log(`[IPC] system:is-installed called for: ${toolKey}`);
  return await isToolInstalled(toolKey as keyof SystemProfile['tools']);
});

/**
 * IPC: Get detailed info for a specific tool
 * @param toolKey - Key of the tool to get info for
 * @returns ToolInfo or null if tool key is invalid
 */
ipcMain.handle('system:tool-info', async (_event, toolKey: string): Promise<ToolInfo | null> => {
  console.log(`[IPC] system:tool-info called for: ${toolKey}`);
  return await getToolInfo(toolKey as keyof SystemProfile['tools']);
});

/**
 * IPC: Start installation process for missing tools
 * Sends progress events via 'system:install-progress' channel
 * @param specificTools - Optional array of tool keys to install (installs all missing if not provided)
 * @returns InstallResult with success status and details
 */
ipcMain.handle('system:install', async (event, specificTools?: string[]): Promise<InstallResult> => {
  console.log('[IPC] system:install called', specificTools ? `for: ${specificTools.join(', ')}` : '(all missing)');

  const progressCallback = (progress: InstallProgress): void => {
    // Send progress to renderer via the window's webContents
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('system:install-progress', progress);
    }
  };

  const result = await installMissingTools(progressCallback, specificTools);

  // Send completion event
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('system:install-complete', result);
  }

  return result;
});

/**
 * IPC: Install a single specific tool
 * @param toolKey - Key of the tool to install
 * @returns InstallResult with success status and details
 */
ipcMain.handle('system:install-tool', async (event, toolKey: string): Promise<InstallResult> => {
  console.log(`[IPC] system:install-tool called for: ${toolKey}`);

  const progressCallback = (progress: InstallProgress): void => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('system:install-progress', progress);
    }
  };

  const result = await installTool(toolKey, progressCallback);

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('system:install-complete', result);
  }

  return result;
});

/**
 * IPC: Retry failed installations from a previous result
 * @param previousResult - The InstallResult from a previous failed installation
 * @returns InstallResult with success status and details
 */
ipcMain.handle('system:retry-failed', async (event, previousResult: InstallResult): Promise<InstallResult> => {
  console.log('[IPC] system:retry-failed called for:', previousResult.failedTools.map(f => f.name).join(', '));

  const progressCallback = (progress: InstallProgress): void => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('system:install-progress', progress);
    }
  };

  const result = await retryFailedInstalls(previousResult, progressCallback);

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('system:install-complete', result);
  }

  return result;
});

/**
 * IPC: Get estimated install time for a set of tools
 * @param toolKeys - Array of tool keys to estimate
 * @returns Estimated seconds to install
 */
ipcMain.handle('system:estimate-time', async (_event, toolKeys: string[]): Promise<number> => {
  console.log(`[IPC] system:estimate-time called for: ${toolKeys.join(', ')}`);
  return estimateInstallTime(toolKeys);
});

// ============================================================================
// IPC HANDLERS - CLI Process Management (Gate 7)
// ============================================================================

/**
 * Initialize CLI Runner and set up event forwarding to renderer
 */
function setupCLIRunnerIPC(): void {
  const runner = getCLIRunner();

  // Forward output events to renderer
  runner.on('output', (output: ProcessOutput) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      // Send raw output
      mainWindow.webContents.send('cli:output', output);

      // Also send translated output if available
      const translation = translateCleanOutput(output.data);
      if (translation.translated && translation.message) {
        mainWindow.webContents.send('cli:translated', {
          processId: output.processId,
          message: translation.message,
          category: translation.category,
          timestamp: output.timestamp,
        });
      }
    }
  });

  // Forward status events to renderer
  runner.on('status', (status: ProcessStatusEvent) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('cli:status', status);
    }
  });

  // Forward error events to renderer
  runner.on('error', (error: Error & { processId: string }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('cli:error', {
        processId: error.processId,
        message: error.message,
        timestamp: new Date(),
      });
    }
  });
}

// Set up CLI Runner IPC on module load
setupCLIRunnerIPC();

/**
 * IPC: Spawn a new CLI process
 * @param tool - The command/tool to run
 * @param args - Arguments to pass
 * @param options - Spawn options (cwd, env, timeout, background)
 * @returns Process ID for tracking
 */
ipcMain.handle('cli:run', async (
  _event,
  tool: string,
  args: string[] = [],
  options: SpawnOptions = {}
): Promise<string> => {
  console.log(`[IPC] cli:run called: ${tool} ${args.join(' ')}`);
  const runner = getCLIRunner();
  return runner.spawn(tool, args, options);
});

/**
 * IPC: Kill a specific process
 * @param processId - The process ID to kill
 * @param signal - Signal to send (default: SIGTERM)
 * @returns True if kill was initiated
 */
ipcMain.handle('cli:kill', async (
  _event,
  processId: string,
  signal?: string
): Promise<boolean> => {
  console.log(`[IPC] cli:kill called for: ${processId}`);
  const runner = getCLIRunner();
  return runner.kill(processId, signal);
});

/**
 * IPC: Kill all running processes
 */
ipcMain.handle('cli:kill-all', async (): Promise<void> => {
  console.log('[IPC] cli:kill-all called');
  const runner = getCLIRunner();
  runner.killAll();
});

/**
 * IPC: Get info about a specific process
 * @param processId - The process ID to look up
 * @returns ProcessInfo or null
 */
ipcMain.handle('cli:get-process', async (
  _event,
  processId: string
): Promise<ProcessInfo | null> => {
  const runner = getCLIRunner();
  return runner.getProcess(processId);
});

/**
 * IPC: List all processes
 * @param runningOnly - If true, only return running processes
 * @returns Array of ProcessInfo
 */
ipcMain.handle('cli:list', async (
  _event,
  runningOnly: boolean = false
): Promise<ProcessInfo[]> => {
  const runner = getCLIRunner();
  return runningOnly ? runner.getRunningProcesses() : runner.getAllProcesses();
});

/**
 * IPC: Check if a process is running
 * @param processId - The process ID to check
 * @returns True if process is running
 */
ipcMain.handle('cli:is-running', async (
  _event,
  processId: string
): Promise<boolean> => {
  const runner = getCLIRunner();
  return runner.isRunning(processId);
});

/**
 * IPC: Clean up old completed processes
 * @param maxAge - Maximum age in milliseconds (default: 1 hour)
 * @returns Number of processes cleaned up
 */
ipcMain.handle('cli:cleanup', async (
  _event,
  maxAge?: number
): Promise<number> => {
  console.log('[IPC] cli:cleanup called');
  const runner = getCLIRunner();
  return runner.cleanup(maxAge);
});

/**
 * IPC: Translate raw CLI output to friendly message
 * @param rawOutput - Raw CLI output string
 * @returns TranslationResult with message and category
 */
ipcMain.handle('cli:translate', async (
  _event,
  rawOutput: string
): Promise<TranslationResult> => {
  return translateCleanOutput(rawOutput);
});

/**
 * IPC: Get simple progress status from output
 * @param rawOutput - Raw CLI output string
 * @returns Friendly status string or null
 */
ipcMain.handle('cli:get-status', async (
  _event,
  rawOutput: string
): Promise<string | null> => {
  return getProgressStatus(rawOutput);
});

// ============================================================================
// IPC HANDLERS - Codex Adapter
// ============================================================================

import {
  getCodexAdapter,
  cleanupCodexAdapter,
  CodexAdapter,
  CodexResult,
  CodexOptions,
} from './codex-adapter';

/**
 * IPC: Execute a prompt with Codex CLI.
 * @param prompt - The prompt to send to Codex
 * @param options - Execution options (model, timeout, etc.)
 * @returns CodexResult with response, code blocks, etc.
 */
ipcMain.handle('codex:execute', async (
  _event,
  prompt: string,
  options?: CodexOptions
): Promise<CodexResult> => {
  console.log(`[IPC] codex:execute called: "${prompt.substring(0, 50)}..."`);
  const adapter = getCodexAdapter();

  // Forward events to renderer
  adapter.on('message', (msg) => {
    mainWindow?.webContents.send('codex:message', msg);
  });
  adapter.on('response', (text) => {
    mainWindow?.webContents.send('codex:response', text);
  });
  adapter.on('reasoning', (text) => {
    mainWindow?.webContents.send('codex:reasoning', text);
  });

  try {
    const result = await adapter.execute(prompt, options);
    return result;
  } finally {
    adapter.removeAllListeners();
  }
});

/**
 * IPC: Check if Codex is installed.
 */
ipcMain.handle('codex:is-installed', async (): Promise<boolean> => {
  return CodexAdapter.isInstalled();
});

/**
 * IPC: Get Codex version.
 */
ipcMain.handle('codex:version', async (): Promise<string | null> => {
  return CodexAdapter.getVersion();
});

/**
 * IPC: Cancel current Codex execution.
 */
ipcMain.handle('codex:cancel', async (): Promise<void> => {
  const adapter = getCodexAdapter();
  adapter.cancel();
});

// ============================================================================
// IPC HANDLERS - Task Router (Gate 8)
// ============================================================================

/**
 * IPC: Route a ProjectBrief to determine execution path.
 * @param brief - The ProjectBrief to route
 * @returns RoutingDecision with path, plugins, and reasoning
 */
ipcMain.handle('router:route', async (
  _event,
  brief: ProjectBrief
): Promise<RoutingDecision> => {
  console.log('[IPC] router:route called');
  const router = getTaskRouter();
  return router.route(brief);
});

/**
 * IPC: Route a raw message string to determine execution path.
 * @param message - Raw user message to route
 * @returns RoutingDecision with path, plugins, and reasoning
 */
ipcMain.handle('router:route-message', async (
  _event,
  message: string
): Promise<RoutingDecision> => {
  console.log(`[IPC] router:route-message called: "${message.substring(0, 50)}..."`);
  const router = getTaskRouter();
  return router.routeFromMessage(message);
});

/**
 * IPC: Get detailed explanation for a routing decision.
 * @param decision - The RoutingDecision to explain
 * @returns Human-readable explanation string
 */
ipcMain.handle('router:explain', async (
  _event,
  decision: RoutingDecision
): Promise<string> => {
  console.log('[IPC] router:explain called');
  const router = getTaskRouter();
  return router.explain(decision);
});

// ============================================================================
// IPC HANDLERS - File Watcher (Gate 9)
// ============================================================================

/**
 * Set up file watcher event forwarding to renderer
 */
function setupFileWatcherIPC(): void {
  const watcher = getFileWatcher();

  // Forward change events to renderer
  watcher.on('change', (change: FileChange) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('files:changed', change);
    }
  });

  // Forward ready events
  watcher.on('ready', (directory: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('files:ready', directory);
    }
  });

  // Forward error events
  watcher.on('error', (error: { directory: string; error: Error }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('files:error', {
        directory: error.directory,
        message: error.error.message,
      });
    }
  });
}

// Set up file watcher IPC on module load
setupFileWatcherIPC();

/**
 * IPC: Start watching a directory for changes
 * @param directory - Absolute path to the directory to watch
 */
ipcMain.handle('files:watch', async (
  _event,
  directory: string
): Promise<void> => {
  console.log(`[IPC] files:watch called: ${directory}`);
  const watcher = getFileWatcher();
  watcher.watch(directory);
});

/**
 * IPC: Stop watching a directory
 * @param directory - Absolute path to the directory to stop watching
 */
ipcMain.handle('files:unwatch', async (
  _event,
  directory: string
): Promise<void> => {
  console.log(`[IPC] files:unwatch called: ${directory}`);
  const watcher = getFileWatcher();
  await watcher.unwatch(directory);
});

/**
 * IPC: Get file tree for a directory
 * @param directory - Absolute path to the directory
 * @param depth - Maximum depth to traverse (default: 3)
 * @returns FileNode representing the directory tree
 */
ipcMain.handle('files:tree', async (
  _event,
  directory: string,
  depth?: number
): Promise<FileNode> => {
  console.log(`[IPC] files:tree called: ${directory} (depth: ${depth ?? 3})`);
  const watcher = getFileWatcher();
  return watcher.getTree(directory, depth);
});

/**
 * IPC: Get recent file changes
 * @param since - Optional ISO date string to filter changes since
 * @returns Array of FileChange objects
 */
ipcMain.handle('files:changes', async (
  _event,
  since?: string
): Promise<FileChange[]> => {
  console.log('[IPC] files:changes called');
  const watcher = getFileWatcher();
  const sinceDate = since ? new Date(since) : undefined;
  return watcher.getChanges(sinceDate);
});

/**
 * IPC: Get list of currently watched directories
 * @returns Array of directory paths
 */
ipcMain.handle('files:watched', async (): Promise<string[]> => {
  console.log('[IPC] files:watched called');
  const watcher = getFileWatcher();
  return watcher.getWatchedDirectories();
});

// ============================================================================
// IPC HANDLERS - Project Manager (Gate 9)
// ============================================================================

/**
 * IPC: Create a new project
 * @param name - Human-readable project name
 * @param description - Optional project description
 * @returns The created Project object
 */
ipcMain.handle('project:create', async (
  _event,
  name: string,
  description?: ProjectDescription
): Promise<Project> => {
  console.log(`[IPC] project:create called: ${name}`);
  const manager = getProjectManager();
  return manager.createProject(name, description);
});

/**
 * IPC: List all projects
 * @returns Array of Project objects sorted by last accessed
 */
ipcMain.handle('project:list', async (): Promise<Project[]> => {
  console.log('[IPC] project:list called');
  const manager = getProjectManager();
  return manager.listProjects();
});

/**
 * IPC: Get a project by ID
 * @param id - Project ID
 * @returns Project object or null if not found
 */
ipcMain.handle('project:get', async (
  _event,
  id: string
): Promise<Project | null> => {
  console.log(`[IPC] project:get called: ${id}`);
  const manager = getProjectManager();
  return manager.getProject(id);
});

/**
 * IPC: Delete a project
 * @param id - Project ID
 * @returns True if deleted successfully
 */
ipcMain.handle('project:delete', async (
  _event,
  id: string
): Promise<boolean> => {
  console.log(`[IPC] project:delete called: ${id}`);
  const manager = getProjectManager();
  return manager.deleteProject(id);
});

/**
 * IPC: Get project path by ID
 * @param id - Project ID
 * @returns Project path or empty string if not found
 */
ipcMain.handle('project:path', async (
  _event,
  id: string
): Promise<string> => {
  console.log(`[IPC] project:path called: ${id}`);
  const manager = getProjectManager();
  return manager.getProjectPath(id);
});

/**
 * IPC: Open project in Finder
 * @param id - Project ID
 * @returns True if opened successfully
 */
ipcMain.handle('project:open-finder', async (
  _event,
  id: string
): Promise<boolean> => {
  console.log(`[IPC] project:open-finder called: ${id}`);
  const manager = getProjectManager();
  return manager.openInFinder(id);
});

/**
 * IPC: Open project in VS Code
 * @param id - Project ID
 * @returns True if command was issued
 */
ipcMain.handle('project:open-editor', async (
  _event,
  id: string
): Promise<boolean> => {
  console.log(`[IPC] project:open-editor called: ${id}`);
  const manager = getProjectManager();
  return manager.openInEditor(id);
});

/**
 * IPC: Update project description
 * @param id - Project ID
 * @param description - New description data
 * @returns True if updated successfully
 */
ipcMain.handle('project:update', async (
  _event,
  id: string,
  description: Partial<ProjectDescription>
): Promise<boolean> => {
  console.log(`[IPC] project:update called: ${id}`);
  const manager = getProjectManager();
  return manager.updateBrief(id, description);
});

/**
 * IPC: Open project root directory in Finder
 */
ipcMain.handle('project:open-root', async (): Promise<void> => {
  console.log('[IPC] project:open-root called');
  const manager = getProjectManager();
  manager.openProjectRoot();
});

/**
 * IPC: Get the project root directory path
 * @returns Path to the project root directory
 */
ipcMain.handle('project:root-path', async (): Promise<string> => {
  console.log('[IPC] project:root-path called');
  return PROJECT_ROOT;
});

// ============================================================================
// IPC HANDLERS - Plugin System (Gate 10)
// ============================================================================

/**
 * Set up plugin event forwarding to renderer
 */
function setupPluginIPC(): void {
  const executor = getPluginExecutor();
  const gsd = getGSDIntegration();

  // Forward plugin status events to renderer
  executor.on('status', (event: PluginStatusEvent) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('plugin:status', event);
    }
  });

  // Forward plugin output events to renderer
  executor.on('output', (event: PluginOutputEvent) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('plugin:output', event);
    }
  });

  // Forward GSD phase update events
  gsd.on('phase-update', (event: GSDPhaseEvent) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('gsd:phase-update', event);
    }
  });

  // Forward GSD progress events
  gsd.on('progress', (projectPath: string, progress: number) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('gsd:progress', { projectPath, progress });
    }
  });
}

/**
 * IPC: List all registered plugins
 * @returns Array of plugin configs
 */
ipcMain.handle('plugin:list', async (): Promise<PluginConfig[]> => {
  console.log('[IPC] plugin:list called');
  const registry = getPluginRegistry();
  return registry.getAll();
});

/**
 * IPC: Get a plugin config by name
 * @param name - Plugin name
 * @returns Plugin config or null
 */
ipcMain.handle('plugin:get', async (
  _event,
  name: string
): Promise<PluginConfig | null> => {
  console.log(`[IPC] plugin:get called: ${name}`);
  const registry = getPluginRegistry();
  return registry.get(name);
});

/**
 * IPC: Execute a plugin
 * @param pluginName - Name of the plugin to execute
 * @param projectPath - Path to the project directory
 * @param args - Arguments to pass to the plugin
 * @returns Execution ID for tracking
 */
ipcMain.handle('plugin:execute', async (
  _event,
  pluginName: string,
  projectPath: string,
  args: string[] = []
): Promise<string> => {
  console.log(`[IPC] plugin:execute called: ${pluginName} at ${projectPath}`);
  const executor = getPluginExecutor();
  return executor.execute(pluginName, projectPath, args);
});

/**
 * IPC: Get execution status
 * @param executionId - Execution ID
 * @returns Plugin instance or null
 */
ipcMain.handle('plugin:status', async (
  _event,
  executionId: string
): Promise<PluginInstance | null> => {
  console.log(`[IPC] plugin:status called: ${executionId}`);
  const executor = getPluginExecutor();
  return executor.getStatus(executionId);
});

/**
 * IPC: Cancel a plugin execution
 * @param executionId - Execution ID to cancel
 * @returns True if cancelled
 */
ipcMain.handle('plugin:cancel', async (
  _event,
  executionId: string
): Promise<boolean> => {
  console.log(`[IPC] plugin:cancel called: ${executionId}`);
  const executor = getPluginExecutor();
  return executor.cancel(executionId);
});

/**
 * IPC: Get plugins by capability
 * @param capability - Capability to search for
 * @returns Array of matching plugin configs
 */
ipcMain.handle('plugin:by-capability', async (
  _event,
  capability: string
): Promise<PluginConfig[]> => {
  console.log(`[IPC] plugin:by-capability called: ${capability}`);
  const registry = getPluginRegistry();
  return registry.getByCapability(capability);
});

/**
 * IPC: Get plugins by trigger keyword
 * @param keyword - Keyword to search for
 * @returns Array of matching plugin configs
 */
ipcMain.handle('plugin:by-trigger', async (
  _event,
  keyword: string
): Promise<PluginConfig[]> => {
  console.log(`[IPC] plugin:by-trigger called: ${keyword}`);
  const registry = getPluginRegistry();
  return registry.getByTrigger(keyword);
});

// ============================================================================
// IPC HANDLERS - GSD Integration (Gate 10)
// ============================================================================

/**
 * IPC: Initialize a GSD project
 * @param projectPath - Path to the project
 * @param brief - Project brief from intake
 * @returns Execution ID
 */
ipcMain.handle('gsd:init', async (
  _event,
  projectPath: string,
  brief: ProjectBrief
): Promise<string> => {
  console.log(`[IPC] gsd:init called: ${projectPath}`);
  const gsd = getGSDIntegration();
  return gsd.initProject(projectPath, brief);
});

/**
 * IPC: Get phases for a project
 * @param projectPath - Project path
 * @returns Array of GSD phases
 */
ipcMain.handle('gsd:phases', async (
  _event,
  projectPath: string
): Promise<GSDPhase[]> => {
  console.log(`[IPC] gsd:phases called: ${projectPath}`);
  const gsd = getGSDIntegration();
  return gsd.getPhases(projectPath);
});

/**
 * IPC: Execute a specific phase
 * @param projectPath - Project path
 * @param phaseNumber - Phase number to execute
 * @returns Execution ID
 */
ipcMain.handle('gsd:execute-phase', async (
  _event,
  projectPath: string,
  phaseNumber: number | string
): Promise<string> => {
  console.log(`[IPC] gsd:execute-phase called: ${projectPath} phase ${phaseNumber}`);
  const gsd = getGSDIntegration();
  return gsd.executePhase(projectPath, phaseNumber);
});

/**
 * IPC: Get current phase for a project
 * @param projectPath - Project path
 * @returns Current GSD phase or null
 */
ipcMain.handle('gsd:current-phase', async (
  _event,
  projectPath: string
): Promise<GSDPhase | null> => {
  console.log(`[IPC] gsd:current-phase called: ${projectPath}`);
  const gsd = getGSDIntegration();
  return gsd.getCurrentPhase(projectPath);
});

/**
 * IPC: Get full project state
 * @param projectPath - Project path
 * @returns GSD project state or null
 */
ipcMain.handle('gsd:state', async (
  _event,
  projectPath: string
): Promise<GSDProjectState | null> => {
  console.log(`[IPC] gsd:state called: ${projectPath}`);
  const gsd = getGSDIntegration();
  return gsd.getProjectState(projectPath);
});

/**
 * IPC: Refresh progress from GSD CLI
 * @param projectPath - Project path
 * @returns Execution ID
 */
ipcMain.handle('gsd:refresh', async (
  _event,
  projectPath: string
): Promise<string> => {
  console.log(`[IPC] gsd:refresh called: ${projectPath}`);
  const gsd = getGSDIntegration();
  return gsd.refreshProgress(projectPath);
});

/**
 * IPC: Get list of tracked GSD projects
 * @returns Array of project paths
 */
ipcMain.handle('gsd:tracked-projects', async (): Promise<string[]> => {
  console.log('[IPC] gsd:tracked-projects called');
  const gsd = getGSDIntegration();
  return gsd.getTrackedProjects();
});

// ============================================================================
// IPC HANDLERS - Conductor System (Intelligent Routing)
// ============================================================================

/**
 * Set up Conductor event forwarding to renderer
 */
function setupConductorIPC(): void {
  const scheduler = getStepScheduler();
  const rateLimitRecovery = getRateLimitRecovery();

  // Forward step progress events to renderer
  scheduler.on('step-start', (step: RuntimeStep) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('conductor:step-progress', step);
    }
  });

  scheduler.on('step-done', (step: RuntimeStep) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('conductor:step-done', step);
    }
  });

  scheduler.on('step-failed', (step: RuntimeStep) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('conductor:step-failed', step);
    }
  });

  scheduler.on('plan-complete', (result: any) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('conductor:plan-complete', result);
    }
  });

  // Forward rate limit events
  rateLimitRecovery.on('rate-limited', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('conductor:rate-limited');
    }
  });

  rateLimitRecovery.on('rate-limit-cleared', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('conductor:rate-limit-cleared');
    }
  });
}

/**
 * IPC: Check if message should bypass conductor (fast-path)
 * @param message - User message to check
 * @returns FastPathResult ('bypass_to_chatgpt' or 'send_to_tier1')
 */
ipcMain.handle('conductor:fast-path', async (
  _event,
  message: string
): Promise<FastPathResult> => {
  console.log(`[IPC] conductor:fast-path called: "${message.substring(0, 30)}..."`);
  return fastPathCheck(message);
});

/**
 * IPC: Classify a message and get execution plan
 * @param message - User message to classify
 * @param context - Optional context (project state, file list)
 * @returns ExecutionPlan with steps and dependencies
 */
ipcMain.handle('conductor:classify', async (
  _event,
  message: string,
  context?: Record<string, any>
): Promise<ExecutionPlan> => {
  console.log(`[IPC] conductor:classify called: "${message.substring(0, 50)}..."`);
  const conductor = getConductor();
  return conductor.classify(message, context);
});

/**
 * IPC: Execute a plan from the conductor
 * Note: This converts the conductor's ExecutionPlan format to the scheduler's format
 * @param conductorPlan - ExecutionPlan from conductor
 * @returns void (progress sent via events)
 */
ipcMain.handle('conductor:execute', async (
  _event,
  conductorPlan: ExecutionPlan
): Promise<void> => {
  console.log(`[IPC] conductor:execute called with ${conductorPlan.plan.length} steps`);
  const scheduler = getStepScheduler();

  // Convert conductor ExecutionPlan to scheduler ExecutionPlan format
  const schedulerPlan = {
    planId: `plan-${Date.now()}`,
    name: `${conductorPlan.complexity} task`,
    steps: conductorPlan.plan.map(step => ({
      id: step.id,
      target: step.target as 'web' | 'cli' | 'service',
      action: step.action,
      detail: step.detail,
      waitFor: step.waitFor,
      parallel: step.parallel,
    })),
    context: { estimatedMinutes: conductorPlan.estimated_minutes },
  };

  await scheduler.execute(schedulerPlan);
});

/**
 * IPC: Report step status for re-planning
 * @param stepId - ID of the step
 * @param status - Status string (pending, running, completed, failed, skipped)
 * @param detail - Optional detail
 * @returns Updated plan or null if no changes
 */
ipcMain.handle('conductor:report-status', async (
  _event,
  stepId: number,
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped',
  detail?: string
): Promise<ExecutionPlan | null> => {
  console.log(`[IPC] conductor:report-status called: step ${stepId} = ${status}`);
  const conductor = getConductor();
  return conductor.reportStatus(stepId, status, detail);
});

/**
 * IPC: Get conductor session status
 * @returns Session info
 */
ipcMain.handle('conductor:session-status', async (): Promise<{
  hasSession: boolean;
  sessionId: string | null;
}> => {
  const conductor = getConductor();
  return {
    hasSession: conductor.hasSession(),
    sessionId: conductor.getSessionId(),
  };
});

/**
 * IPC: Reset conductor session (force new session)
 */
ipcMain.handle('conductor:reset', async (): Promise<void> => {
  console.log('[IPC] conductor:reset called');
  const conductor = getConductor();
  await conductor.resetSession();
});

/**
 * IPC: Handle user decision for circuit breaker
 * User decisions are handled via the step:user-decision IPC channel
 * which is already set up in the step-scheduler
 */
ipcMain.handle('conductor:user-decision', async (
  _event,
  stepId: number,
  decision: 'retry' | 'skip' | 'stop'
): Promise<void> => {
  console.log(`[IPC] conductor:user-decision called: step ${stepId} = ${decision}`);
  // The step scheduler listens for 'step:user-decision' IPC events directly
  // Forward to that channel
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('step:user-decision', { stepId, decision });
  }
});

// ============================================================================
// BACKGROUND CLI IPC HANDLERS (Gate 17)
// ============================================================================

/**
 * IPC: Send message to CLI provider
 */
ipcMain.handle('cli:send', async (
  _event,
  provider: Provider,
  message: string
): Promise<void> => {
  console.log(`[IPC] cli:send called: ${provider}`);
  if (mainWindow) {
    backgroundCLI.setMainWindow(mainWindow);
  }
  await backgroundCLI.send(provider, message);
});

// ============================================================================
// PROVIDER BROWSERVIEW IPC HANDLERS
// ============================================================================

/**
 * IPC: Show the BrowserView for a provider
 * Creates a new BrowserView (if needed), loads the provider's URL
 */
ipcMain.handle('provider:show-view', async (
  _event,
  provider: ProviderType
): Promise<{ success: boolean; error?: string }> => {
  console.log(`[IPC] provider:show-view called for ${provider}`);

  if (!mainWindow || mainWindow.isDestroyed()) {
    return { success: false, error: 'Main window not available' };
  }

  if (!PROVIDER_URLS[provider]) {
    return { success: false, error: `Unknown provider: ${provider}` };
  }

  try {
    // Create new BrowserView for this provider
    chatGPTView = createProviderView(mainWindow, provider);
    activeProvider = provider;

    // Attach BrowserView to window
    mainWindow.setBrowserView(chatGPTView);

    // Update bounds to fill the window (leaving space for nav bar)
    updateViewBounds(mainWindow, chatGPTView);

    // Listen for window resize to update bounds
    const resizeHandler = () => {
      if (chatGPTView && mainWindow && !mainWindow.isDestroyed()) {
        updateViewBounds(mainWindow, chatGPTView);
      }
    };
    mainWindow.removeAllListeners('resize');
    mainWindow.on('resize', resizeHandler);

    // Load the provider's URL
    const url = PROVIDER_URLS[provider];
    console.log(`[Provider View] Loading ${provider}: ${url}`);
    await chatGPTView.webContents.loadURL(url);

    return { success: true };
  } catch (error) {
    console.error(`[IPC] provider:show-view error:`, error);
    return { success: false, error: String(error) };
  }
});

/**
 * IPC: Hide the provider BrowserView
 * Removes and destroys the BrowserView
 */
ipcMain.handle('provider:hide-view', async (): Promise<{ success: boolean }> => {
  console.log('[IPC] provider:hide-view called');

  if (!mainWindow || mainWindow.isDestroyed()) {
    return { success: false };
  }

  try {
    // Remove BrowserView from window
    mainWindow.setBrowserView(null);

    // Destroy the view to free memory
    if (chatGPTView && !chatGPTView.webContents.isDestroyed()) {
      chatGPTView.webContents.close();
    }
    chatGPTView = null;
    activeProvider = null;

    return { success: true };
  } catch (error) {
    console.error('[IPC] provider:hide-view error:', error);
    return { success: false };
  }
});

/**
 * IPC: Get currently active provider
 */
ipcMain.handle('provider:get-active', async (): Promise<ProviderType | null> => {
  return activeProvider;
});

// Legacy handlers for backward compatibility
ipcMain.handle('chatgpt:show-view', async (): Promise<{ success: boolean; error?: string }> => {
  return ipcMain.emit('provider:show-view', null, 'chatgpt') as any;
});

ipcMain.handle('chatgpt:hide-view', async (): Promise<{ success: boolean }> => {
  return ipcMain.emit('provider:hide-view', null) as any;
});

ipcMain.handle('chatgpt:is-view-visible', async (): Promise<boolean> => {
  return activeProvider === 'chatgpt' && chatGPTView !== null;
});

/**
 * IPC: Sign out from a CLI provider
 */
ipcMain.handle('auth:sign-out', async (
  _event,
  tool: CLITool
): Promise<{ success: boolean; error?: string }> => {
  console.log(`[IPC] auth:sign-out called: ${tool}`);
  return signOut(tool);
});

// ============================================================================
// CLI PROCESS MANAGEMENT FOR GEMINI (Gate 18)
// ============================================================================

/**
 * IPC: Spawn Gemini CLI process
 */
ipcMain.handle('cli:spawn-gemini', async (): Promise<{
  success: boolean;
  processId?: string;
  error?: string;
}> => {
  try {
    const runner = getCLIRunner();
    const processId = runner.spawn('gemini', [], {
      cwd: os.homedir(),
    });

    console.log(`[IPC] Spawned Gemini CLI: ${processId}`);

    // Listen for output from this process
    runner.on('output', (output: ProcessOutput) => {
      if (output.processId === processId && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('cli:output-chunk', {
          processId,
          chunk: output.data,
        });
      }
    });

    // Listen for process exit
    runner.on('status', (status: ProcessStatusEvent) => {
      if (status.processId === processId && mainWindow && !mainWindow.isDestroyed()) {
        if (status.status === 'completed' || status.status === 'failed') {
          mainWindow.webContents.send('cli:process-exit', {
            processId,
            exitCode: status.exitCode || 0,
          });
        }
      }
    });

    return { success: true, processId };
  } catch (error) {
    console.error('[IPC] Failed to spawn Gemini CLI:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * IPC: Kill Gemini CLI process
 */
ipcMain.handle('cli:kill-gemini', async (
  _event,
  processId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const runner = getCLIRunner();
    runner.kill(processId);
    console.log(`[IPC] Killed Gemini CLI: ${processId}`);
    return { success: true };
  } catch (error) {
    console.error('[IPC] Failed to kill Gemini CLI:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * IPC: Send input to running Gemini CLI process
 */
ipcMain.handle('cli:send-input', async (
  _event,
  provider: string,
  message: string
): Promise<void> => {
  if (provider === 'gemini') {
    try {
      const runner = getCLIRunner();
      console.log(`[IPC] Sending to Gemini CLI: ${message}`);
      // TODO: Implement stdin writing in cli-runner
      // For now, just log the message
    } catch (error) {
      console.error('[IPC] Failed to send input:', error);
    }
  }
});

// ============================================================================
// EXPORTS (for testing/debugging)
// ============================================================================

export {
  mainWindow,
  chatGPTView,
  isOAuthURL,
  OAUTH_DOMAINS,
  // System scanner exports
  scanSystem,
  isToolInstalled,
  getToolInfo,
  // Auto-installer exports
  installMissingTools,
  installTool,
  retryFailedInstalls,
  estimateInstallTime,
  // CLI Runner exports
  getCLIRunner,
  cleanupCLIRunner,
  translateOutput,
  translateCleanOutput,
  getProgressStatus,
  // Task Router exports
  TaskRouter,
  getTaskRouter,
  routeTask,
  routeBrief,
  // File Watcher exports (Gate 9)
  getFileWatcher,
  cleanupFileWatcher,
  // Project Manager exports (Gate 9)
  getProjectManager,
  PROJECT_ROOT,
  // Plugin System exports (Gate 10)
  initializePluginSystem,
  cleanupPluginSystem,
  getPluginRegistry,
  getPluginExecutor,
  getGSDIntegration,
  // Auto-Updater exports (Gate 12)
  getUpdater,
  setupUpdaterIPC,
  checkForUpdatesAfterDelay,
  // Conductor System exports (Intelligent Routing)
  fastPathCheck,
  getConductor,
  cleanupConductor,
  getStepScheduler,
  cleanupStepScheduler,
  getRateLimitRecovery,
  cleanupRateLimitRecovery,
};
