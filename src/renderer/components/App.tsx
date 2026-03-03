import React, { useState } from 'react';
import ProfilePicker, { Provider } from './ProfilePicker';
import ChatInterface from './ChatInterface';

export default function App() {
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);

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
