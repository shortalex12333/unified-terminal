import React, { useState, useEffect } from 'react';
import StartingScreen from './StartingScreen';
import ProfilePicker, { Provider } from './ProfilePicker';
import ChatInterface from './ChatInterface';
import TerminalUI from './TerminalUI';

export interface ProviderState {
  provider: Provider;
  providerType: 'browserview' | 'cli';
  processId?: string;
}

type AppScreen = 'starting' | 'select-provider' | 'chat';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('starting');
  const [providerState, setProviderState] = useState<ProviderState | null>(null);

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

  // Render based on current screen
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
}
