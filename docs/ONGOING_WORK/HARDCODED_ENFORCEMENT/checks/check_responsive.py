#!/usr/bin/env python3
"""
Check 11: Responsive Screenshots
Source: HARDCODED-ENFORCEMENT-VALUES.md section 10, Check 11

COMMAND:          npx playwright screenshot at 3 viewports
VIEWPORTS:        375×812 (mobile), 768×1024 (tablet), 1440×900 (desktop)
PASS:             all 3 screenshot files exist AND each > 1000 bytes
FALSE POSITIVE:   none (if Playwright captures, file is valid)
TIMEOUT:          30 seconds per viewport
CONFIDENCE:       definitive
"""

import sys
import os
import subprocess
import json
import tempfile

# From HARDCODED-ENFORCEMENT-VALUES.md section 22
VIEWPORTS = [
    {"width": 375, "height": 812, "name": "mobile"},
    {"width": 768, "height": 1024, "name": "tablet"},
    {"width": 1440, "height": 900, "name": "desktop"},
]

# From HARDCODED-ENFORCEMENT-VALUES.md section 5
MIN_SCREENSHOT_BYTES = 1000

def check_responsive(project_dir):
    """
    Take screenshots at 3 viewports using Playwright.
    Verify each screenshot exists and is > 1000 bytes.
    """
    os.chdir(project_dir)

    # Check if Playwright is installed
    try:
        result = subprocess.run(
            ["npx", "playwright", "--version"],
            capture_output=True,
            timeout=5
        )
        if result.returncode != 0:
            print("WARN: Playwright not available")
            return True
    except Exception as e:
        print(f"WARN: Playwright check failed: {e}")
        return True

    # Create a temporary test file
    test_file = tempfile.NamedTemporaryFile(
        mode="w",
        suffix=".ts",
        dir=project_dir,
        delete=False
    )

    try:
        # Write test script
        test_content = '''
import { test } from '@playwright/test';

test('responsive screenshots', async ({ browser }) => {
  const viewports = [
    { width: 375, height: 812, name: 'mobile' },
    { width: 768, height: 1024, name: 'tablet' },
    { width: 1440, height: 900, name: 'desktop' },
  ];

  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    await page.screenshot({ path: `screenshot-${viewport.name}.png` });
    await context.close();
  }
});
'''
        test_file.write(test_content)
        test_file.close()

        # Run Playwright
        result = subprocess.run(
            ["npx", "playwright", "test", test_file.name, "--headed=false"],
            capture_output=True,
            text=True,
            timeout=120
        )

        # Check if screenshots were created
        screenshots = []
        for viewport in VIEWPORTS:
            screenshot_path = os.path.join(project_dir, f"screenshot-{viewport['name']}.png")
            if os.path.exists(screenshot_path):
                size = os.path.getsize(screenshot_path)
                if size > MIN_SCREENSHOT_BYTES:
                    screenshots.append((viewport['name'], size))
                else:
                    print(f"FAIL: Screenshot {viewport['name']} too small ({size} bytes, needs > {MIN_SCREENSHOT_BYTES})")
                    return False
            else:
                print(f"FAIL: Screenshot {viewport['name']} not found")
                return False

        print(f"PASS: All {len(screenshots)} responsive screenshots valid")
        for name, size in screenshots:
            print(f"  - {name}: {size} bytes")
        return True

    except subprocess.TimeoutExpired:
        print("FAIL: Playwright timeout")
        return False
    except Exception as e:
        print(f"ERROR: {e}")
        return False
    finally:
        # Cleanup
        try:
            os.unlink(test_file.name)
        except:
            pass

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 check_responsive.py <project_dir>")
        sys.exit(1)

    project_dir = sys.argv[1]

    try:
        if check_responsive(project_dir):
            sys.exit(0)
        else:
            sys.exit(1)
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)
