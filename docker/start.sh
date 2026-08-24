#!/usr/bin/env bash
set -e

# Start nginx
service nginx start || nginx -g 'daemon off;' &

# Start backend (uvicorn) on 127.0.0.1:8000
cd /srv/app/backend
nohup python3 -m uvicorn main:app --host 127.0.0.1 --port 8000 &

# Start Next.js (production)
cd /srv/app
nohup npm run start -- -p 3000 &

# Keep container running by tailing nginx logs
tail -f /var/log/nginx/error.log /var/log/nginx/access.log
