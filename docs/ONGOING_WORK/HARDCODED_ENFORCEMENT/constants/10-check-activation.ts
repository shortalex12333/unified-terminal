// Source: HARDCODED-ENFORCEMENT-VALUES.md section 11

export const CHECK_ACTIVATION: Record<string, string[]> = {
  // ALWAYS after any EXECUTE step
  every_execute: ["file-existence"],

  // After EXECUTE step that modifies code
  code_modified: ["test-exit-code", "scope-enforcement"],

  // After EXECUTE step at Tier 2+
  tier_2_plus: ["file-non-empty", "scope-enforcement"],

  // After build step
  post_build: ["build-artifact"],

  // Before deploy
  pre_deploy: ["secret-detection", "docker-health"],

  // After deploy
  post_deploy: ["deploy-health"],

  // After frontend build
  frontend_build: ["responsive-screenshots"],

  // After cleanup/uninstall
  post_uninstall: ["uninstall-verify"],

  // After error resolution
  post_error_fix: ["lesson-template"],

  // CRON (independent, not triggered by steps)
  cron_30s: ["token-threshold"],
};

// Bodyguard dispatches ALL applicable checks in parallel (`Promise.allSettled`), NEVER sequential
export interface DAGStep {
  modifiedCodeFiles?: boolean;
  action?: string;
  isFrontend?: boolean;
}

export interface GateResult {
  passed: boolean;
  checks: Array<{ name: string; passed: boolean }>;
}

export async function gateCheck(step: DAGStep, tier: number): Promise<GateResult> {
  const applicableChecks: string[] = [];

  applicableChecks.push(...CHECK_ACTIVATION["every_execute"]);

  if (step.modifiedCodeFiles) applicableChecks.push(...CHECK_ACTIVATION["code_modified"]);
  if (tier >= 2) applicableChecks.push(...CHECK_ACTIVATION["tier_2_plus"]);
  if (step.action === "build") applicableChecks.push(...CHECK_ACTIVATION["post_build"]);
  if (step.action === "deploy") applicableChecks.push(...CHECK_ACTIVATION["pre_deploy"]);
  if (step.isFrontend) applicableChecks.push(...CHECK_ACTIVATION["frontend_build"]);

  // ALL in parallel. Never sequential.
  // Placeholder: return result would call runChecks(deduplicate(applicableChecks))
  return {
    passed: true,
    checks: applicableChecks.map((name) => ({ name, passed: true })),
  };
}
