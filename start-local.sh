#!/bin/sh
# Runs the recipe page on this computer (Mac/Linux; uses the built-in Python 3).
# Then open http://localhost:8000 here, or http://<this-computer's-IP>:8000 on a phone on the same Wi-Fi.
cd "$(dirname "$0")"
( sleep 1; open http://localhost:8000 2>/dev/null || xdg-open http://localhost:8000 2>/dev/null ) &
python3 -m http.server 8000
