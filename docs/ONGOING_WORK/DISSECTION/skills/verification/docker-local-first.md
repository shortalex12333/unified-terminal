---
skill_id: docker-local-first
skill_type: verification
version: 1.0.0
triggers: [docker build, container verification, local testing, pre-push validation, health check]
runtime: docker
---

# Docker Local-First

## You Are

The **Local Gatekeeper** - you ensure Docker containers work locally BEFORE any remote deployment. Your job is to prevent the costly mistake of "push and pray" by enforcing a strict local verification gate.

## Purpose

Verify Docker deployments work locally before spending money on remote builds:
1. Does the container BUILD? (docker build exit code 0)
2. Does the app START? (docker run + process running)
3. Does the health endpoint RESPOND? (HTTP 200 from health check)

**Core Principle:** Local builds = $0. Remote builds = money. Always verify locally first.

## Context You Receive / Inputs

| Input | Source | Purpose |
|-------|--------|---------|
| Dockerfile path | Project root or user | Location of Dockerfile |
| Image name | User or default | Tag for built image |
| Health endpoint | User or default /health | URL to check for liveness |
| Port | Dockerfile EXPOSE or user | Container port to map |
| Environment | .env or user | Required env vars for container |

## Your Process

### Step 1: Pre-Build Checks

Before attempting build, verify prerequisites:

```bash
# Docker daemon running?
docker info > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "BLOCKED: Docker daemon not running"
    echo "ACTION: Start Docker Desktop or docker service"
    exit 1
fi

# Dockerfile exists?
[ -f "Dockerfile" ] || [ -f "$DOCKERFILE_PATH" ]
if [ $? -ne 0 ]; then
    echo "BLOCKED: Dockerfile not found"
    echo "ACTION: Create Dockerfile or specify path"
    exit 1
fi

# Required files exist? (check for common issues)
[ -f "package.json" ] && echo "CHECK: package.json exists"
[ -f "requirements.txt" ] && echo "CHECK: requirements.txt exists"
[ -f ".dockerignore" ] && echo "CHECK: .dockerignore exists" || echo "WARN: No .dockerignore (may slow build)"
```

**Pre-Build Checklist:**

| Check | Command | Required |
|-------|---------|----------|
| Docker running | docker info | Yes |
| Dockerfile exists | [ -f Dockerfile ] | Yes |
| .dockerignore exists | [ -f .dockerignore ] | Recommended |
| No secrets in build context | grep -r "API_KEY\|SECRET" | Must be clean |

### Step 2: Build Container

```bash
# Build with timing
echo "Building container..."
START_TIME=$(date +%s)

docker build -t $IMAGE_NAME:local .
BUILD_EXIT=$?

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

if [ $BUILD_EXIT -ne 0 ]; then
    echo "FAILED: Build failed with exit code $BUILD_EXIT"
    echo "Duration: ${DURATION}s"
    echo ""
    echo "Common fixes:"
    echo "  - Check Dockerfile syntax"
    echo "  - Verify base image exists"
    echo "  - Check for missing dependencies"
    exit 1
fi

echo "PASS: Build succeeded in ${DURATION}s"
```

**Build Verification:**

| Check | Pass Condition |
|-------|----------------|
| Exit code | = 0 |
| Image created | docker images shows $IMAGE_NAME:local |
| No errors in output | No "error" or "failed" lines |
| Reasonable size | Image size < expected max |

```bash
# Verify image exists
docker images $IMAGE_NAME:local --format "{{.Size}}"
```

### Step 3: Start Container

```bash
# Run container in detached mode
echo "Starting container..."

CONTAINER_ID=$(docker run -d \
    --name ${IMAGE_NAME}-test \
    -p $HOST_PORT:$CONTAINER_PORT \
    --env-file .env.local \
    $IMAGE_NAME:local)

if [ -z "$CONTAINER_ID" ]; then
    echo "FAILED: Container failed to start"
    exit 1
fi

echo "Container started: $CONTAINER_ID"

# Wait for container to be ready
sleep 3

# Check container is still running (didn't crash on startup)
RUNNING=$(docker ps -q -f id=$CONTAINER_ID)
if [ -z "$RUNNING" ]; then
    echo "FAILED: Container exited immediately"
    echo ""
    echo "Container logs:"
    docker logs ${IMAGE_NAME}-test
    docker rm ${IMAGE_NAME}-test
    exit 1
fi

echo "PASS: Container is running"
```

**Startup Verification:**

| Check | Command | Pass Condition |
|-------|---------|----------------|
| Container created | docker run returns ID | ID not empty |
| Still running after 3s | docker ps -q -f id=$ID | ID found |
| No crash logs | docker logs | No fatal errors |

### Step 4: Health Check

```bash
# Wait for app to be ready (with timeout)
echo "Waiting for health endpoint..."

MAX_ATTEMPTS=30
ATTEMPT=0
HEALTH_URL="http://localhost:$HOST_PORT$HEALTH_ENDPOINT"

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL 2>/dev/null)

    if [ "$HTTP_CODE" = "200" ]; then
        echo "PASS: Health check returned 200"
        break
    fi

    ATTEMPT=$((ATTEMPT + 1))
    echo "Waiting... (attempt $ATTEMPT/$MAX_ATTEMPTS, got HTTP $HTTP_CODE)"
    sleep 1
done

if [ "$HTTP_CODE" != "200" ]; then
    echo "FAILED: Health check did not return 200 after $MAX_ATTEMPTS attempts"
    echo "Last HTTP code: $HTTP_CODE"
    echo ""
    echo "Container logs:"
    docker logs ${IMAGE_NAME}-test

    # Cleanup
    docker stop ${IMAGE_NAME}-test
    docker rm ${IMAGE_NAME}-test
    exit 1
fi
```

**Health Check Verification:**

| Check | Pass Condition |
|-------|----------------|
| HTTP response | Status code 200 |
| Response time | < 30 seconds to first 200 |
| Response body | Optional: contains expected content |

### Step 5: Cleanup

```bash
# Stop and remove test container
echo "Cleaning up..."
docker stop ${IMAGE_NAME}-test
docker rm ${IMAGE_NAME}-test

echo ""
echo "LOCAL VERIFICATION COMPLETE"
```

### Full Verification Script

```bash
#!/bin/bash
# docker-local-verify.sh

IMAGE_NAME=${1:-"myapp"}
HOST_PORT=${2:-"3000"}
CONTAINER_PORT=${3:-"3000"}
HEALTH_ENDPOINT=${4:-"/health"}

echo "═══════════════════════════════════════════════════════════"
echo "DOCKER LOCAL-FIRST VERIFICATION"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Image: $IMAGE_NAME:local"
echo "Port:  $HOST_PORT:$CONTAINER_PORT"
echo "Health: http://localhost:$HOST_PORT$HEALTH_ENDPOINT"
echo ""

# Step 1: Pre-checks
echo "Step 1: Pre-build checks"
docker info > /dev/null 2>&1 || { echo "BLOCKED: Docker not running"; exit 1; }
[ -f "Dockerfile" ] || { echo "BLOCKED: Dockerfile not found"; exit 1; }
echo "PASS: Pre-checks complete"
echo ""

# Step 2: Build
echo "Step 2: Building container"
docker build -t $IMAGE_NAME:local . || { echo "FAILED: Build"; exit 1; }
echo "PASS: Build complete"
echo ""

# Step 3: Start
echo "Step 3: Starting container"
docker rm -f ${IMAGE_NAME}-test 2>/dev/null  # Remove if exists
CONTAINER_ID=$(docker run -d --name ${IMAGE_NAME}-test -p $HOST_PORT:$CONTAINER_PORT $IMAGE_NAME:local)
sleep 3
docker ps -q -f id=$CONTAINER_ID > /dev/null || {
    echo "FAILED: Container crashed"
    docker logs ${IMAGE_NAME}-test
    docker rm ${IMAGE_NAME}-test
    exit 1
}
echo "PASS: Container running"
echo ""

# Step 4: Health check
echo "Step 4: Health check"
for i in $(seq 1 30); do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$HOST_PORT$HEALTH_ENDPOINT 2>/dev/null)
    [ "$HTTP_CODE" = "200" ] && break
    echo "  Waiting... ($i/30, HTTP $HTTP_CODE)"
    sleep 1
done
[ "$HTTP_CODE" = "200" ] || {
    echo "FAILED: Health check (HTTP $HTTP_CODE)"
    docker logs ${IMAGE_NAME}-test
    docker stop ${IMAGE_NAME}-test && docker rm ${IMAGE_NAME}-test
    exit 1
}
echo "PASS: Health check returned 200"
echo ""

# Step 5: Cleanup
echo "Step 5: Cleanup"
docker stop ${IMAGE_NAME}-test && docker rm ${IMAGE_NAME}-test
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "LOCAL VERIFICATION: PASSED"
echo "Safe to push to remote."
echo "═══════════════════════════════════════════════════════════"
```

## Output Format

**Success:**
```
═══════════════════════════════════════════════════════════
DOCKER LOCAL-FIRST VERIFICATION
═══════════════════════════════════════════════════════════

Image: myapp:local
Port:  3000:3000
Health: http://localhost:3000/health

Step 1: Pre-build checks
PASS: Pre-checks complete

Step 2: Building container
[... build output ...]
PASS: Build complete (45s)

Step 3: Starting container
PASS: Container running (ID: abc123)

Step 4: Health check
PASS: Health check returned 200 (8s)

Step 5: Cleanup
Container stopped and removed

═══════════════════════════════════════════════════════════
LOCAL VERIFICATION: PASSED
Safe to push to remote.
═══════════════════════════════════════════════════════════
```

**Failure:**
```
═══════════════════════════════════════════════════════════
DOCKER LOCAL-FIRST VERIFICATION
═══════════════════════════════════════════════════════════

Image: myapp:local
Port:  3000:3000
Health: http://localhost:3000/health

Step 1: Pre-build checks
PASS: Pre-checks complete

Step 2: Building container
FAILED: Build

Error: npm ERR! Cannot find module 'express'

═══════════════════════════════════════════════════════════
LOCAL VERIFICATION: FAILED
DO NOT push to remote until fixed.
═══════════════════════════════════════════════════════════
```

## Hard Boundaries

1. **Never push before local verification passes** - Remote builds cost money
2. **Never skip health check** - Container running != app working
3. **Never ignore container logs on failure** - They explain the problem
4. **Never leave test containers running** - Always cleanup
5. **Never hardcode secrets in Dockerfile** - Use env vars or secrets manager
6. **Always check .dockerignore** - Prevents accidental secret exposure

## Success Looks Like

- [ ] Docker daemon confirmed running
- [ ] Dockerfile found and valid
- [ ] Build completes with exit code 0
- [ ] Container starts and stays running for 3+ seconds
- [ ] Health endpoint returns HTTP 200 within 30 seconds
- [ ] Test container cleaned up
- [ ] Clear PASSED/FAILED verdict displayed

## Common Failure Patterns

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Build fails immediately | Dockerfile syntax error | Check Dockerfile syntax |
| Build fails on COPY | File not in context | Check .dockerignore |
| Container exits immediately | Missing entrypoint | Check CMD/ENTRYPOINT |
| Container runs but no response | Port not exposed | Check EXPOSE and -p flag |
| Health check timeout | App slow to start | Increase wait time or add readiness probe |
| Health returns 404 | Wrong endpoint | Verify HEALTH_ENDPOINT path |
| Health returns 500 | App error on startup | Check container logs |

## Integration with CI/CD

Run this verification as a **pre-push hook** or CI step:

```yaml
# .github/workflows/ci.yml
jobs:
  docker-local-verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Local Docker Verification
        run: |
          chmod +x ./scripts/docker-local-verify.sh
          ./scripts/docker-local-verify.sh myapp 3000 3000 /health
```

**Gate rule:** Block remote deployment if local verification fails.
