# SupportFix AI

An intelligent troubleshooting assistant that provides automated technical support solutions for common computer and device issues.

## 🚀 Quick Start

### Option 1: Docker Deployment (Recommended)

```bash
# Clone the repository
git clone https://github.com/olivechaitanya/SupportFixAI-R.git
cd SupportFixAI-R

# Set up environment variables
cp backend/.env.example backend/.env
# Edit backend/.env with your Gemini API key

# Run with Docker Compose
docker-compose up -d
```

### Option 2: Manual Deployment

#### Backend Setup
```bash
cd backend
python -m venv venv
# On Windows: .\venv\Scripts\activate
# On Unix: source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

#### Frontend Setup
```bash
cd frontend
npm install
npm run build
npm run preview
```

## 🌐 Access

- **Backend API**: http://localhost:8000
- **Frontend**: http://localhost:8000 (served from backend)
- **API Documentation**: http://localhost:8000/docs

## ⚙️ Environment Variables

Create a `.env` file in the backend directory:

```env
# Gemini API Configuration
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

## 🛠️ Technology Stack

### Frontend
- React 18.3.1
- Vite 5.4.11
- TailwindCSS 3.4.17
- Framer Motion 12.38.0

### Backend
- FastAPI 0.115.12
- Python 3.12
- Google Gemini AI
- Uvicorn ASGI Server

## 📋 Features

- **AI-Powered Troubleshooting**: Uses Google Gemini for intelligent issue resolution
- **18+ Issue Categories**: Covers common technical problems
- **Real-time Chat Interface**: Modern React-based UI
- **Responsive Design**: Works on desktop and mobile
- **Persistent Chat History**: Local storage for conversations
- **RESTful API**: Clean backend architecture

## 🔧 Deployment Options

### Vercel (Frontend)
1. Connect your GitHub repository to Vercel
2. Set build command: `cd frontend && npm run build`
3. Set output directory: `frontend/dist`
4. Add environment variables as needed

### Railway/Render (Full Stack)
1. Connect repository to Railway/Render
2. Set build command: `pip install -r backend/requirements.txt && cd frontend && npm install && npm run build`
3. Set start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add GEMINI_API_KEY environment variable

### Docker
```bash
docker build -t supportfix-ai .
docker run -p 8000:8000 -e GEMINI_API_KEY=your_key supportfix-ai
```

## 📚 API Endpoints

- `GET /` - Health check
- `POST /chat` - Chat with the AI assistant
- `GET /docs` - Interactive API documentation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.
