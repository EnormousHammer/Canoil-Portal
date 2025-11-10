# OpenAI API Key Setup for Render

## Quick Setup Steps

### Step 1: Get Your OpenAI API Key

1. Go to: https://platform.openai.com/api-keys
2. Sign in to your OpenAI account
3. Click **"Create new secret key"**
4. Give it a name (e.g., "Canoil Portal")
5. **Copy the key immediately** - you won't be able to see it again!

The key will look like: `sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Step 2: Add to Render Environment Variables

1. Go to **Render Dashboard**: https://dashboard.render.com
2. Click on your **Web Service** (canoil-portal)
3. Click **"Environment"** tab (in the left sidebar)
4. Click **"Add Environment Variable"**
5. Set:
   - **Key**: `OPENAI_API_KEY`
   - **Value**: `sk-proj-your_actual_key_here` (paste your key)
6. Click **"Save Changes"**

### Step 3: Redeploy

After adding the environment variable, you **MUST** redeploy:

1. Go to **"Deployments"** tab
2. Click **"Manual Deploy"** → **"Deploy latest commit"**
3. Wait for deployment to complete

**Important:** Environment variables are only available after redeployment!

## Verify It's Working

After redeployment, check the logs:

1. Go to **"Logs"** tab
2. Look for:
   - ✅ `OpenAI client initialized successfully` (success)
   - ❌ `ERROR: OPENAI_API_KEY environment variable not set` (not set correctly)

## Troubleshooting

### Still seeing "OPENAI_API_KEY not set" error?

1. **Check the key name**: Must be exactly `OPENAI_API_KEY` (case-sensitive)
2. **Check the value**: Must start with `sk-proj-` or `sk-`
3. **Redeploy**: Environment variables only work after redeployment
4. **Check logs**: Look for any errors during startup

### Key not working?

1. **Check key is valid**: Go to https://platform.openai.com/api-keys and verify it's active
2. **Check billing**: Make sure your OpenAI account has credits
3. **Check usage limits**: Verify you haven't hit rate limits

## Security Notes

- ✅ **Never commit API keys to git**
- ✅ **Never share API keys publicly**
- ✅ **Use environment variables** (which you're doing!)
- ✅ **Rotate keys periodically** for security

## What Features Need OpenAI?

- Chat/AI Assistant queries
- Enterprise Analytics (some features)
- Smart Sales Order search
- Any GPT-4o powered features

Without the key, these features will be disabled, but the app will still work for:
- Data loading from Google Drive
- Manufacturing orders
- Purchase orders
- Inventory management
- All other non-AI features

