// Source: HARDCODED-ENFORCEMENT-VALUES.md section 9

export interface RetryPolicy {
  attempts: number;
  delayMs: number;
  confidence: "definitive" | "heuristic";
}

export const ENFORCER_RETRY_POLICIES: Record<string, RetryPolicy> = {
  "test-exit-code": { attempts: 1, delayMs: 0, confidence: "definitive" },
  "file-existence": { attempts: 1, delayMs: 0, confidence: "definitive" },
  "file-non-empty": { attempts: 1, delayMs: 0, confidence: "heuristic" }, // 50-byte threshold is arbitrary
  "build-artifact": { attempts: 1, delayMs: 0, confidence: "definitive" },
  "scope-enforcement": { attempts: 1, delayMs: 0, confidence: "definitive" },
  "token-threshold": { attempts: 1, delayMs: 0, confidence: "definitive" }, // token counts are exact
  "secret-detection": { attempts: 1, delayMs: 0, confidence: "definitive" },
  "uninstall-verify": { attempts: 1, delayMs: 0, confidence: "definitive" },
  "docker-health": { attempts: 3, delayMs: 5_000, confidence: "heuristic" }, // container warming
  "lesson-template": { attempts: 1, delayMs: 0, confidence: "definitive" },
  "responsive-screenshots": { attempts: 1, delayMs: 0, confidence: "definitive" },
  "deploy-health": { attempts: 3, delayMs: 10_000, confidence: "heuristic" }, // DNS propagation
};
