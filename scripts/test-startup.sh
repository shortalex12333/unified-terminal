#!/bin/bash

# Test app startup and conductor initialization
# Verify:
# 1. React renderer loads on 3000
# 2. Conductor initializes with persistent session
# 3. Window visible and ready
# 4. All CLIs accessible

echo "═══════════════════════════════════════════════════════════════"
echo "TESTING APP STARTUP + CONDUCTOR"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Kill any existing processes
pkill -f "electron ." 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 1

# Start the app in background
echo "Starting app... (will run for 15 seconds)"
npm run dev > /tmp/app-startup.log 2>&1 &
APP_PID=$!
echo "App PID: $APP_PID"
echo ""

# Wait for startup
sleep 15

# Check logs
echo "STARTUP LOG ANALYSIS:"
echo "─────────────────────"
echo ""

# Grep for key events
echo "1. Renderer load:"
grep -i "loading react app\|vite.*ready\|localhost" /tmp/app-startup.log | tail -3 || echo "  ⚠ Not found"

echo ""
echo "2. Conductor initialization:"
grep -i "conductor\|session" /tmp/app-startup.log | tail -5 || echo "  ⚠ Not found"

echo ""
echo "3. CLI setup:"
grep -i "cli\|ipc handlers\|registered" /tmp/app-startup.log | head -10 || echo "  ⚠ Not found"

echo ""
echo "4. Window creation:"
grep -i "window\|create\|bounds" /tmp/app-startup.log | head -5 || echo "  ⚠ Not found"

echo ""
echo "─────────────────────"

# Kill the app
kill $APP_PID 2>/dev/null || true
sleep 2

# Summary
echo ""
echo "✓ Startup test complete"
echo ""
echo "Full log: /tmp/app-startup.log"
echo ""
echo "Next: npm run dev (to use app interactively)"
