#!/bin/sh
# Kept for compatibility: rebuilds all pages and data files.
cd "$(dirname "$0")" && python3 build.py
