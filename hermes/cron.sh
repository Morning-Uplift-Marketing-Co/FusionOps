#!/usr/bin/env bash
# hermes/cron.sh — manually trigger the nightly FBIS analysis run
# Run from WSL2: bash /mnt/h/DEV/projects/ppc_project/ppc-claude-web-V1/hermes/cron.sh
set -e

echo "=== Starting FBIS nightly analysis $(date) ==="
hermes "run argus and nexus and iris and chrono in parallel, then run verdict, then update wiki overview"
echo "=== Analysis complete ==="
