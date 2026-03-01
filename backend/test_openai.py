#!/usr/bin/env python3
"""Quick OpenAI API test"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

api_key = os.getenv('OPENAI_API_KEY')
if not api_key or len(api_key) < 20:
    print("ERROR: OPENAI_API_KEY not set")
    sys.exit(1)

from openai import OpenAI
print(f"Key length: {len(api_key)}, starts sk-: {api_key.startswith('sk-')}, has newline: {chr(10) in api_key or chr(13) in api_key}")
client = OpenAI(api_key=api_key)

try:
    r = client.chat.completions.create(
        model='gpt-4o',
        messages=[{'role': 'user', 'content': 'Reply with only: OK'}],
        max_tokens=5
    )
    print('SUCCESS:', r.choices[0].message.content)
except Exception as e:
    print('FAILED:', type(e).__name__, str(e)[:200])
    sys.exit(1)
