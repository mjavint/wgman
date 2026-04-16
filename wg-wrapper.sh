#!/bin/sh
# Wrapper script to run wg-quick and ip commands without sudo password issues

case "$1" in
    up)
        /usr/bin/wg-quick up "$2"
        ;;
    down)
        /usr/bin/wg-quick down "$2"
        ;;
    ip)
        shift
        /usr/bin/ip "$@"
        ;;
    wg)
        shift
        /usr/bin/wg "$@"
        ;;
    *)
        echo "Usage: $0 {up|down|ip|wg} [args...]"
        exit 1
        ;;
esac