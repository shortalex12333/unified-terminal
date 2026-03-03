#!/usr/bin/env python3
import os
import re
import time
import json
import csv
import sys
import urllib.request
import urllib.error

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CATALOG_JSON = os.path.join(ROOT, 'docs', 'research', 'plugins', 'catalog.json')
CATALOG_CSV  = os.path.join(ROOT, 'docs', 'research', 'plugins', 'catalog.csv')

GH_RE = re.compile(r"^https?://github\.com/([^/]+)/([^/#?]+)(?:[/#?].*)?$", re.IGNORECASE)

TOKEN = os.environ.get('GITHUB_TOKEN') or os.environ.get('GH_TOKEN')

def gh_get(url: str):
    req = urllib.request.Request(url)
    req.add_header('User-Agent', 'unified-terminal-research/1.0')
    if TOKEN:
        req.add_header('Authorization', f'Bearer {TOKEN}')
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode('utf-8'))

def normalize_repo_url(url: str):
    m = GH_RE.match(url or '')
    if not m:
        return None
    owner, repo = m.group(1), m.group(2)
    if repo.endswith('.git'):
        repo = repo[:-4]
    return owner, repo

def update_entries(entries, skip=0, limit=None):
    updated = 0
    errors = 0
    processed = 0
    for idx, e in enumerate(entries):
        if idx < skip:
            continue
        if limit is not None and processed >= limit:
            break
        repo_url = e.get('repo_url') or ''
        parsed = normalize_repo_url(repo_url)
        if not parsed:
            continue
        owner, repo = parsed
        api_url = f'https://api.github.com/repos/{owner}/{repo}'
        try:
            data = gh_get(api_url)
            e['stars'] = str(data.get('stargazers_count', '0'))
            e['last_commit'] = data.get('pushed_at') or data.get('updated_at') or 'unknown'
            e['latest_release'] = 'unknown'
            updated += 1
        except urllib.error.HTTPError as ex:
            if ex.code == 403:
                reset = ex.headers.get('X-RateLimit-Reset')
                if reset and reset.isdigit():
                    wait_s = max(0, int(reset) - int(time.time()) + 1)
                    print(f"Rate limited. Sleeping {wait_s}s...", file=sys.stderr)
                    time.sleep(wait_s)
                    try:
                        data = gh_get(api_url)
                        e['stars'] = str(data.get('stargazers_count', '0'))
                        e['last_commit'] = data.get('pushed_at') or data.get('updated_at') or 'unknown'
                        e['latest_release'] = 'unknown'
                        updated += 1
                        continue
                    except Exception:
                        errors += 1
                        continue
            errors += 1
        except Exception:
            errors += 1
        time.sleep(0.6 if TOKEN else 1.2)
        processed += 1
    return updated, errors

def write_csv(entries):
    fields = [
        'name','category','repo_url','license','stars','last_commit','latest_release',
        'maturity_score','reliability_score','integration_cost','efficiency_notes','model_fit','mcp',
        'use_cases','limitations','conflicts','references'
    ]
    with open(CATALOG_CSV, 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for e in entries:
            w.writerow({k: e.get(k, '') for k in fields})

def main():
    if not os.path.exists(CATALOG_JSON):
        print(f"Missing catalog: {CATALOG_JSON}", file=sys.stderr)
        sys.exit(2)
    with open(CATALOG_JSON, 'r') as f:
        entries = json.load(f)
    # parse optional args: --skip N, --limit N
    skip = 0
    limit = None
    argv = sys.argv[1:]
    for i in range(len(argv)):
        if argv[i] == '--skip' and i+1 < len(argv):
            try:
                skip = int(argv[i+1])
            except ValueError:
                pass
        if argv[i] == '--limit' and i+1 < len(argv):
            try:
                limit = int(argv[i+1])
            except ValueError:
                pass
    updated, errors = update_entries(entries, skip=skip, limit=limit)
    with open(CATALOG_JSON, 'w') as f:
        json.dump(entries, f, indent=2)
    write_csv(entries)
    print(f"Updated {updated} entries; errors: {errors}")

if __name__ == '__main__':
    main()
