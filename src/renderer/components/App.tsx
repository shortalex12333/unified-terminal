import React, { useState, useEffect, useCallback } from 'react';
import StartingScreen from './StartingScreen';
import ShowcaseScreen from './ShowcaseScreen';
import KenokiChat from './KenokiChat';
// NOTE: ChatInterface, ProfilePicker, ProviderScreen removed - V2 progress monitor paradigm
import CircuitBreakerModal from './CircuitBreakerModal';
import BuildPanel, { PanelState } from './BuildPanel';
import TopBarPill from './TopBarPill';
import FuelGauge from './FuelGauge';
import TrustBadge from './TrustBadge';
import InstallerReassurance, { InstallerStep } from './InstallerReassurance';
import TokenEstimate from './TokenEstimate';
import ProjectList from './ProjectList';
import ProjectActions from './ProjectActions';
import { DeveloperConsole } from './DeveloperConsole';
import HomeScreen from '../screens/HomeScreen';
import ProgressScreen from '../screens/ProgressScreen';
import CompleteScreen from '../screens/CompleteScreen';
import ActionOverlay from './ActionOverlay';

// =============================================================================
// TYPES (Projects - Post-Build Continuation)
// =============================================================================

// Provider type (moved from ProfilePicker - needed for ProviderState)
type Provider = 'chatgpt' | 'gemini' | 'claude';

type ProjectStatus = 'active' | 'archived';

interface StoredProject {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  lastModifiedAt: string;
  template?: string;
  description: string;
  thumbnail?: string;
  status: ProjectStatus;
}

type QuickActionType = 'update-content' | 'change-design' | 'add-feature' | 'view-files' | 'deploy' | 'custom';

interface QuickAction {
  type: QuickActionType;
  label: string;
  icon: string;
  promptTemplate: string;
  description: string;
}

interface ProjectContext {
  project: StoredProject;
  quickAction?: QuickAction;
  customPrompt?: string;
}

// =============================================================================
// TYPES (App State)
// =============================================================================

export interface ProviderState {
  provider: Provider;
  providerType: 'browserview' | 'cli';
  processId?: string;
}

type AppScreen = 'starting' | 'home' | 'progress' | 'complete' | 'showcase' | 'select-provider' | 'chat' | 'installing' | 'projects' | 'project-actions';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('starting');
  const [providerState, setProviderState] = useState<ProviderState | null>(null);
  const [buildPanelState, setBuildPanelState] = useState<PanelState>('hidden');
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);

  // Progress monitor state
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentProjectName, setCurrentProjectName] = useState<string>('');
  const [completionData, setCompletionData] = useState<{
    humanFolder: string;
    deployedUrl?: string;
    summary: { pages: number; components: number };
  } | null>(null);

  // Trust & Safety state
  const [showTokenEstimate, setShowTokenEstimate] = useState(false);
  const [tokenEstimateData, setTokenEstimateData] = useState<{
    steps: number;
    complexity: 'low' | 'medium' | 'high';
  }>({ steps: 0, complexity: 'medium' });

  // Installer state
  const [installerState, setInstallerState] = useState<{
    currentStep: InstallerStep;
    stepIndex: number;
    totalSteps: number;
    percentComplete: number;
    allSteps: InstallerStep[];
  } | null>(null);

  // Project continuation state
  const [currentProject, setCurrentProject] = useState<StoredProject | null>(null);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [hasProjects, setHasProjects] = useState(false);

  // Developer console state (Cmd+Shift+D to toggle)
  const [devModeEnabled, setDevModeEnabled] = useState(false);

  // Check for existing projects on mount
  useEffect(() => {
    async function checkProjects() {
      try {
        const projects = await window.electronAPI?.projects?.list?.('active');
        setHasProjects((projects?.length ?? 0) > 0);
      } catch (err) {
        console.error('[App] Failed to check projects:', err);
        setHasProjects(false);
      }
    }
    checkProjects();
  }, []);

  // Listen for project completion
  useEffect(() => {
    const unsubscribe = window.electronAPI?.project?.onComplete?.((data) => {
      setCompletionData(data);
      setScreen('complete');
    });
    return () => unsubscribe?.();
  }, []);

  // Keyboard shortcut for dev mode toggle (Cmd+Shift+D / Ctrl+Shift+D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'd') {
        e.preventDefault();
        setDevModeEnabled(prev => {
          const newState = !prev;
          console.log(`[App] Developer console ${newState ? 'enabled' : 'disabled'}`);
          return newState;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleBegin = () => {
    setScreen('home');
  };

  const handleBuild = async (prompt: string) => {
    // Start project via IPC
    const result = await window.electronAPI?.project?.start?.(prompt);
    if (result) {
      setCurrentProjectId(result.projectId);
      setCurrentProjectName(result.projectName);
      setScreen('progress');
    }
  };

  const handleSelectTemplate = (prompt: string) => {
    setSelectedPrompt(prompt);
    setScreen('chat'); // Go directly to Kenoki chat - no provider selection needed
  };

  // Handler for "New Project" from ProjectList
  const handleNewProject = () => {
    setCurrentProject(null);
    setScreen('showcase');
  };

  // Handler for opening an existing project
  const handleOpenProject = async (project: StoredProject) => {
    try {
      const result = await window.electronAPI?.projects?.open?.(project.id);
      if (result?.project) {
        setCurrentProject(result.project);
        setQuickActions(result.quickActions || []);
        setScreen('project-actions');
      }
    } catch (err) {
      console.error('[App] Failed to open project:', err);
    }
  };

  // Handler for going back from ProjectActions to ProjectList
  const handleBackToProjects = () => {
    setCurrentProject(null);
    setQuickActions([]);
    setScreen('projects');
  };

  // Handler for submitting project action (quick action or custom prompt)
  const handleProjectActionSubmit = (context: ProjectContext) => {
    // Build the prompt based on context
    let prompt = '';

    if (context.quickAction) {
      prompt = context.quickAction.promptTemplate;
    } else if (context.customPrompt) {
      prompt = context.customPrompt;
    }

    // Add project context to prompt
    const fullPrompt = `[Working on existing project: ${context.project.name}]
Project path: ${context.project.path}
${context.project.description ? `Description: ${context.project.description}` : ''}

${prompt}`;

    setSelectedPrompt(fullPrompt);
    setScreen('chat'); // Go directly to Kenoki chat
  };

  // Legacy handler - kept for backward compatibility but redirects to home
  const handleSelectProvider = (state: ProviderState) => {
    setProviderState(state);
    setScreen('home'); // Redirect to home in V2
  };

  const handleLogout = async () => {
    await window.electronAPI?.providerView?.hide?.();
    setProviderState(null);
    setScreen('home'); // Redirect to home instead of provider picker
  };

  // Handle build panel state changes
  const handleBuildPanelStateChange = useCallback((state: PanelState) => {
    setBuildPanelState(state);
  }, []);

  // Handle expand from minimized top bar pill
  const handleExpandFromPill = useCallback(() => {
    setBuildPanelState('expanded');
    window.electronAPI?.statusAgent?.expandTree?.();
  }, []);

  // Listen for logout detection from any provider
  useEffect(() => {
    const cleanup = window.electronAPI?.provider?.onLogoutDetected?.((provider: string) => {
      console.log(`[App] Logout detected for ${provider}, returning to home`);
      setProviderState(null);
      setScreen('home'); // Redirect to home instead of provider picker
    });

    return () => {
      cleanup?.();
    };
  }, []);

  // Listen for CLI process exit events
  useEffect(() => {
    if (!providerState || providerState.providerType !== 'cli' || !providerState.processId) {
      return;
    }

    const cleanup = window.electronAPI?.cli?.onProcessExit?.((data: { processId: string; exitCode: number }) => {
      if (data.processId === providerState.processId) {
        console.log(`[App] CLI process exited with code ${data.exitCode}`);
        setProviderState(null);
        setScreen('home'); // Redirect to home instead of provider picker
      }
    });

    return () => {
      cleanup?.();
    };
  }, [providerState]);

  // Listen for installer progress (from auto-installer IPC)
  useEffect(() => {
    const cleanup = window.electronAPI?.cli?.onInstallProgress?.((data) => {
      // Convert IPC data to InstallerStep format
      const step: InstallerStep = {
        name: data.provider,
        key: data.provider.toLowerCase().replace(/[^a-z0-9]/g, ''),
        status: data.status === 'complete' ? 'complete' : data.status === 'error' ? 'failed' : 'installing',
        message: data.message,
      };

      // Update installer state - in a real implementation, this would be more sophisticated
      setInstallerState((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          currentStep: step,
        };
      });

      // When installation completes, transition back to home
      if (data.status === 'complete' || data.status === 'error') {
        setTimeout(() => {
          setInstallerState(null);
          setScreen('home'); // Redirect to home instead of provider picker
        }, 2000);
      }
    });

    return () => {
      cleanup?.();
    };
  }, []);

  // Handler to show token estimate before build
  const handleShowTokenEstimate = useCallback((steps: number, complexity: 'low' | 'medium' | 'high') => {
    setTokenEstimateData({ steps, complexity });
    setShowTokenEstimate(true);
  }, []);

  // Handler for token estimate continue
  const handleTokenEstimateContinue = useCallback(() => {
    setShowTokenEstimate(false);
    // Proceed with build - the actual build trigger would be here
  }, []);

  // Handler for token estimate cancel
  const handleTokenEstimateCancel = useCallback(() => {
    setShowTokenEstimate(false);
  }, []);

  // Handler for installer cancel
  const handleInstallerCancel = useCallback(() => {
    setInstallerState(null);
    setScreen('home'); // Redirect to home instead of provider picker
  }, []);

  // Render content based on current screen
  const renderContent = () => {
    switch (screen) {
      case 'starting':
        return (
          <>
            <StartingScreen onBegin={handleBegin} />
            <TrustBadge position="bottom-left" theme="light" />
          </>
        );

      case 'home':
        return (
          <>
            <HomeScreen
              onBuild={handleBuild}
              onOpenProject={(id) => {
                // Resume existing project
                setCurrentProjectId(id);
                setScreen('progress');
              }}
            />
            <TrustBadge position="bottom-left" theme="light" />
          </>
        );

      case 'progress':
        return (
          <>
            <ProgressScreen
              projectName={currentProjectName}
              onPause={() => {/* TODO */}}
              onCancel={() => setScreen('home')}
            />
            <ActionOverlay onAction={(action) => {
              window.electronAPI?.project?.respondToAction?.(action);
            }} />
          </>
        );

      case 'complete':
        if (!completionData) return <div>Loading...</div>;
        return (
          <CompleteScreen
            projectName={currentProjectName}
            humanFolder={completionData.humanFolder}
            deployedUrl={completionData.deployedUrl}
            summary={completionData.summary}
            onNewProject={() => {
              setCurrentProjectId(null);
              setCompletionData(null);
              setScreen('home');
            }}
            onModify={() => {
              // TODO: Implement modify flow
              setScreen('progress');
            }}
          />
        );

      case 'showcase':
        return (
          <>
            <ShowcaseScreen onSelectTemplate={handleSelectTemplate} />
            <TrustBadge position="bottom-left" theme="light" />
          </>
        );

      case 'select-provider':
        // Redirect to home - provider selection removed in V2
        setScreen('home');
        return null;

      case 'installing':
        if (!installerState) {
          // Redirect to home if no installer state
          setScreen('home');
          return null;
        }
        return (
          <InstallerReassurance
            currentStep={installerState.currentStep}
            stepIndex={installerState.stepIndex}
            totalSteps={installerState.totalSteps}
            percentComplete={installerState.percentComplete}
            allSteps={installerState.allSteps}
            onCancel={handleInstallerCancel}
          />
        );

      case 'chat':
        // Kenoki is the primary input - no BrowserView, no provider selection
        // User talks to Kenoki → Conductor → CLI tools
        return (
          <KenokiChat
            initialPrompt={selectedPrompt}
            onBack={() => setScreen('showcase')}
          />
        );

      case 'projects':
        return (
          <ProjectList
            onNewProject={handleNewProject}
            onOpenProject={handleOpenProject}
          />
        );

      case 'project-actions':
        if (!currentProject) {
          return (
            <ProjectList
              onNewProject={handleNewProject}
              onOpenProject={handleOpenProject}
            />
          );
        }
        return (
          <ProjectActions
            project={currentProject}
            quickActions={quickActions}
            onSubmit={handleProjectActionSubmit}
            onBack={handleBackToProjects}
          />
        );

      default:
        return <StartingScreen onBegin={handleBegin} />;
    }
  };

  return (
    <>
      {/* Split-screen container when dev mode is enabled */}
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
        }}
      >
        {/* Main content with top bar padding when minimised */}
        <div
          style={{
            width: devModeEnabled ? '60%' : '100%',
            height: '100%',
            paddingTop: buildPanelState === 'minimised' ? 44 : 0,
            transition: 'width 0.2s ease-out, padding-top 0.2s ease-out',
          }}
        >
          {renderContent()}
        </div>

        {/* Developer Console (right split, 40% width when enabled) */}
        {devModeEnabled && (
          <div
            style={{
              width: '40%',
              height: '100%',
              transition: 'width 0.2s ease-out',
            }}
          >
            <DeveloperConsole />
          </div>
        )}
      </div>

      {/* Top bar for minimised build state */}
      {buildPanelState === 'minimised' && (
        <div
          className="theme-dark"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: 44,
            background: 'var(--kenoki-surface)',
            borderBottom: '1px solid var(--kenoki-accent-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            zIndex: 50,
            animation: 'topBarSlideDown 0.2s ease-out',
          }}
        >
          <style>{`
            @keyframes topBarSlideDown {
              from { transform: translateY(-100%); }
              to { transform: translateY(0); }
            }
          `}</style>

          <TopBarPill onExpand={handleExpandFromPill} />
          <FuelGauge size="sm" />
        </div>
      )}

      {/* Build progress panel (expanded overlay or complete banner) */}
      <BuildPanel onStateChange={handleBuildPanelStateChange} />

      {/* Circuit breaker modal for step failures */}
      <CircuitBreakerModal />

      {/* Token estimate modal (shown before build starts) */}
      {showTokenEstimate && (
        <TokenEstimate
          estimatedSteps={tokenEstimateData.steps}
          complexity={tokenEstimateData.complexity}
          planType="plus"
          onContinue={handleTokenEstimateContinue}
          onCancel={handleTokenEstimateCancel}
          variant="modal"
        />
      )}
    </>
  );
}
