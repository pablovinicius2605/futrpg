@echo off
echo === Iniciando automacao do projeto ===

echo.
echo 1. Atualizando e instalando dependencias (Node.js)...
call npm init -y
call npm install express socket.io

echo.
echo 2. Salvando alteracoes no Git...
git add .
git commit -m "Atualizacao automatica via arquivo .bat"

echo.
echo 3. Enviando para o GitHub...
git push origin main

echo.
echo === Deploy concluido com sucesso! ===
pause