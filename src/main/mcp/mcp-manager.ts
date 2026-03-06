import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { shell } from 'electron';
import { MCPServer, MCPConnection, MCP_SERVERS, serializeConnection, deserializeConnection, SerializedMCPConnection } from './types';

const KENOKI_DIR = path.join(os.homedir(), '.kenoki');
const CONNECTIONS_FILE = path.join(KENOKI_DIR, 'mcp-connections.json');

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export class MCPManager extends EventEmitter {
  private static instance: MCPManager | null = null;
  private connections: Map<string, MCPConnection> = new Map();

  private constructor() {
    super();
    ensureDir(KENOKI_DIR);
    this.loadConnections();
  }

  static getInstance(): MCPManager {
    if (!MCPManager.instance) MCPManager.instance = new MCPManager();
    return MCPManager.instance;
  }

  listServers(): MCPServer[] {
    return MCP_SERVERS.map(server => ({
      ...server,
      status: this.connections.has(server.id) ? 'connected' : 'disconnected'
    }));
  }

  async connect(serverId: string): Promise<boolean> {
    const server = MCP_SERVERS.find(s => s.id === serverId);
    if (!server) return false;

    this.emit('connecting', serverId);
    
    // Open OAuth URL in browser (simplified - real impl would handle callback)
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
    this.emit('connected', serverId);
    return true;
  }

  disconnect(serverId: string): boolean {
    if (this.connections.has(serverId)) {
      this.connections.delete(serverId);
      this.saveConnections();
      this.emit('disconnected', serverId);
      return true;
    }
    return false;
  }

  isConnected(serverId: string): boolean {
    return this.connections.has(serverId);
  }

  getConnection(serverId: string): MCPConnection | null {
    return this.connections.get(serverId) || null;
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
