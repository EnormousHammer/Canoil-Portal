image.png# ChatGPT Integration Setup Guide

## Overview

Your Canoil portal now includes an intelligent ChatGPT-powered assistant that can answer questions about your inventory, manufacturing orders, BOMs, and more. The assistant understands your MISys ERP data structure and can provide specific insights about stock levels, item usage, and manufacturing requirements.

## Features

The ChatGPT assistant can help with:

- **Stock Availability**: "Do we have enough of item X to make 33 cases?"
- **Item Usage Analysis**: "Where is item Y being used in our BOMs?"
- **Manufacturing Insights**: "Which manufacturing orders need more materials?"
- **Inventory Queries**: "Show me all items with low stock levels"
- **Cost Analysis**: "What's the total value of our current inventory?"
- **BOM Relationships**: "What components are needed for product Z?"
13;s
## Setup Instructions

### 1. Install Required Python Packages

Navigate to the backend directory and install the required packages:

```bash
cd backend
pip install openai==1.12.0 python-dotenv==1.0.0
```

### 2. API Key Configuration

The ChatGPT integration uses your provided API key. The key is already configured in the backend code, but for better security, you can set it as an environment variable:

**Option A: Environment Variable (Recommended)**
1. Create a `.env` file in the `backend` directory
2. Add your API key:
   ```
   OPENAI_API_KEY=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
   ```

**Option B: Direct Configuration (Current)**
The API key is already hardcoded in the backend for immediate use.

### 3. Start the Backend

Run the Flask backend server:

```bash
cd backend
python app.py
```

The backend will start on `http://127.0.0.1:5002`

### 4. Start the Frontend

In a separate terminal, start the frontend:

```bash
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:5001`

## Using the ChatGPT Assistant

### Accessing the Assistant

1. Open your Canoil portal in the browser
2. Look for the green chat bubble icon in the bottom-right corner
3. Click the icon to open the chat interface

### Sample Queries

Try these example queries to get started:

**Stock and Availability:**
- "Do we have enough CC Calcium Stearate Grease to fulfill current orders?"
- "What's the current stock level of FarmTek Semi-syn products?"
- "Which items are running low on inventory?"

**Manufacturing and BOMs:**
- "What components are needed for manufacturing order MO-12345?"
- "Show me all BOMs that use HiTEC 60646"
- "Which manufacturing orders are currently in progress?"

**Analysis and Insights:**
- "What's our total inventory value?"
- "Which are our top 10 most expensive items?"
- "What items have been recently purchased but not yet used?"

## Technical Details

### Backend Endpoints

The integration adds these new API endpoints:

- `POST /api/chat` - Main ChatGPT query endpoint
- `GET /api/item-analysis/<item_identifier>` - Detailed item analysis
- `GET /api/health` - Health check (existing)

### Data Context

The assistant has access to all your MISys data including:

- Items.json - Item descriptions, costs, basic info
- Items_with_stock.json - Current stock levels
- BillsOfMaterial.json & BillOfMaterialDetails.json - BOM relationships
- ManufacturingOrderHeaders.json & ManufacturingOrderDetails.json - MO data
- PurchaseOrders.json & PurchaseOrderDetails.json - Purchase order info

### AI Model

- Uses GPT-4 for accurate and contextual responses
- Configured with specific prompts for inventory management
- Includes sample data structure for better understanding

## Troubleshooting

### Common Issues

**1. Chat button doesn't appear**
- Ensure the backend is running on port 5002
- Check browser console for JavaScript errors

**2. "Error connecting to server" message**
- Verify the backend is running: `python backend/app.py`
- Check that port 5002 is not blocked by firewall
- Ensure all required packages are installed

**3. "No query provided" error**
- Make sure you're typing a message before clicking send
- Check that the message input field is not empty

**4. API key errors**
- Verify the OpenAI API key is correct and has sufficient credits
- Check for any API rate limiting issues

### Debugging Steps

1. **Check Backend Status:**
   ```bash
   curl http://127.0.0.1:5002/api/health
   ```

2. **View Backend Logs:**
   Look at the terminal where you ran `python app.py` for error messages

3. **Test API Directly:**
   ```bash
   curl -X POST http://127.0.0.1:5002/api/chat \
     -H "Content-Type: application/json" \
     -d '{"query": "How many items do we have?"}'
   ```

## Customization

### Modifying AI Behavior

You can customize the assistant's responses by editing the `system_prompt` in `backend/app.py`. The current prompt is optimized for inventory management, but you can adjust it for:

- Different response styles (more technical, more conversational)
- Specific focus areas (cost optimization, quality control)
- Custom business rules and priorities

### Adding New Query Types

To add new types of queries:

1. Extend the `analyze_inventory_data()` function
2. Add new analysis functions (like `find_item_usage_and_availability()`)
3. Update the system prompt to include new capabilities

## Security Notes

- The API key is included in the code for immediate testing
- For production use, move the API key to environment variables
- Consider implementing rate limiting for the chat endpoint
- Monitor API usage to manage costs

## Cost Management

- Each query uses OpenAI API credits
- GPT-4 costs more than GPT-3.5 but provides better accuracy
- Consider switching to GPT-3.5-turbo for cost optimization if needed
- Monitor usage through the OpenAI dashboard

## Support

If you encounter issues:

1. Check this troubleshooting guide
2. Review the backend logs for specific error messages
3. Test individual components (backend API, frontend interface)
4. Verify your G: Drive data is accessible and properly formatted

The ChatGPT integration is designed to work seamlessly with your existing Canoil portal and provide intelligent insights into your inventory and manufacturing data.
