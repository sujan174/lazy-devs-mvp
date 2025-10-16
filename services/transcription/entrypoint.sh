#!/bin/bash
# Exit immediately if a command exits with a non-zero status.
set -e

# --- Optional: Add some diagnostic prints ---
echo "--- Starting Transcription Service ---"
echo "--- Files in /app directory: ---"
ls -la
echo ""
echo "--- Python version: ---"
python --version
echo ""
echo "--- Starting Uvicorn server... ---"

# Execute the main command: run the Uvicorn server for the FastAPI app
# We'll run this on port 5002 to keep it separate from the voiceprint service.
exec uvicorn app:app --host 0.0.0.0 --port 5002
