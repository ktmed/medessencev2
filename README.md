# MedEssence AI - Medical Transcription & Report Generation

## 🚀 Quick Start (The ONLY way to run locally)

```bash
# From the project root directory, simply run:
./start.sh

# Or manually:
cd frontend && npm run dev
```

The application will start on **http://localhost:3010**

## ✅ What Works

- **Medical Transcription**: Using WebSpeech API (browser-native, no Vosk needed)
- **AI Report Generation**: Multi-provider support (Claude, Gemini, OpenAI)
- **ICD Code Generation**: Automatic medical coding
- **Enhanced Findings**: AI-powered finding extraction
- **Multi-language Support**: German and Arabic support

## 🌐 Production Deployment

The application is deployed at: **https://medessencev3.vercel.app**

## 📁 Project Structure

```
.
├── frontend/           # Next.js application (THE ONLY ACTIVE PART)
│   ├── app/           # App router pages and API routes
│   ├── components/    # React components
│   └── .env.local     # API keys configuration
├── _archive_unused/   # Archived unnecessary services (ignore this)
└── start.sh          # Quick start script
```

## ⚠️ Important Notes

1. **DO NOT** try to use Docker - it's not needed and will cause issues
2. **DO NOT** look for backend services - everything is integrated in Next.js
3. **DO NOT** try to run on any port other than 3010
4. The frontend folder contains EVERYTHING needed including API routes

## 🔑 Environment Variables

The `.env.local` file in the frontend folder should contain:

```env
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
GOOGLE_API_KEY=your_key_here
```

## 🛠 Tech Stack

- **Frontend**: Next.js 14 with App Router
- **Speech Recognition**: WebSpeech API (browser-native)
- **AI Providers**: Claude, Gemini, OpenAI
- **Deployment**: Vercel

## 📝 Development

```bash
# Install dependencies (if needed)
cd frontend && npm install

# Start development server
npm run dev

# The app runs on http://localhost:3010
```

## 🚫 What NOT to Do

- Don't run `docker-compose` commands
- Don't look for separate backend services
- Don't try to change the port from 3010
- Don't run multiple services - just the frontend

## ✨ Features

1. Click microphone to start recording
2. Speech is transcribed in real-time using WebSpeech API
3. Generate medical report with AI
4. Extract ICD codes automatically
5. Export reports in various formats

---

**Remember**: Just run `./start.sh` and go to http://localhost:3010 - that's it!