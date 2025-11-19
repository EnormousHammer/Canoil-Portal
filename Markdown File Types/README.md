# Canoil Portal

Enterprise manufacturing and logistics management system for Canoil Canada Ltd.

## Features

- **Dashboard**: Real-time business intelligence with inventory, manufacturing, and sales metrics
- **Report Maker**: Automated report generation including Lanxess production reports
- **Email Assistant**: AI-powered email management and responses
- **Logistics Automation**: Streamlined shipping and documentation
- **Manufacturing Management**: Production scheduling and tracking
- **Inventory Control**: Real-time stock levels and BOM management

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Python Flask
- **Database**: SQLite (development)
- **AI Integration**: OpenAI GPT-4

## Setup

### Prerequisites
- Node.js 18+
- Python 3.8+

### Installation

1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/canoil-portal.git
cd canoil-portal
```

2. Install frontend dependencies
```bash
npm install
```

3. Install backend dependencies
```bash
cd backend
pip install -r requirements.txt
cd ..
```

4. Set up environment variables
Create a `.env` file in the root directory:
```
VITE_API_URL=http://localhost:5002
```

Create a `.env` file in the backend directory:
```
OPENAI_API_KEY=your_openai_api_key
GMAIL_CREDENTIALS_PATH=path_to_gmail_credentials
```

### Development

1. Start the backend server
```bash
cd backend
python app.py
```

2. Start the frontend development server
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Deployment

This project is configured for deployment on Vercel (frontend) and your preferred backend hosting service.

### Vercel Deployment

1. Connect your GitHub repository to Vercel
2. Configure build settings:
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`

## License

Proprietary - Canoil Canada Ltd.
