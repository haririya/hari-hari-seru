@echo off
REM Jalankan game di lokal. Buka http://127.0.0.1:8899/
REM Root server HARUS folder game ini (bukan folder induknya), karena
REM index.html ada di sini dan path aset ditulis relatif: assets/, games/, content/.
cd /d "%~dp0"
start "" "http://127.0.0.1:8899/"
python -m http.server 8899 --bind 127.0.0.1
