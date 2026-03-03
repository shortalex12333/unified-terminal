/**
 * Plugin Registry - Central registry for plugin configurations
 *
 * Gate 10: GSD + Plugin Orchestration
 *
 * Manages registration, lookup, and discovery of plugins.
 * Supports querying by name, capability, or trigger keyword.
 */

import {
  PluginConfig,
  validatePluginConfig,
  isValidPluginConfig,
} from './plugin-schema';

// ============================================================================
// PLUGIN REGISTRY CLASS
// ============================================================================

/**
 * Central registry for plugin configurations.
 * Provides methods to register, lookup, and query plugins.
 */
export class PluginRegistry {
  /** Map of plugin configs by name */
  private plugins: Map<string, PluginConfig> = new Map();

  /** Index of plugins by capability */
  private capabilityIndex: Map<string, Set<string>> = new Map();

  /** Index of plugins by trigger keyword */
  private triggerIndex: Map<string, Set<string>> = new Map();

  // ==========================================================================
  // REGISTRATION
  // ==========================================================================

  /**
   * Register a plugin configuration.
   * @param config - Plugin configuration to register
   * @throws Error if config is invalid or plugin already registered
   */
  register(config: PluginConfig): void {
    // Validate config
    const errors = validatePluginConfig(config);
    if (errors.length > 0) {
      throw new Error(`Invalid plugin config for "${config.name}": ${errors.join(', ')}`);
    }

    // Check for duplicates
    if (this.plugins.has(config.name)) {
      throw new Error(`Plugin "${config.name}" is already registered`);
    }

    // Store config
    this.plugins.set(config.name, config);

    // Index by capabilities
    for (const capability of config.capabilities) {
      if (!this.capabilityIndex.has(capability)) {
        this.capabilityIndex.set(capability, new Set());
      }
      this.capabilityIndex.get(capability)!.add(config.name);
    }

    // Index by triggers
    for (const trigger of config.triggers) {
      const normalizedTrigger = trigger.toLowerCase();
      if (!this.triggerIndex.has(normalizedTrigger)) {
        this.triggerIndex.set(normalizedTrigger, new Set());
      }
      this.triggerIndex.get(normalizedTrigger)!.add(config.name);
    }

    console.log(`[PluginRegistry] Registered plugin: ${config.name} v${config.version}`);
  }

  /**
   * Register multiple plugins at once.
   * @param configs - Array of plugin configurations
   */
  registerAll(configs: PluginConfig[]): void {
    for (const config of configs) {
      this.register(config);
    }
  }

  /**
   * Unregister a plugin by name.
   * @param name - Plugin name to unregister
   * @returns True if plugin was unregistered, false if not found
   */
  unregister(name: string): boolean {
    const config = this.plugins.get(name);
    if (!config) {
      return false;
    }

    // Remove from capability index
    for (const capability of config.capabilities) {
      const capabilitySet = this.capabilityIndex.get(capability);
      if (capabilitySet) {
        capabilitySet.delete(name);
        if (capabilitySet.size === 0) {
          this.capabilityIndex.delete(capability);
        }
      }
    }

    // Remove from trigger index
    for (const trigger of config.triggers) {
      const triggerSet = this.triggerIndex.get(trigger.toLowerCase());
      if (triggerSet) {
        triggerSet.delete(name);
        if (triggerSet.size === 0) {
          this.triggerIndex.delete(trigger.toLowerCase());
        }
      }
    }

    // Remove from main map
    this.plugins.delete(name);

    console.log(`[PluginRegistry] Unregistered plugin: ${name}`);
    return true;
  }

  // ==========================================================================
  // LOOKUP
  // ==========================================================================

  /**
   * Get a plugin configuration by name.
   * @param name - Plugin name
   * @returns Plugin config or null if not found
   */
  get(name: string): PluginConfig | null {
    return this.plugins.get(name) ?? null;
  }

  /**
   * Check if a plugin is registered.
   * @param name - Plugin name
   * @returns True if plugin is registered
   */
  has(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * Get all registered plugins.
   * @returns Array of all plugin configs
   */
  getAll(): PluginConfig[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get all plugin names.
   * @returns Array of plugin names
   */
  getNames(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * Get count of registered plugins.
   * @returns Number of registered plugins
   */
  get count(): number {
    return this.plugins.size;
  }

  // ==========================================================================
  // CAPABILITY-BASED LOOKUP
  // ==========================================================================

  /**
   * Get all plugins that have a specific capability.
   * @param capability - Capability to search for
   * @returns Array of matching plugin configs
   */
  getByCapability(capability: string): PluginConfig[] {
    const pluginNames = this.capabilityIndex.get(capability);
    if (!pluginNames) {
      return [];
    }

    return Array.from(pluginNames)
      .map((name) => this.plugins.get(name))
      .filter((config): config is PluginConfig => config !== undefined);
  }

  /**
   * Get all plugins that have ANY of the specified capabilities.
   * @param capabilities - Array of capabilities
   * @returns Array of matching plugin configs (deduplicated)
   */
  getByAnyCapability(capabilities: string[]): PluginConfig[] {
    const matchingNames = new Set<string>();

    for (const capability of capabilities) {
      const names = this.capabilityIndex.get(capability);
      if (names) {
        names.forEach((name) => matchingNames.add(name));
      }
    }

    return Array.from(matchingNames)
      .map((name) => this.plugins.get(name))
      .filter((config): config is PluginConfig => config !== undefined);
  }

  /**
   * Get all plugins that have ALL of the specified capabilities.
   * @param capabilities - Array of capabilities
   * @returns Array of matching plugin configs
   */
  getByAllCapabilities(capabilities: string[]): PluginConfig[] {
    if (capabilities.length === 0) {
      return [];
    }

    // Start with plugins that have the first capability
    const firstCapabilityNames = this.capabilityIndex.get(capabilities[0]);
    if (!firstCapabilityNames) {
      return [];
    }

    // Filter to only those that have all capabilities
    const matchingNames = Array.from(firstCapabilityNames).filter((name) => {
      const config = this.plugins.get(name);
      if (!config) return false;

      return capabilities.every((cap) => config.capabilities.includes(cap));
    });

    return matchingNames
      .map((name) => this.plugins.get(name))
      .filter((config): config is PluginConfig => config !== undefined);
  }

  // ==========================================================================
  // TRIGGER-BASED LOOKUP
  // ==========================================================================

  /**
   * Get all plugins that match a trigger keyword.
   * @param keyword - Keyword to search for (case-insensitive)
   * @returns Array of matching plugin configs
   */
  getByTrigger(keyword: string): PluginConfig[] {
    const normalizedKeyword = keyword.toLowerCase();
    const pluginNames = this.triggerIndex.get(normalizedKeyword);

    if (!pluginNames) {
      return [];
    }

    return Array.from(pluginNames)
      .map((name) => this.plugins.get(name))
      .filter((config): config is PluginConfig => config !== undefined);
  }

  /**
   * Find plugins that match ANY word in the given text.
   * Useful for intelligent routing based on user input.
   * @param text - Text to search for trigger keywords in
   * @returns Array of matching plugin configs with match count
   */
  findByText(text: string): Array<{ config: PluginConfig; matches: number }> {
    const words = text.toLowerCase().split(/\s+/);
    const matchCounts = new Map<string, number>();

    for (const word of words) {
      const pluginNames = this.triggerIndex.get(word);
      if (pluginNames) {
        for (const name of pluginNames) {
          matchCounts.set(name, (matchCounts.get(name) ?? 0) + 1);
        }
      }
    }

    // Convert to results sorted by match count
    return Array.from(matchCounts.entries())
      .map(([name, matches]) => ({
        config: this.plugins.get(name)!,
        matches,
      }))
      .filter(({ config }) => config !== undefined)
      .sort((a, b) => b.matches - a.matches);
  }

  // ==========================================================================
  // DEPENDENCY RESOLUTION
  // ==========================================================================

  /**
   * Get all dependencies for a plugin (recursive).
   * @param name - Plugin name
   * @returns Array of dependency plugin names in resolution order
   * @throws Error if circular dependency or missing dependency detected
   */
  resolveDependencies(name: string): string[] {
    const visited = new Set<string>();
    const resolved: string[] = [];

    const resolve = (pluginName: string, chain: string[]): void => {
      if (chain.includes(pluginName)) {
        throw new Error(
          `Circular dependency detected: ${[...chain, pluginName].join(' -> ')}`
        );
      }

      if (visited.has(pluginName)) {
        return;
      }

      const config = this.plugins.get(pluginName);
      if (!config) {
        throw new Error(`Missing dependency: ${pluginName}`);
      }

      for (const dep of config.dependencies) {
        resolve(dep, [...chain, pluginName]);
      }

      visited.add(pluginName);
      if (pluginName !== name) {
        resolved.push(pluginName);
      }
    };

    resolve(name, []);
    return resolved;
  }

  /**
   * Check if all dependencies for a plugin are satisfied.
   * @param name - Plugin name
   * @returns Object with result and any missing dependencies
   */
  checkDependencies(name: string): { satisfied: boolean; missing: string[] } {
    const config = this.plugins.get(name);
    if (!config) {
      return { satisfied: false, missing: [name] };
    }

    const missing: string[] = [];

    const check = (pluginName: string, visited: Set<string>): void => {
      if (visited.has(pluginName)) return;
      visited.add(pluginName);

      const cfg = this.plugins.get(pluginName);
      if (!cfg) {
        missing.push(pluginName);
        return;
      }

      for (const dep of cfg.dependencies) {
        check(dep, visited);
      }
    };

    check(name, new Set());

    return {
      satisfied: missing.length === 0,
      missing,
    };
  }

  // ==========================================================================
  // UTILITY
  // ==========================================================================

  /**
   * Clear all registered plugins.
   */
  clear(): void {
    this.plugins.clear();
    this.capabilityIndex.clear();
    this.triggerIndex.clear();
    console.log('[PluginRegistry] Cleared all plugins');
  }

  /**
   * Get all unique capabilities across all plugins.
   * @returns Array of capability names
   */
  getAllCapabilities(): string[] {
    return Array.from(this.capabilityIndex.keys());
  }

  /**
   * Get all unique triggers across all plugins.
   * @returns Array of trigger keywords
   */
  getAllTriggers(): string[] {
    return Array.from(this.triggerIndex.keys());
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/** Singleton plugin registry instance */
let registryInstance: PluginRegistry | null = null;

/**
 * Get the singleton plugin registry instance.
 */
export function getPluginRegistry(): PluginRegistry {
  if (!registryInstance) {
    registryInstance = new PluginRegistry();
  }
  return registryInstance;
}

/**
 * Reset the plugin registry (mainly for testing).
 */
export function resetPluginRegistry(): void {
  if (registryInstance) {
    registryInstance.clear();
  }
  registryInstance = null;
}
