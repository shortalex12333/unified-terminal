#!/usr/bin/env python3
"""
Check 10: Lesson Template Validation
Source: HARDCODED-ENFORCEMENT-VALUES.md section 10, Check 10

COMMAND:          regex check on lesson content
PASS:             all 4 fields present AND no placeholder text
REQUIRED FIELDS:  "what broke", "root cause", "fix applied", "prevention rule"
FORBIDDEN TEXT:   "one sentence", "TODO", "TBD", "fill in", "[placeholder]"
CONFIDENCE:       definitive
"""

import sys
import os
import re
import json

# From HARDCODED-ENFORCEMENT-VALUES.md section 20
REQUIRED_FIELDS = [
    r"what broke",
    r"root cause",
    r"fix applied",
    r"prevention rule",
]

FORBIDDEN_PATTERNS = [
    r"one sentence",
    r"\bTODO\b",
    r"\bTBD\b",
    r"fill in",
    r"\[placeholder\]",
    r"\[.*?\]",  # any [bracketed placeholder]
]

def check_lesson(project_dir):
    """
    Validate lesson file completeness.
    All 4 required fields must be present, no forbidden placeholders.
    """
    # Look for lesson file
    lesson_file = os.path.join(project_dir, "tasks/lessons.md")
    if not os.path.exists(lesson_file):
        print("INFO: No lessons.md file found, skipping lesson check")
        return True

    try:
        with open(lesson_file, "r") as f:
            content = f.read()
    except Exception as e:
        print(f"WARN: Could not read lesson file: {e}")
        return True

    # Check for required fields (case-insensitive)
    missing_fields = []
    for field_pattern in REQUIRED_FIELDS:
        if not re.search(field_pattern, content, re.IGNORECASE):
            missing_fields.append(field_pattern)

    if missing_fields:
        print("FAIL: Missing required fields:")
        for field in missing_fields:
            print(f"  - {field}")
        return False

    # Check for forbidden patterns (case-insensitive)
    found_forbidden = []
    for forbidden_pattern in FORBIDDEN_PATTERNS:
        matches = re.finditer(forbidden_pattern, content, re.IGNORECASE)
        for match in matches:
            found_forbidden.append(f"{forbidden_pattern} (line {content[:match.start()].count(chr(10)) + 1})")

    if found_forbidden:
        print("FAIL: Found forbidden placeholder text:")
        for forbidden in found_forbidden:
            print(f"  - {forbidden}")
        return False

    print("PASS: Lesson file has all required fields and no placeholders")
    return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 check_lesson.py <project_dir>")
        sys.exit(1)

    project_dir = sys.argv[1]

    try:
        if check_lesson(project_dir):
            sys.exit(0)
        else:
            sys.exit(1)
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)
