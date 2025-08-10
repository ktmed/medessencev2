# 🚀 MedEssence AI - INSTANT RECOVERY
*Use this if your laptop crashes - everything is saved and ready*

## ⚡ IMMEDIATE START (30 seconds)

```bash
# 1. Quick health check
ollama list              # Should show 35 models
curl localhost:11434/api/version  # Should return version

# 2. Auto-start everything
./start-system.sh        # Starts both backend and frontend

# 3. Open browser
# http://localhost:3010   # Should show "Connected" status
```

## 🔧 MANUAL START (if auto-start fails)

```bash
# Terminal 1: Backend
cd services/core && npm start
# Wait for: "WebSocket proxy running on http://localhost:8080"

# Terminal 2: Frontend  
cd frontend && npm run dev
# Wait for: "Ready in XXXXms"

# Check: http://localhost:3010
```

## 📊 SYSTEM OVERVIEW

| Service | Port | Status | Purpose |
|---------|------|--------|---------|
| Ollama | 11434 | ✅ Ready | AI Models (GPT-OSS 20B) |
| Backend | 8080 | ✅ Ready | WebSocket + Medical Agents |
| Frontend | 3010 | ✅ Ready | Web Speech + UI |

## 🤖 AI PROCESSING

- **Primary**: Ollama Local Models (Private, Fast)
- **Fallback**: Claude → Gemini → OpenAI (Cloud APIs)
- **Transcription**: Web Speech API (Browser-based)
- **Languages**: German (primary), English, Turkish, French

## 🔍 TROUBLESHOOTING

### Connection Issues
```bash
# Check ports
lsof -i :8080 -i :3010 -i :11434

# Fix WebSocket
# Problem: "Connection lost"
# Solution: Check RECOVERY_STATUS.md → WebSocket CORS Fix
```

### Ollama Issues  
```bash
# Restart Ollama
pkill ollama && ollama serve

# Test model
ollama run gpt-oss:latest "Hello"
```

---
**Git Commit**: `1b498fd` - All progress saved  
**Recovery Doc**: `RECOVERY_STATUS.md` - Complete details  
**Last Working**: August 10, 2025 - Fully operational system