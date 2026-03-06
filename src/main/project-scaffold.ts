import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Constants for Kenoki project directory locations
 */
export const KENOKI_HIDDEN = path.join(os.homedir(), '.kenoki_projects');
export const KENOKI_VISIBLE = path.join(os.homedir(), 'Documents', 'Kenoki');

/**
 * Interface for project paths returned by createProjectStructure
 */
export interface ProjectPaths {
  agentRoot: string;
  humanRoot: string;
  projectId: string;
  projectName: string;
}

/**
 * Sanitizes a project name for filesystem usage
 * Removes invalid characters and normalizes whitespace
 */
export function sanitizeProjectName(name: string): string {
  return name
    .trim()
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid filesystem characters
    .replace(/\s+/g, ' '); // Replace multiple spaces with single space
}

/**
 * Creates the dual-folder project structure for Kenoki
 * - Agent world: ~/.kenoki_projects/{projectId}/ (hidden, technical)
 * - Human world: ~/Documents/Kenoki/{projectName}/ (visible, user-friendly)
 *
 * @param projectId - Unique UUID for the project
 * @param projectName - User-provided project name
 * @returns ProjectPaths object with both root paths
 */
export function createProjectStructure(projectId: string, projectName: string): ProjectPaths {
  const sanitizedName = sanitizeProjectName(projectName);

  // Define root paths
  const agentRoot = path.join(KENOKI_HIDDEN, projectId);
  let humanRoot = path.join(KENOKI_VISIBLE, sanitizedName);

  try {
    // Create agent world structure
    const agentDirs = [
      agentRoot,
      path.join(agentRoot, 'status'),
      path.join(agentRoot, 'skills'),
      path.join(agentRoot, 'pa'),
      path.join(agentRoot, 'corrections'),
      path.join(agentRoot, 'handovers'),
    ];

    for (const dir of agentDirs) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Create initial JSON files with empty defaults
    const agentRegistry = {
      project_id: projectId,
      project_name: sanitizedName,
      created_at: new Date().toISOString(),
      roles: {},
      agents: {},
    };

    const activeMcps = {
      connected: [],
      required: [],
      missing: [],
    };

    const activeSkills = {
      active: [],
      available: [],
    };

    const activePlugins = {
      active: [],
      available: [],
    };

    // Write initial files
    fs.writeFileSync(
      path.join(agentRoot, 'agent_registry.json'),
      JSON.stringify(agentRegistry, null, 2)
    );

    fs.writeFileSync(
      path.join(agentRoot, 'spine_master.md'),
      `# Project: ${sanitizedName}\nID: ${projectId}\nCreated: ${new Date().toISOString()}\n\n`
    );

    fs.writeFileSync(
      path.join(agentRoot, 'project_brief.md'),
      ''
    );

    fs.writeFileSync(
      path.join(agentRoot, 'skills', 'active_mcps.json'),
      JSON.stringify(activeMcps, null, 2)
    );

    fs.writeFileSync(
      path.join(agentRoot, 'skills', 'active_skills.json'),
      JSON.stringify(activeSkills, null, 2)
    );

    fs.writeFileSync(
      path.join(agentRoot, 'skills', 'active_plugins.json'),
      JSON.stringify(activePlugins, null, 2)
    );

  } catch (error) {
    // Log error and attempt fallback to Desktop
    console.error('Error creating agent world structure:', error);

    const desktopFallback = path.join(os.homedir(), 'Desktop', 'Kenoki');
    humanRoot = path.join(desktopFallback, sanitizedName);

    console.log(`Falling back to Desktop: ${humanRoot}`);
  }

  try {
    // Create human world structure
    const humanDirs = [
      humanRoot,
      path.join(humanRoot, 'Files'),
    ];

    for (const dir of humanDirs) {
      fs.mkdirSync(dir, { recursive: true });
    }

  } catch (error) {
    console.error('Error creating human world structure:', error);

    // If Documents fails, try Desktop fallback
    if (!humanRoot.includes('Desktop')) {
      const desktopFallback = path.join(os.homedir(), 'Desktop', 'Kenoki', sanitizedName);

      try {
        fs.mkdirSync(desktopFallback, { recursive: true });
        fs.mkdirSync(path.join(desktopFallback, 'Files'), { recursive: true });
        humanRoot = desktopFallback;
        console.log(`Fallback successful: ${humanRoot}`);
      } catch (fallbackError) {
        console.error('Desktop fallback also failed:', fallbackError);
      }
    }
  }

  return {
    agentRoot,
    humanRoot,
    projectId,
    projectName: sanitizedName,
  };
}
