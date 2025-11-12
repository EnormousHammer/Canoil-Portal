#!/bin/bash
cd backend
python3 -m gunicorn app:app --bind 0.0.0.0:$PORT --timeout 120 --workers 2

