import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { shell, BrowserWindow } from 'electron';
import {
  MCPServer,
  MCPConnection,
  MCPConnectResult,
  MCPDisconnectResult,
  MCP_SERVERS,
  serializeConnection,
  deserializeConnection,
  SerializedMCPConnection,
} from './types';

const KENOKI_DIR = path.join(os.homedir(), '.kenoki');
const CONNECTIONS_FILE = path.join(KENOKI_DIR, 'mcp-connections.json');

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export class MCPManager extends EventEmitter {
  private static instance: MCPManager | null = null;
  private connections: Map<string, MCPConnection> = new Map();
  private mainWindow: BrowserWindow | null = null;
  private initialized = false;

  private constructor() {
    super();
    ensureDir(KENOKI_DIR);
    this.loadConnections();
  }

  static getInstance(): MCPManager {
    if (!MCPManager.instance) MCPManager.instance = new MCPManager();
    return MCPManager.instance;
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    // Verify existing connections on startup
    for (const [serverId] of this.connections) {
      this.emit('status-change', { serverId, status: 'connected' });
    }
  }

  listServers(): MCPServer[] {
    return MCP_SERVERS.map(server => ({
      ...server,
      status: this.connections.has(server.id) ? 'connected' : 'disconnected'
    }));
  }

  getServer(serverId: string): MCPServer | null {
    const server = MCP_SERVERS.find(s => s.id === serverId);
    if (!server) return null;
    return {
      ...server,
      status: this.connections.has(serverId) ? 'connected' : 'disconnected',
    };
  }

  async connect(options: { serverId: string; force?: boolean; timeout?: number }): Promise<MCPConnectResult> {
    const { serverId, force } = options;
    const server = MCP_SERVERS.find(s => s.id === serverId);
    if (!server) {
      return { success: false, error: 'Server not found' };
    }

    if (this.connections.has(serverId) && !force) {
      return { success: true, connection: this.connections.get(serverId) };
    }

    this.emit('status-change', { serverId, status: 'connecting' });

    // Open OAuth URL in browser
    const oauthUrl = this.getOAuthUrl(serverId);
    if (oauthUrl) {
      await shell.openExternal(oauthUrl);
    }

    // Simulate successful connection (real impl would wait for OAuth callback)
    const connection: MCPConnection = {
      serverId,
      connectedAt: new Date(),
      accessToken: 'mock_token_' + serverId,
    };

    this.connections.set(serverId, connection);
    this.saveConnections();
    this.emit('status-change', { serverId, status: 'connected' });
    this.emit('connection-added', connection);
    return { success: true, connection };
  }

  async setApiKey(serverId: string, apiKey: string): Promise<MCPConnectResult> {
    const server = MCP_SERVERS.find(s => s.id === serverId);
    if (!server) {
      return { success: false, error: 'Server not found' };
    }

    const connection: MCPConnection = {
      serverId,
      connectedAt: new Date(),
      accessToken: apiKey,
    };

    this.connections.set(serverId, connection);
    this.saveConnections();
    this.emit('status-change', { serverId, status: 'connected' });
    this.emit('connection-added', connection);
    return { success: true, connection };
  }

  disconnect(options: { serverId: string; revokeToken?: boolean }): MCPDisconnectResult {
    const { serverId } = options;
    if (this.connections.has(serverId)) {
      this.connections.delete(serverId);
      this.saveConnections();
      this.emit('status-change', { serverId, status: 'disconnected' });
      this.emit('connection-removed', serverId);
      return { success: true };
    }
    return { success: false, error: 'Not connected' };
  }

  isConnected(serverId: string): boolean {
    return this.connections.has(serverId);
  }

  getConnection(serverId: string): MCPConnection | null {
    return this.connections.get(serverId) || null;
  }

  getConnections(): MCPConnection[] {
    return Array.from(this.connections.values());
  }

  async verifyConnection(serverId: string): Promise<boolean> {
    // Stub: In real impl, would make API call to verify token
    return this.connections.has(serverId);
  }

  async refreshToken(serverId: string): Promise<boolean> {
    // Stub: In real impl, would use refresh token to get new access token
    const conn = this.connections.get(serverId);
    if (!conn) return false;
    // Simulate refresh
    conn.connectedAt = new Date();
    this.saveConnections();
    return true;
  }

  private getOAuthUrl(serverId: string): string | null {
    const urls: Record<string, string> = {
      stripe: 'https://connect.stripe.com/oauth/authorize',
      github: 'https://github.com/login/oauth/authorize',
      vercel: 'https://vercel.com/oauth/authorize',
      supabase: 'https://supabase.com/dashboard/oauth',
      notion: 'https://api.notion.com/v1/oauth/authorize',
    };
    return urls[serverId] || null;
  }

  private loadConnections(): void {
    if (fs.existsSync(CONNECTIONS_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(CONNECTIONS_FILE, 'utf-8')) as SerializedMCPConnection[];
        for (const conn of data) {
          this.connections.set(conn.serverId, deserializeConnection(conn));
        }
      } catch {}
    }
  }

  private saveConnections(): void {
    const data = Array.from(this.connections.values()).map(serializeConnection);
    fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(data, null, 2));
  }
}

let instance: MCPManager | null = null;
export function getMCPManager(): MCPManager { if (!instance) instance = MCPManager.getInstance(); return instance; }
export function cleanupMCPManager(): void { instance = null; }
