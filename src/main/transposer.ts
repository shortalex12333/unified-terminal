/**
 * Transposer: Technical-to-Human Translation Layer
 * Converts agent status, file names, and progress data to user-friendly messages
 */

/**
 * Translation Dictionaries
 */
export const ROLE_TO_HUMAN: Record<string, string> = {
  // Frontend
  'frontend_header': 'header',
  'frontend_nav': 'navigation',
  'frontend_hero': 'main banner',
  'frontend_footer': 'footer',
  'frontend_product_list': 'product listing',
  'frontend_cart': 'shopping cart',
  'frontend_checkout': 'checkout page',

  // Backend
  'backend_api': 'server',
  'backend_auth': 'login system',
  'backend_payments': 'payment processing',
  'backend_inventory': 'inventory system',
  'backend_orders': 'order management',

  // Database
  'database_schema': 'database structure',
  'database_migrations': 'database setup',

  // Deploy
  'deploy_vercel': 'deployment',
  'deploy_testing': 'testing',
};

export const PHASE_TO_HUMAN: Record<string, string> = {
  'Setup': 'Getting everything ready',
  'Scaffold': 'Setting up project structure',
  'Frontend': 'Building your storefront',
  'Backend': 'Setting up the server',
  'Database': 'Creating the database',
  'Auth': 'Adding login system',
  'Payments': 'Connecting payments',
  'Inventory': 'Setting up inventory',
  'Orders': 'Adding order management',
  'Testing': 'Making sure everything works',
  'Deploy': 'Putting it online',
  'Complete': 'Finishing touches',
};

export const STATUS_TO_HUMAN: Record<string, string> = {
  'GREEN': 'Working',
  'AMBER': 'Almost done',
  'RED': 'Finished',
  'KILLED': 'Stopped',
  'ERROR': 'Had an issue',
};

export const MCP_TO_HUMAN: Record<string, string> = {
  'stripe': 'Stripe (Payments)',
  'supabase': 'Supabase (Database)',
  'shopify': 'Shopify',
  'vercel': 'Vercel (Hosting)',
  'github': 'GitHub',
  'figma': 'Figma (Design)',
};

export const PROJECT_TYPE_TO_HUMAN: Record<string, string> = {
  'ecom': 'online store',
  'site': 'website',
  'app': 'web application',
  'saas': 'software service',
  'portfolio': 'portfolio',
  'blog': 'blog',
  'landing': 'landing page',
};

/**
 * Type Definitions
 */
export interface AgentStatus {
  session_id: string;
  role: string;
  domain: string;
  status: 'GREEN' | 'AMBER' | 'RED' | 'KILLED' | 'ERROR';
  tokens?: {
    current: number;
    threshold: number;
    percentage: number;
  };
  current_task?: string;
}

export interface ProgressUpdate {
  type: 'progress' | 'transition' | 'file:created';
  message: string;
  data?: Record<string, unknown>;
}

export interface ProgressNode {
  name: string;
  status: 'done' | 'active' | 'pending';
}

export interface ProgressTree {
  phases: ProgressNode[];
  percentage: number;
}

/**
 * Translation Functions
 */

/**
 * Translates agent status to human-readable progress update
 */
export function translateStatus(status: AgentStatus): ProgressUpdate {
  const roleFriendly = ROLE_TO_HUMAN[status.role] || status.role;
  const statusFriendly = STATUS_TO_HUMAN[status.status] || status.status;

  let message: string;
  let type: 'progress' | 'transition' = 'progress';

  switch (status.status) {
    case 'GREEN':
      message = `Working on ${roleFriendly}...`;
      if (status.current_task) {
        message = status.current_task;
      }
      break;

    case 'AMBER':
      message = `Almost done with ${roleFriendly}`;
      if (status.tokens) {
        message += ` (${status.tokens.percentage}% complete)`;
      }
      break;

    case 'RED':
      message = `Finished ${roleFriendly}`;
      type = 'transition';
      break;

    case 'KILLED':
      message = `Stopped working on ${roleFriendly}`;
      type = 'transition';
      break;

    case 'ERROR':
      message = `Had an issue with ${roleFriendly}`;
      break;

    default:
      message = `${statusFriendly}: ${roleFriendly}`;
  }

  return {
    type,
    message,
    data: {
      session_id: status.session_id,
      role: status.role,
      domain: status.domain,
    },
  };
}

/**
 * Parses spine markdown content and returns a progress tree
 * Expects format: ## Phase N: Name [STATUS]
 */
export function translateSpine(spineContent: string): ProgressTree {
  const phases: ProgressNode[] = [];
  const lines = spineContent.split('\n');

  // Regex to match: ## Phase 1: Setup [COMPLETE]
  const phaseRegex = /^##\s+Phase\s+\d+:\s+([^\[]+)\[([^\]]+)\]/i;

  for (const line of lines) {
    const match = line.match(phaseRegex);
    if (match) {
      const name = match[1].trim();
      const statusRaw = match[2].trim();

      let status: 'done' | 'active' | 'pending';

      if (statusRaw === 'COMPLETE') {
        status = 'done';
      } else if (statusRaw === 'IN_PROGRESS' || statusRaw === 'ACTIVE') {
        status = 'active';
      } else {
        status = 'pending';
      }

      phases.push({ name, status });
    }
  }

  // Calculate percentage
  const completedCount = phases.filter((p) => p.status === 'done').length;
  const totalCount = phases.length;
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return {
    phases,
    percentage,
  };
}

/**
 * Converts a technical file name to a friendly display name
 * Examples:
 * - "Header.tsx" → "Header"
 * - "hero-image.png" → "Hero Image"
 * - "api-routes.ts" → "Api Routes"
 */
export function friendlyFileName(filePath: string): string {
  const fileName = filePath.split('/').pop() || filePath;
  const nameWithoutExtension = fileName.replace(/\.[^.]+$/, '');

  // Convert kebab-case or snake_case to Title Case
  return nameWithoutExtension
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Generates a user-friendly Read Me file for completed projects
 */
export function generateReadMe(
  project: {
    name: string;
    typeFriendly: string;
    deployedUrl?: string;
  },
  user: {
    firstName: string;
  }
): string {
  const { name, typeFriendly, deployedUrl } = project;
  const { firstName } = user;

  let content = `# Welcome to Your ${typeFriendly}, ${firstName}!\n\n`;

  content += `Your **${name}** is complete and ready to use.\n\n`;

  content += `## What You Got\n\n`;
  content += `This folder contains all the files that make up your ${typeFriendly}. `;
  content += `Everything has been built, tested, and is ready to go.\n\n`;

  if (deployedUrl) {
    content += `## Your Live Link\n\n`;
    content += `🌐 **[Open Your ${typeFriendly}](${deployedUrl})**\n\n`;
    content += `Share this link with anyone you'd like!\n\n`;
  }

  content += `## Files Folder\n\n`;
  content += `The **Files** folder contains all your project files. `;
  content += `You can open any of them to see how things work, or make changes if you'd like.\n\n`;

  content += `---\n\n`;
  content += `Built with care by Kenoki\n`;

  return content;
}
