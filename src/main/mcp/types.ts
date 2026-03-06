export interface MCPServer {
  id: string;
  name: string;
  description: string;
  icon: string;
  oauthUrl?: string;
  requiredScopes: string[];
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
}

export interface MCPConnection {
  serverId: string;
  connectedAt: Date;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export interface SerializedMCPConnection {
  serverId: string;
  connectedAt: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
}

export const MCP_SERVERS: MCPServer[] = [
  { id: 'stripe', name: 'Stripe', description: 'Accept payments', icon: 'stripe', requiredScopes: ['read_write'], status: 'disconnected' },
  { id: 'github', name: 'GitHub', description: 'Code repositories', icon: 'github', requiredScopes: ['repo'], status: 'disconnected' },
  { id: 'vercel', name: 'Vercel', description: 'Deploy websites', icon: 'vercel', requiredScopes: ['deploy'], status: 'disconnected' },
  { id: 'supabase', name: 'Supabase', description: 'Database & auth', icon: 'supabase', requiredScopes: ['database'], status: 'disconnected' },
  { id: 'notion', name: 'Notion', description: 'Notes & docs', icon: 'notion', requiredScopes: ['read_content'], status: 'disconnected' },
];

export function serializeConnection(conn: MCPConnection): SerializedMCPConnection {
  return { ...conn, connectedAt: conn.connectedAt.toISOString(), expiresAt: conn.expiresAt?.toISOString() };
}

export function deserializeConnection(data: SerializedMCPConnection): MCPConnection {
  return { ...data, connectedAt: new Date(data.connectedAt), expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined };
}
