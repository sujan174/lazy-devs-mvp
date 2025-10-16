#!/bin/bash
# Exit immediately if a command exits with a non-zero status.
set -e

# --- Diagnostic prints to confirm the container is starting correctly ---
echo "--- Starting Voiceprint Enrollment Service ---"
echo "--- Files in /app directory: ---"
ls -la
echo ""
echo "--- Python version: ---"
python --version
echo ""
echo "--- Starting Uvicorn server... ---"

# Execute the main command: run the Uvicorn server for the FastAPI app.
# This service runs on port 5001.
exec uvicorn app:app --host 0.0.0.0 --port 5001

