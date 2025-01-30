#!/bin/bash

# Kill any existing processes
echo "Cleaning up existing processes..."
pkill ngrok
lsof -ti :3020 | xargs kill -9 2>/dev/null || true
lsof -ti :4040 | xargs kill -9 2>/dev/null || true

# Start Next.js in the background
echo "Starting Next.js on port 3020..."
npm run dev:3020 &
NEXT_PID=$!

# Wait for Next.js to start
echo "Waiting for Next.js to start..."
while ! nc -z localhost 3020; do   
  sleep 1
done

# Start ngrok
echo "Starting ngrok..."
ngrok start --config=scripts/ngrok.yml web > ngrok.log 2>&1 &
NGROK_PID=$!

# Wait for ngrok to start
echo "Waiting for ngrok to start..."
while ! curl -s http://localhost:4040/api/tunnels > /dev/null; do
  sleep 1
  # Check if ngrok failed to start
  if ! ps -p $NGROK_PID > /dev/null; then
    echo "Ngrok failed to start. Check ngrok.log for details."
    cat ngrok.log
    exit 1
  fi
done

# Get the ngrok URL
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"[^"]*' | cut -d'"' -f4)
if [ -z "$NGROK_URL" ]; then
  echo "Failed to get ngrok URL"
  cat ngrok.log
  exit 1
fi

echo "Ngrok URL: $NGROK_URL"

# Update .env.local with the new URL
echo "Updating .env.local with new URL..."
sed -i '' "s|NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=$NGROK_URL|" .env.local
sed -i '' "s|GMAIL_WEBHOOK_URL=.*|GMAIL_WEBHOOK_URL=$NGROK_URL/api/gmail/webhook|" .env.local

echo "Testing webhook endpoint..."
curl -X POST "$NGROK_URL/api/gmail/webhook" \
  -H "Authorization: Bearer mEn4R81yFHGCTQDL1lzd4H+necMd07TB2zz/oqaIo0c=" \
  -H "Content-Type: application/json" \
  -d '{"message": {"data": "dGVzdA=="}}' # Base64 encoded "test"

echo "Setup complete. Press Ctrl+C to stop all processes."

# Wait for either process to exit
wait -n $NEXT_PID $NGROK_PID

# If we get here, one of the processes died
echo "One of the processes exited unexpectedly"
cat ngrok.log
pkill -P $$  # Kill all child processes 
