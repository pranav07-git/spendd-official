#!/bin/sh
# Forward Metro (8081) and the Spendd server (8787) to every connected phone, so the debug
# app's http://localhost:8787 reaches the Mac. Wireless adb drops these on every reconnect.
adb devices | awk 'NR > 1 && $2 == "device" { print $1 }' | while read -r serial; do
  adb -s "$serial" reverse tcp:8081 tcp:8081 >/dev/null 2>&1
  adb -s "$serial" reverse tcp:8787 tcp:8787 >/dev/null 2>&1 && echo "Forwarded 8081 and 8787 to $serial"
done
exit 0
