import React, { useState, useEffect } from 'react';
import ProfilePicker, { Provider } from './ProfilePicker';
import ChatInterface from './ChatInterface';
import TerminalUI from './TerminalUI';

export interface ProviderState {
  provider: Provider;
  providerType: 'browserview' | 'cli';
  processId?: string;
}

export default function App() {
  const [providerState, setProviderState] = useState<ProviderState | null>(null);

  // Listen for logout detection from any provider
  // When user logs out in provider's native UI, return to ProfilePicker
  useEffect(() => {
    const cleanup = window.electronAPI?.provider?.onLogoutDetected?.((provider: string) => {
      console.log(`[App] Logout detected for ${provider}, returning to ProfilePicker`);
      setProviderState(null);
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
      }
    });

    return () => {
      cleanup?.();
    };
  }, [providerState]);

  if (!providerState) {
    return <ProfilePicker onSelectProvider={setProviderState} />;
  }

  if (providerState.providerType === 'cli') {
    return (
      <TerminalUI
        provider={providerState.provider as 'gemini'}
        processId={providerState.processId!}
        onSwitchAI={() => {
          window.electronAPI?.cli?.killGemini?.(providerState.processId!);
          setProviderState(null);
        }}
      />
    );
  }

  // BrowserView providers (ChatGPT, Claude)
  return (
    <ChatInterface
      provider={providerState.provider}
      onLogout={() => setProviderState(null)}
    />
  );
}
