#!/usr/bin/env bash
# Mantiene la app del teléfono conectada a la API de XAMPP por el cable USB.
# Cada vez que el teléfono se (re)conecta, vuelve a crear la redirección
# 127.0.0.1:8081 del teléfono -> puerto 80 de la PC.
#   ./telefono-usb.sh        (Ctrl+C para detenerlo)
ADB="${ADB:-$HOME/Android/Sdk/platform-tools/adb}"

while true; do
    "$ADB" wait-for-usb-device
    if "$ADB" reverse tcp:8081 tcp:80 > /dev/null; then
        echo "$(date +%T) teléfono conectado: 127.0.0.1:8081 -> PC:80"
    fi
    "$ADB" wait-for-usb-disconnect
    echo "$(date +%T) teléfono desconectado, esperando..."
done
