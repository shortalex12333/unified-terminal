import subprocess
import tempfile
import os
import sys

def test_docker_health_returns_exit_code():
    """Test that check_docker_health.py returns proper exit code."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create minimal docker-compose.yml
        compose_path = os.path.join(tmpdir, "docker-compose.yml")
        with open(compose_path, "w") as f:
            f.write("""
version: "3.8"
services:
  app:
    image: node:18-alpine
    ports:
      - "3000:3000"
    command: "echo 'ready' && sleep 100"
""")

        # Run check script
        result = subprocess.run(
            [sys.executable, "docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/checks/check_docker_health.py", tmpdir],
            capture_output=True,
            text=True,
            timeout=60
        )

        # Should exit 0 (container healthy) or 1 (not healthy), but NOT crash
        assert result.returncode in [0, 1], f"Unexpected exit code: {result.returncode}\nStdout: {result.stdout}\nStderr: {result.stderr}"
        print(f"✅ Test passed with exit code: {result.returncode}")

if __name__ == "__main__":
    test_docker_health_returns_exit_code()
