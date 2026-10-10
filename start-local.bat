@echo off
REM Runs the recipe page on this computer (needs Python: https://www.python.org/downloads/).
REM Then open http://localhost:8000 here, or http://<this-computer's-IP>:8000 on a phone on the same Wi-Fi.
cd /d "%~dp0"
start "" http://localhost:8000
python -m http.server 8000 || py -m http.server 8000
pause
