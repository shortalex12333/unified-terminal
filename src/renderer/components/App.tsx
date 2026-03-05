import React, { useState, useEffect, useCallback } from 'react';
import StartingScreen from './StartingScreen';
import ProfilePicker, { Provider } from './ProfilePicker';
import ChatInterface from './ChatInterface';
import TerminalUI from './TerminalUI';
import CircuitBreakerModal from './CircuitBreakerModal';
import BuildPanel, { PanelState } from './BuildPanel';
import TopBarPill from './TopBarPill';
import FuelGauge from './FuelGauge';

export interface ProviderState {
  provider: Provider;
  providerType: 'browserview' | 'cli';
  processId?: string;
}

type AppScreen = 'starting' | 'select-provider' | 'chat';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('starting');
  const [providerState, setProviderState] = useState<ProviderState | null>(null);
  const [buildPanelState, setBuildPanelState] = useState<PanelState>('hidden');

  const handleBegin = () => {
    setScreen('select-provider');
  };

  const handleSelectProvider = (state: ProviderState) => {
    setProviderState(state);
    setScreen('chat');
  };

  const handleLogout = async () => {
    await window.electronAPI?.providerView?.hide?.();
    setProviderState(null);
    setScreen('select-provider');
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
      console.log(`[App] Logout detected for ${provider}, returning to ProfilePicker`);
      setProviderState(null);
      setScreen('select-provider');
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
        setScreen('select-provider');
      }
    });

    return () => {
      cleanup?.();
    };
  }, [providerState]);

  // Render content based on current screen
  const renderContent = () => {
    switch (screen) {
      case 'starting':
        return <StartingScreen onBegin={handleBegin} />;

      case 'select-provider':
        return <ProfilePicker onSelectProvider={handleSelectProvider} />;

      case 'chat':
        if (!providerState) {
          return <ProfilePicker onSelectProvider={handleSelectProvider} />;
        }

        if (providerState.providerType === 'cli') {
          return (
            <TerminalUI
              provider={providerState.provider as 'gemini'}
              processId={providerState.processId!}
              onSwitchAI={() => {
                window.electronAPI?.cli?.killGemini?.(providerState.processId!);
                setProviderState(null);
                setScreen('select-provider');
              }}
            />
          );
        }

        return (
          <ChatInterface
            provider={providerState.provider}
            onLogout={handleLogout}
          />
        );

      default:
        return <StartingScreen onBegin={handleBegin} />;
    }
  };

  return (
    <>
      {/* Main content with top bar padding when minimised */}
      <div
        style={{
          width: '100%',
          height: '100%',
          paddingTop: buildPanelState === 'minimised' ? 44 : 0,
          transition: 'padding-top 0.2s ease-out',
        }}
      >
        {renderContent()}
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
    </>
  );
}
