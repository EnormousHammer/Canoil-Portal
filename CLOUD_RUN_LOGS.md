# How to View Cloud Run Logs

The backend is deployed on **Google Cloud Run**, not Vercel. Here's how to view logs:

## Option 1: Google Cloud Console (Web UI)
1. Go to: https://console.cloud.google.com/run
2. Select your project
3. Click on the service: `canoil-backend` (or your service name)
4. Click on "Logs" tab
5. You'll see real-time logs

## Option 2: gcloud CLI
```bash
# View recent logs
gcloud run services logs read canoil-backend --region=us-central1 --limit=50

# Follow logs in real-time
gcloud run services logs tail canoil-backend --region=us-central1

# Filter for specific text (e.g., "LOGISTICS" or "process-email")
gcloud run services logs read canoil-backend --region=us-central1 --filter="textPayload=~LOGISTICS" --limit=100
```

## Option 3: Cloud Logging Console
1. Go to: https://console.cloud.google.com/logs
2. Select your project
3. Use filters:
   - Resource: Cloud Run Revision
   - Service: canoil-backend
   - Search: "LOGISTICS" or "process-email"

## Performance Issues
If email parsing is 10x slower in production:
1. Check Cloud Run logs for timeout/errors
2. Check if backend is cold-starting (first request after idle)
3. Check OpenAI API response times in logs
4. Look for retry attempts or errors

