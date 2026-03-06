// Source: Instance 4 - DAG execution

import * as fs from 'fs';
import * as path from 'path';

export interface DagStep {
  id: string;
  name: string;
  tierIndex: number;
  type: 'spawn' | 'service' | 'web';
  expectedOutputType: string;
  acceptanceCriteria: string;
  timeout: number;
  skills?: string[];
  dependencies?: string[];
  retryCount: number;
  allowSkip: boolean;
  metadata?: Record<string, unknown>;
}

export interface Dag {
  id: string;
  version: string;
  steps: DagStep[];
  createdAt: string;
  priority: 'low' | 'normal' | 'high';
  maxConcurrentSteps: number;
}

/**
 * Load and validate DAG from file
 *
 * @param filePath Path to DAG JSON file
 * @returns Parsed and validated DAG
 */
export function loadDAG(filePath: string): Dag {
  if (!fs.existsSync(filePath)) {
    throw new Error(`DAG file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const dag = JSON.parse(content) as Dag;

  // Validate required fields
  if (!dag.id) throw new Error('DAG missing id');
  if (!dag.steps || !Array.isArray(dag.steps)) throw new Error('DAG missing steps array');
  if (dag.steps.length === 0) throw new Error('DAG has no steps');

  // Validate each step
  dag.steps.forEach((step, idx) => {
    if (!step.id) throw new Error(`Step ${idx} missing id`);
    if (!step.name) throw new Error(`Step ${idx} missing name`);
    if (typeof step.tierIndex !== 'number') throw new Error(`Step ${idx} missing tierIndex`);
    if (!step.type) throw new Error(`Step ${idx} missing type`);
  });

  // Validate dependency graph (no cycles)
  validateNoCycles(dag.steps);

  return dag;
}

/**
 * Load DAG from JSON string
 *
 * @param jsonString JSON string containing DAG
 * @returns Parsed and validated DAG
 */
export function loadDAGFromString(jsonString: string): Dag {
  const dag = JSON.parse(jsonString) as Dag;

  // Same validation as loadDAG
  if (!dag.id) throw new Error('DAG missing id');
  if (!dag.steps || !Array.isArray(dag.steps)) throw new Error('DAG missing steps array');

  dag.steps.forEach((step, idx) => {
    if (!step.id) throw new Error(`Step ${idx} missing id`);
    if (!step.name) throw new Error(`Step ${idx} missing name`);
  });

  validateNoCycles(dag.steps);

  return dag;
}

/**
 * Validate DAG has no circular dependencies
 */
function validateNoCycles(steps: DagStep[]): void {
  const stepMap = new Map(steps.map(s => [s.id, s]));
  const visited = new Set<string>();
  const recStack = new Set<string>();

  function hasCycle(stepId: string): boolean {
    visited.add(stepId);
    recStack.add(stepId);

    const step = stepMap.get(stepId);
    if (!step) return false;

    if (step.dependencies) {
      for (const dep of step.dependencies) {
        if (!visited.has(dep)) {
          if (hasCycle(dep)) return true;
        } else if (recStack.has(dep)) {
          return true;
        }
      }
    }

    recStack.delete(stepId);
    return false;
  }

  for (const step of steps) {
    if (!visited.has(step.id) && hasCycle(step.id)) {
      throw new Error(`Circular dependency detected in DAG`);
    }
  }
}

/**
 * Sort DAG steps in execution order (topological sort)
 */
export function topologicalSort(steps: DagStep[]): DagStep[] {
  const stepMap = new Map(steps.map(s => [s.id, s]));
  const visited = new Set<string>();
  const result: DagStep[] = [];

  function visit(stepId: string): void {
    if (visited.has(stepId)) return;
    visited.add(stepId);

    const step = stepMap.get(stepId);
    if (!step) return;

    if (step.dependencies) {
      for (const dep of step.dependencies) {
        visit(dep);
      }
    }

    result.push(step);
  }

  for (const step of steps) {
    visit(step.id);
  }

  return result;
}

export default loadDAG;
