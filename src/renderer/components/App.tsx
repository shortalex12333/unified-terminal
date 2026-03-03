import React, { useState, useEffect } from 'react';
import ProfilePicker, { Provider } from './ProfilePicker';
import ChatInterface from './ChatInterface';

export default function App() {
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);

  // Listen for logout detection from any provider
  // When user logs out in provider's native UI, return to ProfilePicker
  useEffect(() => {
    const cleanup = window.electronAPI?.provider?.onLogoutDetected?.((provider: string) => {
      console.log(`[App] Logout detected for ${provider}, returning to ProfilePicker`);
      setSelectedProvider(null);
    });

    return () => {
      cleanup?.();
    };
  }, []);

  if (!selectedProvider) {
    return <ProfilePicker onSelectProvider={setSelectedProvider} />;
  }

  return (
    <ChatInterface
      provider={selectedProvider}
      onLogout={() => setSelectedProvider(null)}
    />
  );
}
