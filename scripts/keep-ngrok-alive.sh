#!/bin/bash

# Configuration
CONFIG_FILE="scripts/ngrok.yml"
LOG_FILE="ngrok.log"

# Function to check if ngrok is already running
check_ngrok() {
  pgrep ngrok > /dev/null
  return $?
}

# Kill any existing ngrok processes
pkill ngrok

# Wait a moment to ensure processes are killed
sleep 2

while true; do
  if ! check_ngrok; then
    echo "Starting ngrok tunnel with config..."
    ngrok start --config="$CONFIG_FILE" --all --log=stdout > "$LOG_FILE" 2>&1
    
    # If ngrok exits, check the log for specific errors
    if grep -q "ERR_NGROK_108" "$LOG_FILE"; then
      echo "Authentication error detected. Please check your ngrok authentication."
      exit 1
    fi
    
    echo "Ngrok tunnel stopped. Checking logs..."
    tail -n 10 "$LOG_FILE"
    echo "Restarting in 5 seconds..."
    sleep 5
  else
    echo "Ngrok is already running"
    sleep 30
  fi
done 