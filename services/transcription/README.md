# Medical Transcription Service

A production-ready FastAPI service for real-time medical audio transcription using OpenAI Whisper with medical terminology optimization and WebSocket support.

## Features

### Core Transcription
- **OpenAI Whisper Integration**: Both local models and API fallback
- **Multi-language Support**: German, English, French, Spanish, Italian, Turkish
- **Real-time Processing**: WebSocket streaming for live transcription
- **File Upload Support**: WAV, MP3, M4A, WebM, OGG, FLAC formats

### Medical Enhancement
- **Medical Terminology Processing**: Specialized dictionaries and corrections
- **Context-aware Enhancement**: Medical context detection and optimization
- **German Medical Support**: Comprehensive German radiology terminology
- **Quality Assessment**: Confidence scoring and quality metrics

### Audio Processing
- **Preprocessing Pipeline**: Noise reduction, normalization, silence removal
- **Format Conversion**: Automatic conversion to optimal format
- **Quality Analysis**: SNR, RMS, spectral analysis
- **Voice Activity Detection**: Intelligent silence removal

### Performance & Scalability
- **Redis Caching**: Session management and result caching
- **Rate Limiting**: Per-IP rate limiting and connection management
- **Concurrent Processing**: Configurable concurrent transcription limits
- **Docker Support**: Production-ready containerization

## Quick Start

### Using Docker (Recommended)

1. **Clone and navigate to the service:**
   ```bash
   cd /path/to/radiology-ai-system/services/transcription
   ```

2. **Create environment file:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start services:**
   ```bash
   docker-compose up -d
   ```

4. **Verify service:**
   ```bash
   curl http://localhost:8003/health
   ```

### Manual Installation

1. **Install system dependencies:**
   ```bash
   # Ubuntu/Debian
   sudo apt-get update
   sudo apt-get install ffmpeg libsndfile1 redis-server
   
   # macOS
   brew install ffmpeg libsndfile redis
   ```

2. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Start Redis:**
   ```bash
   redis-server
   ```

4. **Configure service:**
   ```bash
   cp .env.example .env
   # Edit .env file with your settings
   ```

5. **Start service:**
   ```bash
   ./start.sh
   # or for development:
   ./start.sh dev
   ```

## API Endpoints

### File Transcription
```http
POST /transcribe
Content-Type: multipart/form-data

Parameters:
- file: Audio file (required)
- language: Language code (default: auto)
- medical_context: Enable medical processing (default: true)
- quality_threshold: Minimum quality threshold (default: 0.7)
```

### WebSocket Streaming
```javascript
const ws = new WebSocket('ws://localhost:8003/ws/transcribe');

// Configuration
ws.send(JSON.stringify({
    type: 'config',
    config: {
        language: 'de',
        medical_context: true,
        quality_threshold: 0.7
    }
}));

// Send audio data (base64 encoded)
ws.send(JSON.stringify({
    type: 'audio',
    data: audioBase64Data
}));
```

### Health Check
```http
GET /health
```

### Supported Languages
```http
GET /languages
```

### Session Management
```http
GET /sessions/{session_id}
DELETE /sessions/{session_id}
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Server host |
| `PORT` | `8003` | Server port |
| `OPENAI_API_KEY` | - | OpenAI API key (optional) |
| `WHISPER_MODEL` | `base` | Local Whisper model size |
| `USE_LOCAL_WHISPER` | `true` | Use local Whisper model |
| `REDIS_HOST` | `localhost` | Redis server host |
| `REDIS_PORT` | `6379` | Redis server port |
| `MAX_CONCURRENT_TRANSCRIPTIONS` | `10` | Max concurrent transcriptions |
| `SESSION_TIMEOUT` | `3600` | Session timeout in seconds |
| `LOG_LEVEL` | `INFO` | Logging level |

### Whisper Models

Available models (size/accuracy trade-off):
- `tiny`: Fastest, lowest accuracy
- `base`: Good balance (recommended)
- `small`: Better accuracy, slower
- `medium`: High accuracy, requires more resources
- `large`: Highest accuracy, GPU recommended

### Medical Dictionaries

The service includes comprehensive medical dictionaries:
- **English**: General medical terminology, radiology terms
- **German**: German medical and radiology terminology
- **Abbreviations**: Medical abbreviations for all languages

Custom dictionaries can be added to `data/medical_dictionaries/`.

## API Examples

### File Transcription (cURL)
```bash
curl -X POST "http://localhost:8003/transcribe" \
  -F "file=@audio.wav" \
  -F "language=de" \
  -F "medical_context=true"
```

### Python Client
```python
import requests
import json

# File transcription
with open('audio.wav', 'rb') as f:
    response = requests.post(
        'http://localhost:8003/transcribe',
        files={'file': f},
        data={
            'language': 'de',
            'medical_context': True,
            'quality_threshold': 0.7
        }
    )

result = response.json()
print(f"Transcribed text: {result['text']}")
print(f"Confidence: {result['confidence']}")
print(f"Medical terms: {result['medical_terms']}")
```

### WebSocket Client
```python
import asyncio
import websockets
import json
import base64

async def transcribe_stream():
    uri = "ws://localhost:8003/ws/transcribe"
    
    async with websockets.connect(uri) as websocket:
        # Configure session
        await websocket.send(json.dumps({
            "type": "config",
            "config": {
                "language": "de",
                "medical_context": True,
                "quality_threshold": 0.7
            }
        }))
        
        # Send audio data
        with open('audio.wav', 'rb') as f:
            audio_data = base64.b64encode(f.read()).decode()
            
        await websocket.send(json.dumps({
            "type": "audio",
            "data": audio_data
        }))
        
        # Receive results
        async for message in websocket:
            data = json.loads(message)
            if data['type'] == 'transcription':
                print(f"Result: {data['data']['text']}")

# Run the client
asyncio.run(transcribe_stream())
```

## Production Deployment

### Docker Compose with Nginx
```bash
# Start with Nginx proxy
docker-compose --profile production up -d
```

### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: transcription-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: transcription-service
  template:
    metadata:
      labels:
        app: transcription-service
    spec:
      containers:
      - name: transcription
        image: transcription-service:latest
        ports:
        - containerPort: 8003
        env:
        - name: REDIS_HOST
          value: "redis-service"
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: transcription-secrets
              key: openai-api-key
```

### Environment-specific Configurations

#### Development
```bash
# .env.dev
DEBUG=true
LOG_LEVEL=DEBUG
USE_LOCAL_WHISPER=true
WHISPER_MODEL=base
```

#### Production
```bash
# .env.prod
DEBUG=false
LOG_LEVEL=INFO
USE_LOCAL_WHISPER=true
WHISPER_MODEL=medium
WORKERS=8
MAX_CONCURRENT_TRANSCRIPTIONS=20
```

## Performance Tuning

### Hardware Recommendations

**CPU-based deployment:**
- 4+ CPU cores
- 8GB+ RAM
- SSD storage

**GPU-based deployment:**
- NVIDIA GPU with 4GB+ VRAM
- 16GB+ RAM
- Set `WHISPER_DEVICE=cuda`

### Optimization Tips

1. **Model Selection**: Use appropriate Whisper model for your use case
2. **Concurrent Limits**: Adjust `MAX_CONCURRENT_TRANSCRIPTIONS` based on resources
3. **Redis Configuration**: Configure Redis memory limits and persistence
4. **Audio Preprocessing**: Enable noise reduction for better accuracy
5. **Caching**: Utilize Redis caching for repeated transcriptions

## Monitoring and Logging

### Health Monitoring
```bash
# Check service health
curl http://localhost:8003/health

# Get service metrics
curl http://localhost:8003/metrics
```

### Log Analysis
```bash
# View logs in Docker
docker-compose logs -f transcription

# View application logs
tail -f logs/transcription.log
```

### Prometheus Metrics
The service exposes metrics for monitoring:
- Transcription count and processing times
- Error rates and types
- WebSocket connection metrics
- Redis connection status

## Troubleshooting

### Common Issues

**"Redis connection failed"**
- Ensure Redis is running
- Check `REDIS_HOST` and `REDIS_PORT` configuration
- Verify network connectivity

**"Whisper model loading failed"**
- Check available disk space
- Verify internet connection for model download
- Try a smaller model size

**"Audio processing failed"**
- Ensure ffmpeg is installed
- Check audio file format and size
- Verify file is not corrupted

**"WebSocket connection issues"**
- Check firewall settings
- Verify WebSocket endpoint accessibility
- Review connection limits

### Debug Mode
```bash
# Start in debug mode
DEBUG=true LOG_LEVEL=DEBUG ./start.sh dev
```

### Performance Issues
```bash
# Monitor resource usage
docker stats

# Check Redis memory usage
redis-cli info memory

# Monitor application metrics
curl http://localhost:8003/metrics
```

## Development

### Project Structure
```
transcription/
├── main.py                 # FastAPI application
├── config.py              # Configuration management
├── requirements.txt       # Python dependencies
├── Dockerfile            # Container configuration
├── docker-compose.yml    # Multi-service setup
├── services/             # Business logic
│   ├── transcription_service.py
│   └── websocket_manager.py
├── utils/                # Utilities
│   ├── audio_processor.py
│   ├── medical_terminology.py
│   ├── error_handler.py
│   ├── logger.py
│   └── redis_manager.py
└── data/                 # Medical dictionaries
    └── medical_dictionaries/
```

### Adding New Languages
1. Create dictionary file: `data/medical_dictionaries/{lang_code}.json`
2. Add language to `Config.SUPPORTED_LANGUAGES`
3. Update medical terminology processor
4. Test with sample audio

### Extending Medical Dictionaries
```python
# Add terms to existing dictionary
{
    "terms": {
        "new_term": "Corrected Term",
        "abbreviation": "Full Form"
    },
    "corrections": {
        "common_error": "correct_term"
    },
    "patterns": [
        r"\\bpattern\\b"
    ]
}
```

## License

This project is part of the Medical AI Radiology System. See the main project for licensing information.

## Support

For issues and questions:
1. Check this documentation
2. Review logs for error details
3. Check system requirements
4. Verify configuration settings