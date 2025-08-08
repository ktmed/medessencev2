# Real-Time Radiology AI System
## System Architecture Document

---

## Document Information

- **Document Version**: 2.0
- **Last Updated**: January 31, 2025
- **Author**: Medical AI Solutions Development Team
- **Review Status**: Technical Review Complete
- **Classification**: Internal Use

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Architecture Principles](#architecture-principles)
4. [Component Architecture](#component-architecture)
5. [Data Flow Architecture](#data-flow-architecture)
6. [Integration Architecture](#integration-architecture)
7. [Security Architecture](#security-architecture)
8. [Deployment Architecture](#deployment-architecture)
9. [Performance Architecture](#performance-architecture)
10. [Scalability Architecture](#scalability-architecture)
11. [Disaster Recovery](#disaster-recovery)
12. [Architecture Decisions](#architecture-decisions)

---

## Executive Summary

The Real-Time Radiology AI System is a cloud-native, microservices-based platform that transforms spoken radiology dictation into structured medical reports using advanced speech recognition and artificial intelligence. The system is built on modern web technologies with a focus on real-time performance, scalability, and medical-grade accuracy.

### Key Architecture Characteristics
- **Real-time processing**: Sub-2-second latency for speech-to-text conversion
- **High availability**: 99.9% uptime with automatic failover mechanisms
- **Scalable design**: Horizontal scaling to support 1000+ concurrent users
- **Security-first**: GDPR and HIPAA compliant data handling
- **AI-powered**: Multi-LLM architecture with specialized medical agents

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│  Web Browser │ Mobile App │ Desktop App │ EMR Integration       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API GATEWAY LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│    Load Balancer │ SSL Termination │ Rate Limiting │ Auth       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   APPLICATION LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│ WebSocket Proxy │ Report Orchestrator │ Multi-LLM Service      │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVICE LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│ Speech Service │ AI Agents │ Classification │ VAD Processing   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                │
├─────────────────────────────────────────────────────────────────┤
│   PostgreSQL   │    Redis     │  File Storage │  Model Storage  │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack Overview

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React.js, WebSocket Client | User interface and real-time communication |
| **API Gateway** | Nginx, Let's Encrypt | Load balancing, SSL termination, routing |
| **Application** | Node.js, Socket.IO | Real-time orchestration and business logic |
| **Speech Processing** | Python, Vosk, NumPy | Speech recognition and audio processing |
| **AI Services** | OpenAI API, Claude API, Gemini API | Natural language processing |
| **Data Storage** | PostgreSQL, Redis, S3 | Persistent and cached data storage |
| **Infrastructure** | Docker, Kubernetes, AWS/Azure | Containerization and orchestration |

---

## Architecture Principles

### 1. Microservices Architecture
- **Principle**: Decompose system into independent, loosely coupled services
- **Implementation**: Each major function (speech, AI, orchestration) is a separate service
- **Benefits**: Independent scaling, technology diversity, fault isolation

### 2. Real-Time First
- **Principle**: Optimize for low-latency, real-time user experience
- **Implementation**: WebSocket communication, streaming processing, efficient buffering
- **Benefits**: Immediate feedback, responsive user interface, clinical workflow integration

### 3. AI-Native Design
- **Principle**: Built around AI capabilities with human oversight
- **Implementation**: Multi-LLM architecture, specialized agents, fallback mechanisms
- **Benefits**: High accuracy, resilience to AI service outages, continuous improvement

### 4. Security by Design
- **Principle**: Security integrated at every architectural layer
- **Implementation**: End-to-end encryption, zero-trust networking, audit logging
- **Benefits**: HIPAA/GDPR compliance, data protection, regulatory confidence

### 5. Cloud-Native Architecture
- **Principle**: Designed for cloud deployment with modern DevOps practices
- **Implementation**: Containerization, CI/CD pipelines, infrastructure as code
- **Benefits**: Scalability, maintainability, rapid deployment

### 6. Data-Driven Intelligence
- **Principle**: Leverage real-world data for continuous improvement
- **Implementation**: 189k+ report dataset analysis, usage analytics, ML model training
- **Benefits**: Evidence-based decisions, improved accuracy, clinical relevance

---

## Component Architecture

### 1. Frontend Layer

#### React Web Application
```typescript
// Component Architecture
├── src/
│   ├── components/
│   │   ├── TranscriptionInterface/
│   │   │   ├── AudioRecorder.tsx
│   │   │   ├── TranscriptionDisplay.tsx
│   │   │   └── ControlPanel.tsx
│   │   ├── ReportGeneration/
│   │   │   ├── ReportEditor.tsx
│   │   │   ├── ReportPreview.tsx
│   │   │   └── ExportOptions.tsx
│   │   └── Dashboard/
│   │       ├── MetricsDashboard.tsx
│   │       └── ReportHistory.tsx
│   ├── hooks/
│   │   ├── useWebSocket.ts
│   │   ├── useAudioRecording.ts
│   │   └── useReportGeneration.ts
│   ├── services/
│   │   ├── WebSocketService.ts
│   │   ├── AudioProcessor.ts
│   │   └── ReportService.ts
│   └── utils/
│       ├── AudioUtils.ts
│       └── ValidationUtils.ts
```

#### Key Frontend Components

**Audio Recording Manager**
```typescript
class AudioRecordingManager {
    private mediaRecorder: MediaRecorder;
    private audioContext: AudioContext;
    private vadProcessor: VADProcessor;
    
    async startRecording(constraints: MediaStreamConstraints) {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        this.mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus',
            audioBitsPerSecond: 128000
        });
        
        this.setupAudioProcessing(stream);
        this.mediaRecorder.start(100); // 100ms chunks
    }
    
    private setupAudioProcessing(stream: MediaStream) {
        this.audioContext = new AudioContext({ sampleRate: 16000 });
        const source = this.audioContext.createMediaStreamSource(stream);
        
        // Voice Activity Detection
        this.vadProcessor = new VADProcessor();
        const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
        
        processor.onaudioprocess = (event) => {
            const inputBuffer = event.inputBuffer.getChannelData(0);
            const vadResult = this.vadProcessor.process(inputBuffer);
            
            if (vadResult.isSpeech) {
                this.sendAudioChunk(inputBuffer);
            }
        };
        
        source.connect(processor);
        processor.connect(this.audioContext.destination);
    }
}
```

**WebSocket Service**
```typescript
class WebSocketService {
    private socket: io.Socket;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    
    constructor(private url: string) {
        this.connect();
    }
    
    private connect() {
        this.socket = io(this.url, {
            transports: ['websocket'],
            upgrade: true,
            timeout: 5000
        });
        
        this.socket.on('connect', () => {
            console.log('Connected to transcription service');
            this.reconnectAttempts = 0;
        });
        
        this.socket.on('disconnect', () => {
            this.handleReconnection();
        });
        
        this.socket.on('transcription_update', (data) => {
            this.onTranscriptionUpdate(data);
        });
        
        this.socket.on('report_generated', (data) => {
            this.onReportGenerated(data);
        });
    }
    
    private handleReconnection() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => this.connect(), 1000 * this.reconnectAttempts);
        }
    }
}
```

### 2. Application Layer

#### WebSocket Proxy Service
```javascript
// websocket-proxy.js
class WebSocketProxy {
    constructor() {
        this.frontendServer = require('socket.io')(8080, {
            cors: { origin: "*", methods: ["GET", "POST"] }
        });
        
        this.reportOrchestrator = new ReportOrchestrator(multiLLMService);
        this.connectionManager = new ConnectionManager();
        this.metricsCollector = new MetricsCollector();
        
        this.setupEventHandlers();
    }
    
    setupEventHandlers() {
        this.frontendServer.on('connection', (socket) => {
            console.log(`Frontend connected: ${socket.id}`);
            
            // Audio processing
            socket.on('start_transcription', (data) => {
                this.handleStartTranscription(socket, data);
            });
            
            socket.on('audio_data', (data) => {
                this.handleAudioData(socket, data);
            });
            
            socket.on('stop_transcription', () => {
                this.handleStopTranscription(socket);
            });
            
            // Report generation
            socket.on('generate_report', (data) => {
                this.handleReportGeneration(socket, data);
            });
            
            // Connection management
            socket.on('disconnect', () => {
                this.handleDisconnection(socket);
            });
        });
    }
    
    async handleAudioData(socket, data) {
        const startTime = Date.now();
        
        try {
            // Forward to Vosk transcription service
            if (this.voskConnection && this.voskConnection.readyState === WebSocket.OPEN) {
                this.voskConnection.send(JSON.stringify({
                    type: 'audio',
                    data: data.data,
                    session_id: socket.id
                }));
            }
            
            // Collect metrics
            this.metricsCollector.recordAudioProcessing(Date.now() - startTime);
            
        } catch (error) {
            console.error('Audio processing error:', error);
            socket.emit('error', { type: 'audio_processing', message: error.message });
        }
    }
    
    async handleReportGeneration(socket, data) {
        const startTime = Date.now();
        
        try {
            // Process through orchestrator
            const result = await this.reportOrchestrator.processReport(
                data.transcriptionText,
                data.language || 'de',
                { source: 'transcription', timestamp: Date.now() }
            );
            
            // Emit structured report
            socket.emit('report_generated', {
                id: `report-${Date.now()}`,
                ...result,
                generatedAt: Date.now(),
                processingTime: Date.now() - startTime
            });
            
            // Collect metrics
            this.metricsCollector.recordReportGeneration(Date.now() - startTime);
            
        } catch (error) {
            console.error('Report generation error:', error);
            socket.emit('error', { type: 'report_generation', message: error.message });
        }
    }
}
```

#### Report Orchestrator
```javascript
// report-orchestrator.js
class ReportOrchestrator {
    constructor(multiLLMService) {
        this.llmService = multiLLMService;
        this.classifier = new ReportClassifier();
        this.agents = this.initializeAgents();
        this.confidenceThreshold = 0.7;
    }
    
    initializeAgents() {
        return {
            mammography: new MammographyAgent(this.llmService),
            spine_mri: new SpineMRIAgent(this.llmService),
            ct_scan: new CTScanAgent(this.llmService),
            ultrasound: new UltrasoundAgent(this.llmService),
            oncology: new OncologyAgent(this.llmService),
            cardiac: new CardiacAgent(this.llmService),
            pathology: new PathologyAgent(this.llmService),
            general: new GeneralAgent(this.llmService)
        };
    }
    
    async processReport(reportText, language = 'de', metadata = {}) {
        const processingStart = Date.now();
        
        try {
            // 1. Classify report type
            const classification = await this.classifier.classify(reportText);
            
            // 2. Select appropriate agent
            let result;
            if (classification.confidence >= this.confidenceThreshold) {
                const agent = this.agents[classification.type];
                result = await agent.parseReport(reportText, language, metadata);
            } else {
                // Use ensemble approach for low confidence
                result = await this.ensembleParsing(reportText, language, classification);
            }
            
            // 3. Add orchestrator metadata
            result.metadata = {
                ...result.metadata,
                orchestrator: {
                    classification: classification,
                    processingTime: Date.now() - processingStart,
                    confidence: classification.confidence,
                    agent: classification.type
                }
            };
            
            return result;
            
        } catch (error) {
            console.error('Report processing error:', error);
            throw new Error(`Report processing failed: ${error.message}`);
        }
    }
    
    async ensembleParsing(reportText, language, classification) {
        // Run top 3 agents in parallel
        const topAgents = classification.scores.slice(0, 3);
        const promises = topAgents.map(({ type }) => 
            this.agents[type].parseReport(reportText, language).catch(error => ({ error, type }))
        );
        
        const results = await Promise.allSettled(promises);
        
        // Merge successful results
        return this.mergeResults(results.filter(r => r.status === 'fulfilled' && !r.value.error));
    }
}
```

### 3. Service Layer

#### Speech Recognition Service
```python
# transcription-service-vosk.py
class VoskTranscriptionService:
    def __init__(self):
        self.model_path = "vosk-models/vosk-model-de-0.21"
        self.model = None
        self.sessions = {}
        self.sample_rate = 16000
        self.metrics_collector = MetricsCollector()
        
    async def initialize(self):
        """Initialize Vosk model with optimizations"""
        print(f"Loading Vosk model from {self.model_path}...")
        self.model = Model(self.model_path)
        
        # Model optimization
        self.model.SetLogLevel(-1)  # Reduce logging
        print("Vosk model loaded successfully!")
        
    async def handle_client(self, websocket, path):
        session_id = str(datetime.now().timestamp())
        
        # Create optimized recognizer
        rec = KaldiRecognizer(self.model, self.sample_rate)
        
        # Accuracy optimizations from dataset analysis
        rec.SetWords(True)              # Word-level timestamps
        rec.SetPartialWords(True)       # Partial results for real-time feedback
        rec.SetMaxAlternatives(3)       # Multiple hypotheses for accuracy
        rec.SetGrammarFst(None)         # No grammar constraints for medical terms
        
        self.sessions[session_id] = {
            "recognizer": rec,
            "config": {"language": "de", "medical_context": True},
            "audio_buffer": bytearray(),
            "metrics": {"start_time": datetime.now(), "total_audio": 0}
        }
        
        try:
            async for message in websocket:
                await self.process_message(websocket, session_id, message)
        except Exception as e:
            print(f"Session error {session_id}: {e}")
        finally:
            self.cleanup_session(session_id)
    
    async def process_message(self, websocket, session_id, message):
        data = json.loads(message)
        session = self.sessions[session_id]
        
        if data["type"] == "audio":
            await self.handle_audio_data(websocket, session_id, data)
        elif data["type"] == "config":
            await self.handle_config_update(websocket, session_id, data)
    
    async def handle_audio_data(self, websocket, session_id, data):
        session = self.sessions[session_id]
        rec = session["recognizer"]
        
        # Decode and preprocess audio
        audio_data = base64.b64decode(data["data"])
        audio_array = np.frombuffer(audio_data, dtype=np.int16)
        
        # Audio preprocessing for medical speech
        processed_audio = self.preprocess_audio(audio_array)
        session["metrics"]["total_audio"] += len(processed_audio)
        
        # Process with Vosk
        processing_start = time.time()
        
        if rec.AcceptWaveform(processed_audio.tobytes()):
            # Final result
            result = json.loads(rec.Result())
            processing_time = time.time() - processing_start
            
            if result.get("text", "").strip():
                await self.send_transcription(websocket, result, processing_time)
                
        # Send partial results for real-time feedback
        partial = json.loads(rec.PartialResult())
        if partial.get("partial", ""):
            await self.send_partial_transcription(websocket, partial)
    
    def preprocess_audio(self, audio_array):
        """Enhanced audio preprocessing based on medical speech characteristics"""
        if len(audio_array) == 0:
            return audio_array
            
        # Pre-emphasis filter (boosts high frequencies for clarity)
        pre_emphasis = 0.97
        emphasized = np.append(audio_array[0], 
                             audio_array[1:] - pre_emphasis * audio_array[:-1])
        
        # Dynamic range compression for consistent levels
        max_val = np.max(np.abs(emphasized))
        if max_val > 0:
            # Normalize to 80% of maximum to prevent clipping
            target_level = 0.8 * 32768
            if max_val > target_level:
                emphasized = (emphasized * target_level / max_val).astype(np.int16)
        
        # Noise gate for silence detection
        rms = np.sqrt(np.mean(emphasized.astype(np.float32)**2))
        if rms < 100:  # Very quiet, likely silence
            emphasized = np.zeros_like(emphasized)
            
        return emphasized
    
    async def send_transcription(self, websocket, result, processing_time):
        """Send final transcription with medical term highlighting"""
        medical_terms = self.extract_medical_terms(result["text"])
        confidence = self.calculate_confidence(result)
        
        await websocket.send(json.dumps({
            "type": "transcription",
            "data": {
                "text": result["text"],
                "language": "de",
                "confidence": confidence,
                "processing_time": processing_time,
                "medical_terms": medical_terms,
                "segments": self.format_segments(result),
                "timestamp": datetime.now().isoformat()
            }
        }))
        
        # Collect metrics
        self.metrics_collector.record_transcription(
            len(result["text"]), confidence, processing_time
        )
```

#### Multi-LLM Service
```javascript
// multi-llm-service.js
class MultiLLMService {
    constructor() {
        this.providers = {
            openai: new OpenAIService({
                apiKey: process.env.OPENAI_API_KEY,
                model: 'gpt-4-turbo-preview',
                maxTokens: 4000,
                temperature: 0.1  // Low temperature for medical accuracy
            }),
            claude: new ClaudeService({
                apiKey: process.env.CLAUDE_API_KEY,
                model: 'claude-3-opus-20240229',
                maxTokens: 4000,
                temperature: 0.1
            }),
            gemini: new GeminiService({
                apiKey: process.env.GEMINI_API_KEY,
                model: 'gemini-pro',
                maxTokens: 4000,
                temperature: 0.1
            })
        };
        
        this.fallbackOrder = ['openai', 'claude', 'gemini'];
        this.circuitBreaker = new CircuitBreaker();
        this.rateLimiter = new RateLimiter();
    }
    
    async generateReport(text, language = 'de', metadata = {}) {
        const startTime = Date.now();
        
        for (const providerName of this.fallbackOrder) {
            if (this.circuitBreaker.isOpen(providerName)) {
                continue; // Skip if circuit breaker is open
            }
            
            try {
                // Check rate limits
                await this.rateLimiter.checkLimit(providerName);
                
                const provider = this.providers[providerName];
                const prompt = this.buildPrompt(text, language, metadata);
                
                const result = await provider.generate(prompt);
                const parsedResult = this.parseResponse(result, language);
                
                // Add provider metadata
                parsedResult.metadata = {
                    aiGenerated: true,
                    aiProvider: providerName,
                    processingTime: Date.now() - startTime,
                    ...metadata
                };
                
                // Record success
                this.circuitBreaker.recordSuccess(providerName);
                
                return parsedResult;
                
            } catch (error) {
                console.log(`${providerName} failed: ${error.message}`);
                this.circuitBreaker.recordFailure(providerName);
                
                // Continue to next provider
                continue;
            }
        }
        
        throw new Error('All LLM providers failed');
    }
    
    buildPrompt(text, language, metadata) {
        const examinationType = metadata.examination_type || 'general';
        
        const prompts = {
            de: `Erstellen Sie einen VOLLSTÄNDIGEN strukturierten radiologischen Befund auf Deutsch.

WICHTIG: Übernehmen Sie ALLE Informationen aus der Transkription, kürzen Sie NICHTS.

Originaltext:
${text}

Struktur:
1. Klinische Angaben: [Indikation und Anamnese]
2. Technik: [Untersuchungstechnik und Parameter]
3. Befund: [Detaillierte Beschreibung aller Befunde]
4. Beurteilung: [Radiologische Interpretation]
5. Empfehlung: [Weitere Maßnahmen]

Anforderungen:
- Bewahren Sie alle medizinischen Details
- Verwenden Sie präzise medizinische Terminologie
- Strukturieren Sie den Befund logisch
- Fügen Sie keine Informationen hinzu, die nicht im Original stehen`,

            en: `Create a COMPLETE structured radiology report in English.

IMPORTANT: Include ALL information from the transcription, do not omit anything.

Original text:
${text}

Structure:
1. Clinical Information: [Indication and history]
2. Technique: [Examination technique and parameters]
3. Findings: [Detailed description of all findings]
4. Impression: [Radiological interpretation]
5. Recommendations: [Further measures]

Requirements:
- Preserve all medical details
- Use precise medical terminology
- Structure the report logically
- Do not add information not present in the original`
        };
        
        return prompts[language] || prompts.en;
    }
    
    parseResponse(response, language) {
        // Parse structured response from LLM
        const sections = this.extractSections(response, language);
        
        return {
            findings: sections.findings || sections.befund || '',
            impression: sections.impression || sections.beurteilung || '',
            recommendations: sections.recommendations || sections.empfehlung || '',
            technicalDetails: sections.technique || sections.technik || '',
            clinicalInfo: sections.clinical || sections.klinische || ''
        };
    }
}
```

### 4. Specialized Agent Architecture

#### Agent Base Class
```javascript
// agents/base-agent.js
class SpecializedAgent {
    constructor(type, multiLLMService = null) {
        this.type = type;
        this.name = `${type}_agent`;
        this.llmService = multiLLMService;
        this.datasetInsights = this.loadDatasetInsights();
    }
    
    loadDatasetInsights() {
        // Load insights from 189k report analysis
        return {
            sectionPrevalence: {
                indication: 0.891,    // 89.1% of reports have indication
                impression: 0.854,    // 85.4% have impression
                recommendations: 0.376, // 37.6% have recommendations
                findings: 0.360,      // 36.0% have findings
                technique: 0.341      // 34.1% have technique
            },
            medicalTermFrequency: {
                'mammakarzinom': 476,
                'lymphknoten': 466,
                'bronchialkarzinom': 78,
                'adenokarzinom': 60,
                'spondylchondrose': 45,
                'neuroforamenstenose': 22
                // ... more terms from dataset
            },
            modalityDistribution: {
                'ultrasound': 0.493,    // 49.3% ultrasound
                'mammography': 0.464,   // 46.4% mammography
                'mri': 0.323,          // 32.3% MRI
                'ct': 0.204            // 20.4% CT
            }
        };
    }
    
    async parseReport(reportText, language = 'de', metadata = {}) {
        const startTime = Date.now();
        
        try {
            // Try LLM first if available
            if (this.llmService) {
                const llmResult = await this.llmService.generateReport(
                    reportText, language, { ...metadata, examination_type: this.type }
                );
                
                // Enhance with agent-specific processing
                return this.enhanceResult(llmResult, reportText);
            } else {
                // Fallback to rule-based extraction
                return this.ruleBasedExtraction(reportText, language, metadata);
            }
            
        } catch (error) {
            console.log(`${this.name}: LLM failed, using rule-based extraction`);
            return this.ruleBasedExtraction(reportText, language, metadata);
        }
    }
    
    ruleBasedExtraction(text, language, metadata) {
        const sections = this.extractSections(text);
        const medicalTerms = this.extractMedicalTerms(text);
        
        return {
            type: this.type,
            findings: sections.findings || sections.befund || '',
            impression: sections.impression || sections.beurteilung || '',
            recommendations: sections.recommendations || sections.empfehlung || '',
            technicalDetails: sections.technical || sections.technik || '',
            medicalTerms: medicalTerms,
            sections: sections,
            metadata: {
                ...metadata,
                agent: this.name,
                language: language,
                aiGenerated: false,
                extractionMethod: 'rule-based'
            }
        };
    }
    
    extractSections(text) {
        // Enhanced section extraction based on dataset analysis
        const sections = {};
        
        const patterns = {
            // Indication patterns (89.1% prevalence)
            indication: [
                /(?:klinik\s*und\s*rechtfertigende\s*indikation(?:sstellung)?)[:\s]+([\s\S]*?)(?=technik|befund|beurteilung|$)/i,
                /(?:indikation)[:\s]+([\s\S]*?)(?=technik|befund|$)/i,
                /(?:fragestellung)[:\s]+([\s\S]*?)(?=technik|befund|$)/i
            ],
            // Technique patterns (34.1% prevalence)
            technical: [
                /(?:technik|technique|protokoll|untersuchungstechnik)[:\s]+([\s\S]*?)(?=befund|findings|beurteilung|$)/i,
                /(?:mrt|ct|mammographie|sonographie)\s+[^:]*vom\s+[^:]*:([\s\S]*?)(?=befund|beurteilung|$)/i
            ],
            // Findings patterns (36.0% prevalence)
            findings: [
                /(?:befund|findings?)[:\s]+([\s\S]*?)(?=beurteilung|impression|empfehlung|$)/i,
                /(?:mammographie|sonographie|hochfrequenzsonographie)[^:]*:([\s\S]*?)(?=beurteilung|empfehlung|$)/i
            ],
            // Impression patterns (85.4% prevalence - highest)
            impression: [
                /(?:beurteilung)[:\s]+([\s\S]*?)(?=empfehlung|recommendation|mit freundlichen|$)/i,
                /(?:impression|zusammenfassung)[:\s]+([\s\S]*?)(?=empfehlung|recommendation|$)/i,
                /(?:diagnose)[:\s]+([\s\S]*?)(?=empfehlung|therapie|$)/i
            ],
            // Recommendations patterns (37.6% prevalence)
            recommendations: [
                /(?:empfehlung)[:\s]+([\s\S]*?)(?=mit freundlichen|befundergänzung|$)/i,
                /(?:procedere|weiteres\s*vorgehen)[:\s]+([\s\S]*?)(?=mit freundlichen|$)/i,
                /(?:recommendation)[:\s]+([\s\S]*?)(?=mit freundlichen|$)/i
            ]
        };
        
        // Try multiple patterns for robustness
        for (const [section, patternList] of Object.entries(patterns)) {
            for (const pattern of patternList) {
                const match = text.match(pattern);
                if (match && match[1].trim()) {
                    sections[section] = this.cleanExtractedText(match[1]);
                    break; // Use first successful match
                }
            }
        }
        
        return sections;
    }
    
    extractMedicalTerms(text) {
        const lowerText = text.toLowerCase();
        const found = [];
        
        // High-frequency terms from dataset analysis
        const medicalTerms = [
            'mammakarzinom', 'lymphknoten', 'bronchialkarzinom', 'adenokarzinom',
            'prostatakarzinom', 'plattenepithelkarzinom', 'zweitkarzinom',
            'metastase', 'metastasen', 'tumor', 'zyste', 'zysten',
            'spondylchondrose', 'neuroforamenstenose', 'spinalkanalstenose',
            'bandscheibenvorfall', 'arthrose', 'osteoporose'
        ];
        
        for (const term of medicalTerms) {
            if (lowerText.includes(term)) {
                found.push(term);
            }
        }
        
        return [...new Set(found)]; // Remove duplicates
    }
    
    cleanExtractedText(text) {
        return text
            .trim()
            .replace(/\s+/g, ' ')          // Normalize whitespace
            .replace(/\s*:\s*/g, ': ')     // Clean colons
            .replace(/\s*\.\s*/g, '. ')    // Clean periods
            .replace(/\s*,\s*/g, ', ')     // Clean commas
            .replace(/^\s*-\s*/, '')       // Remove leading dashes
            .trim();
    }
}
```

---

## Data Flow Architecture

### Real-Time Audio Processing Flow

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│   Browser   │    │ WebSocket    │    │    VAD      │    │    Vosk      │
│   Audio     │───▶│   Proxy      │───▶│ Processor   │───▶│  Service     │
│  Capture    │    │              │    │             │    │              │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
                           │                                       │
                           ▼                                       ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│   React     │◀───│   Socket.IO  │◀───│ Transcription│◀───│ Speech-to-   │
│   Frontend  │    │   Events     │    │  Updates    │    │    Text      │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
```

### Report Generation Flow

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│Accumulated  │    │    Report    │    │    Report   │    │ Multi-LLM    │
│Transcription│───▶│ Orchestrator │───▶│ Classifier  │───▶│   Service    │
│    Text     │    │              │    │             │    │              │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
                           │                                       │
                           ▼                                       ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│   Structured│◀───│ Specialized  │◀───│   Agent     │◀───│   AI Model   │
│   Report    │    │    Agent     │    │ Selection   │    │  Response    │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
```

### Data Storage Flow

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│   Audio     │    │  Temporary   │    │  Automatic  │
│   Chunks    │───▶│   Buffer     │───▶│   Cleanup   │
│             │    │  (Memory)    │    │  (30 min)   │
└─────────────┘    └──────────────┘    └─────────────┘

┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│Transcription│    │  PostgreSQL  │    │   Backup    │
│   Results   │───▶│   Database   │───▶│  Storage    │
│             │    │              │    │   (S3)      │
└─────────────┘    └──────────────┘    └─────────────┘

┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│  Generated  │    │    Redis     │    │  Long-term  │
│   Reports   │───▶│   Cache      │───▶│  Archive    │
│             │    │ (Session)    │    │             │
└─────────────┘    └──────────────┘    └─────────────┘
```

---

## Integration Architecture

### EMR/PACS Integration

```
┌─────────────────────────────────────────────────────────────────┐
│                     EMR/PACS INTEGRATION                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────┐        │
│  │    Epic     │    │   Cerner     │    │   AllScripts│        │
│  │             │    │              │    │             │        │
│  └─────────────┘    └──────────────┘    └─────────────┘        │
│           │                 │                   │               │
│           ▼                 ▼                   ▼               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              HL7 FHIR Gateway                           │   │
│  │  • Patient ID Mapping                                  │   │
│  │  • Study Association                                   │   │
│  │  • Report Delivery                                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                 │
│                              ▼                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │            Radiology AI System API                     │   │
│  │  • Authentication & Authorization                      │   │
│  │  • Report Generation Triggers                          │   │
│  │  • Status Updates                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### API Integration Points

```javascript
// Integration API endpoints
const integrationRoutes = {
    // EMR Integration
    'POST /api/v1/integration/emr/patient': 'Link patient from EMR',
    'POST /api/v1/integration/emr/study': 'Associate with imaging study',
    'POST /api/v1/integration/emr/report': 'Send completed report to EMR',
    
    // PACS Integration  
    'GET /api/v1/integration/pacs/study/:id': 'Retrieve DICOM metadata',
    'POST /api/v1/integration/pacs/worklist': 'Get worklist items',
    'PUT /api/v1/integration/pacs/status/:id': 'Update study status',
    
    // Webhook Integration
    'POST /api/v1/webhooks/report-completed': 'Report completion notification',
    'POST /api/v1/webhooks/transcription-ready': 'Transcription ready notification',
    'POST /api/v1/webhooks/error-occurred': 'Error notification',
    
    // Real-time Integration
    'WS /api/v1/realtime/transcription': 'Live transcription feed',
    'WS /api/v1/realtime/status': 'System status updates',
    'WS /api/v1/realtime/metrics': 'Performance metrics stream'
};
```

---

## Security Architecture

### Security Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                        SECURITY LAYERS                          │
├─────────────────────────────────────────────────────────────────┤
│ 1. NETWORK SECURITY                                             │
│    ├── WAF (Web Application Firewall)                          │
│    ├── DDoS Protection                                         │
│    ├── TLS 1.3 Encryption                                      │
│    └── VPN/Private Networks                                    │
├─────────────────────────────────────────────────────────────────┤
│ 2. APPLICATION SECURITY                                         │
│    ├── OAuth 2.0 / SAML Authentication                         │
│    ├── JWT Token-based Authorization                           │
│    ├── Role-based Access Control (RBAC)                        │
│    └── API Rate Limiting                                       │
├─────────────────────────────────────────────────────────────────┤
│ 3. DATA SECURITY                                               │
│    ├── AES-256 Encryption at Rest                              │
│    ├── Field-level Encryption for PHI                          │
│    ├── Key Management Service (KMS)                            │
│    └── Data Loss Prevention (DLP)                              │
├─────────────────────────────────────────────────────────────────┤
│ 4. INFRASTRUCTURE SECURITY                                      │
│    ├── Container Security Scanning                             │
│    ├── Secrets Management                                      │
│    ├── Network Segmentation                                    │
│    └── Infrastructure as Code Security                         │
├─────────────────────────────────────────────────────────────────┤
│ 5. COMPLIANCE & AUDIT                                          │
│    ├── HIPAA Compliance Controls                               │
│    ├── GDPR Data Protection                                    │
│    ├── Audit Logging & Monitoring                              │
│    └── Compliance Reporting                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Authentication & Authorization Flow

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│    User     │    │    SSO/      │    │     JWT     │    │   Resource   │
│  (Browser)  │───▶│   Identity   │───▶│   Token     │───▶│   Server     │
│             │    │   Provider   │    │  Validation │    │              │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
       │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│Login Request│    │Authenticate  │    │Generate JWT │    │Authorize     │
│             │    │& Verify      │    │with Claims  │    │Request       │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
```

### Data Encryption Architecture

```javascript
// Encryption configuration
const encryptionConfig = {
    // Data at rest
    database: {
        encryption: 'AES-256-GCM',
        keyRotation: '90 days',
        provider: 'AWS KMS'
    },
    
    // Data in transit
    transport: {
        tls: '1.3',
        cipherSuites: [
            'TLS_AES_256_GCM_SHA384',
            'TLS_CHACHA20_POLY1305_SHA256'
        ],
        certificateProvider: 'Let\'s Encrypt'
    },
    
    // Application-level encryption
    application: {
        patientData: 'AES-256-GCM',
        audioData: 'ChaCha20-Poly1305',
        reportData: 'AES-256-GCM',
        keyDerivation: 'PBKDF2-SHA256'
    }
};
```

---

## Deployment Architecture

### Container Architecture

```dockerfile
# Multi-stage build for optimized images
FROM node:18-alpine AS frontend-build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci --only=production
COPY frontend/ ./
RUN npm run build

FROM nginx:alpine AS frontend
COPY --from=frontend-build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80

FROM node:18-alpine AS websocket-proxy
WORKDIR /app
COPY websocket-proxy/package*.json ./
RUN npm ci --only=production
COPY websocket-proxy/ ./
EXPOSE 8080
CMD ["node", "server.js"]

FROM python:3.11-slim AS vosk-service
WORKDIR /app
COPY vosk-service/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY vosk-service/ ./
COPY vosk-models/ ./vosk-models/
EXPOSE 8002
CMD ["python", "transcription-service-vosk.py"]
```

### Kubernetes Deployment

```yaml
# kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: radiology-ai-system
  labels:
    app: radiology-ai
spec:
  replicas: 3
  selector:
    matchLabels:
      app: radiology-ai
  template:
    metadata:
      labels:
        app: radiology-ai
    spec:
      containers:
      - name: websocket-proxy
        image: radiology-ai/websocket-proxy:v2.0
        ports:
        - containerPort: 8080
        env:
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: ai-secrets
              key: openai-key
        - name: CLAUDE_API_KEY
          valueFrom:
            secretKeyRef:
              name: ai-secrets
              key: claude-key
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
      
      - name: vosk-transcription
        image: radiology-ai/vosk-service:v2.0
        ports:
        - containerPort: 8002
        volumeMounts:
        - name: vosk-models
          mountPath: /app/vosk-models
          readOnly: true
        resources:
          requests:
            memory: "6Gi"
            cpu: "2000m"
          limits:
            memory: "8Gi"
            cpu: "4000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8003
          initialDelaySeconds: 60
          periodSeconds: 30
      
      volumes:
      - name: vosk-models
        persistentVolumeClaim:
          claimName: vosk-models-pvc
      
      nodeSelector:
        workload-type: compute-optimized
      
      tolerations:
      - key: "compute-optimized"
        operator: "Equal"
        value: "true"
        effect: "NoSchedule"
---
apiVersion: v1
kind: Service
metadata:
  name: radiology-ai-service
spec:
  selector:
    app: radiology-ai
  ports:
  - name: websocket
    port: 8080
    targetPort: 8080
  - name: transcription
    port: 8002
    targetPort: 8002
  type: LoadBalancer
```

### Infrastructure as Code (Terraform)

```hcl
# terraform/main.tf
provider "aws" {
  region = var.aws_region
}

# EKS Cluster
module "eks" {
  source = "terraform-aws-modules/eks/aws"
  
  cluster_name    = "radiology-ai-cluster"
  cluster_version = "1.28"
  
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets
  
  # Compute optimized nodes for Vosk processing
  node_groups = {
    compute_optimized = {
      desired_capacity = 3
      max_capacity     = 10
      min_capacity     = 2
      
      instance_types = ["c5.2xlarge"]
      
      k8s_labels = {
        workload-type = "compute-optimized"
      }
      
      taints = [
        {
          key    = "compute-optimized"
          value  = "true"
          effect = "NO_SCHEDULE"
        }
      ]
    }
    
    general_purpose = {
      desired_capacity = 2
      max_capacity     = 5
      min_capacity     = 1
      
      instance_types = ["m5.large", "m5.xlarge"]
    }
  }
}

# RDS PostgreSQL for reports
resource "aws_db_instance" "reports_db" {
  identifier = "radiology-ai-reports"
  
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = "db.r6g.large"
  
  allocated_storage     = 100
  max_allocated_storage = 1000
  storage_encrypted     = true
  
  db_name  = "radiology_reports"
  username = var.db_username
  password = var.db_password
  
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.reports.name
  
  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  deletion_protection = true
  
  tags = {
    Name = "Radiology AI Reports DB"
  }
}

# ElastiCache Redis for session management
resource "aws_elasticache_replication_group" "session_store" {
  replication_group_id       = "radiology-ai-sessions"
  description                = "Redis cluster for session management"
  
  port                       = 6379
  parameter_group_name       = "default.redis7"
  node_type                  = "cache.r6g.large"
  num_cache_clusters         = 2
  
  subnet_group_name          = aws_elasticache_subnet_group.sessions.name
  security_group_ids         = [aws_security_group.redis.id]
  
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  
  automatic_failover_enabled = true
  multi_az_enabled          = true
  
  tags = {
    Name = "Radiology AI Session Store"
  }
}

# S3 buckets for model storage and backups
resource "aws_s3_bucket" "model_storage" {
  bucket = "radiology-ai-models-${random_id.bucket_suffix.hex}"
  
  tags = {
    Name = "Radiology AI Model Storage"
  }
}

resource "aws_s3_bucket_versioning" "model_storage" {
  bucket = aws_s3_bucket.model_storage.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_encryption" "model_storage" {
  bucket = aws_s3_bucket.model_storage.id
  
  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256"
      }
    }
  }
}
```

---

## Performance Architecture

### Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Speech-to-Text Latency** | < 1.5 seconds | End-to-end audio to text |
| **Report Generation Time** | < 5 seconds | Full report with AI processing |
| **System Availability** | 99.9% | Monthly uptime |
| **API Response Time** | < 200ms | 95th percentile |
| **Concurrent Users** | 1000+ | Active transcription sessions |
| **Throughput** | 500 reports/hour | Peak capacity per instance |

### Performance Optimization Strategies

#### 1. Audio Processing Optimization
```python
# Optimized audio buffer management
class OptimizedAudioBuffer:
    def __init__(self, sample_rate=16000, max_buffer_seconds=4):
        self.sample_rate = sample_rate
        self.max_buffer_size = sample_rate * max_buffer_seconds
        self.buffer = np.zeros(self.max_buffer_size, dtype=np.int16)
        self.write_pos = 0
        self.read_pos = 0
        
    def write(self, audio_data):
        """Write audio data with circular buffer optimization"""
        data_len = len(audio_data)
        
        if self.write_pos + data_len <= self.max_buffer_size:
            # Simple write - no wraparound
            self.buffer[self.write_pos:self.write_pos + data_len] = audio_data
        else:
            # Handle wraparound
            first_part = self.max_buffer_size - self.write_pos
            self.buffer[self.write_pos:] = audio_data[:first_part]
            self.buffer[:data_len - first_part] = audio_data[first_part:]
            
        self.write_pos = (self.write_pos + data_len) % self.max_buffer_size
    
    def read_chunk(self, chunk_size):
        """Read optimized chunk for processing"""
        if self.write_pos >= self.read_pos:
            available = self.write_pos - self.read_pos
        else:
            available = self.max_buffer_size - self.read_pos + self.write_pos
        
        if available >= chunk_size:
            chunk = np.zeros(chunk_size, dtype=np.int16)
            
            if self.read_pos + chunk_size <= self.max_buffer_size:
                chunk = self.buffer[self.read_pos:self.read_pos + chunk_size]
            else:
                # Handle wraparound
                first_part = self.max_buffer_size - self.read_pos
                chunk[:first_part] = self.buffer[self.read_pos:]
                chunk[first_part:] = self.buffer[:chunk_size - first_part]
            
            self.read_pos = (self.read_pos + chunk_size) % self.max_buffer_size
            return chunk
        
        return None
```

#### 2. Connection Pool Management
```javascript
// Optimized connection pooling for LLM services
class OptimizedConnectionPool {
    constructor(maxConnections = 20, idleTimeout = 30000) {
        this.pools = {
            openai: new ConnectionPool({
                max: maxConnections,
                min: 2,
                idleTimeoutMillis: idleTimeout,
                acquireTimeoutMillis: 5000,
                createTimeoutMillis: 3000,
                destroyTimeoutMillis: 5000,
                reapIntervalMillis: 1000,
                createRetryIntervalMillis: 200
            }),
            claude: new ConnectionPool({
                max: Math.floor(maxConnections * 0.6), // Claude has stricter limits
                min: 1,
                idleTimeoutMillis: idleTimeout,
                acquireTimeoutMillis: 5000
            }),
            gemini: new ConnectionPool({
                max: maxConnections,
                min: 2,
                idleTimeoutMillis: idleTimeout,
                acquireTimeoutMillis: 5000
            })
        };
        
        this.metrics = {
            totalRequests: 0,
            activeConnections: 0,
            averageResponseTime: 0,
            errorRate: 0
        };
        
        this.setupMetricsCollection();
    }
    
    async acquireConnection(provider) {
        const startTime = Date.now();
        
        try {
            const connection = await this.pools[provider].acquire();
            this.metrics.activeConnections++;
            this.metrics.totalRequests++;
            
            return {
                connection,
                release: () => {
                    this.pools[provider].release(connection);
                    this.metrics.activeConnections--;
                    
                    // Update response time metrics
                    const responseTime = Date.now() - startTime;
                    this.updateAverageResponseTime(responseTime);
                }
            };
        } catch (error) {
            this.metrics.errorRate = (this.metrics.errorRate * 0.9) + (0.1 * 1);
            throw error;
        }
    }
    
    updateAverageResponseTime(responseTime) {
        this.metrics.averageResponseTime = 
            (this.metrics.averageResponseTime * 0.9) + (responseTime * 0.1);
    }
}
```

#### 3. Caching Strategy
```javascript
// Multi-level caching for optimal performance
class MultiLevelCache {
    constructor() {
        // L1: In-memory cache (fastest, limited size)
        this.l1Cache = new LRUCache({
            max: 1000,
            ttl: 1000 * 60 * 5 // 5 minutes
        });
        
        // L2: Redis cache (fast, shared across instances)
        this.l2Cache = new Redis({
            host: process.env.REDIS_HOST,
            port: process.env.REDIS_PORT,
            retryDelayOnFailover: 100,
            maxRetriesPerRequest: 3
        });
        
        // L3: Database cache (slower, persistent)
        this.l3Cache = new DatabaseCache();
    }
    
    async get(key) {
        // Try L1 cache first
        let value = this.l1Cache.get(key);
        if (value !== undefined) {
            this.recordCacheHit('l1');
            return value;
        }
        
        // Try L2 cache (Redis)
        value = await this.l2Cache.get(key);
        if (value !== null) {
            // Populate L1 cache
            this.l1Cache.set(key, value);
            this.recordCacheHit('l2');
            return JSON.parse(value);
        }
        
        // Try L3 cache (Database)
        value = await this.l3Cache.get(key);
        if (value !== null) {
            // Populate L1 and L2 caches
            const serialized = JSON.stringify(value);
            this.l1Cache.set(key, value);
            await this.l2Cache.setex(key, 300, serialized); // 5 minutes TTL
            this.recordCacheHit('l3');
            return value;
        }
        
        this.recordCacheMiss();
        return null;
    }
    
    async set(key, value, ttl = 300) {
        // Set in all cache levels
        this.l1Cache.set(key, value);
        await this.l2Cache.setex(key, ttl, JSON.stringify(value));
        await this.l3Cache.set(key, value, ttl);
    }
    
    recordCacheHit(level) {
        this.metrics[`${level}_hits`] = (this.metrics[`${level}_hits`] || 0) + 1;
    }
    
    recordCacheMiss() {
        this.metrics.misses = (this.metrics.misses || 0) + 1;
    }
}
```

---

## Scalability Architecture

### Horizontal Scaling Strategy

```yaml
# Auto-scaling configuration
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: radiology-ai-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: radiology-ai-system
  minReplicas: 3
  maxReplicas: 50
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: websocket_connections_per_pod
      target:
        type: AverageValue
        averageValue: "50"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
      - type: Pods
        value: 4
        periodSeconds: 15
      selectPolicy: Max
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
```

### Database Scaling Strategy

```sql
-- Read replicas for report queries
CREATE EXTENSION IF NOT EXISTS postgres_fdw;

-- Partition reports table by date for better performance
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id VARCHAR(50) NOT NULL,
    report_type VARCHAR(50) NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    content JSONB NOT NULL,
    metadata JSONB
) PARTITION BY RANGE (generated_at);

-- Monthly partitions
CREATE TABLE reports_2025_01 PARTITION OF reports
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE reports_2025_02 PARTITION OF reports
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- Indexes for optimal query performance
CREATE INDEX CONCURRENTLY idx_reports_patient_date ON reports (patient_id, generated_at DESC);
CREATE INDEX CONCURRENTLY idx_reports_type_date ON reports (report_type, generated_at DESC);
CREATE INDEX CONCURRENTLY idx_reports_content_gin ON reports USING GIN (content);

-- Connection pooling configuration
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '2GB';
ALTER SYSTEM SET effective_cache_size = '6GB';
ALTER SYSTEM SET work_mem = '32MB';
ALTER SYSTEM SET maintenance_work_mem = '256MB';
```

### Load Balancing Configuration

```nginx
# nginx.conf for load balancing
upstream websocket_backend {
    least_conn;
    server radiology-ai-1:8080 max_fails=3 fail_timeout=30s;
    server radiology-ai-2:8080 max_fails=3 fail_timeout=30s;
    server radiology-ai-3:8080 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

upstream api_backend {
    least_conn;
    server radiology-ai-1:8081 max_fails=3 fail_timeout=30s;
    server radiology-api-2:8081 max_fails=3 fail_timeout=30s;
    server radiology-api-3:8081 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name radiology-ai.example.com;
    
    # SSL configuration
    ssl_certificate /etc/ssl/certs/radiology-ai.crt;
    ssl_certificate_key /etc/ssl/private/radiology-ai.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256;
    
    # WebSocket proxy with sticky sessions
    location /socket.io/ {
        proxy_pass http://websocket_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Sticky sessions for WebSocket connections
        ip_hash;
        
        # Timeouts for long-running connections
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
    
    # API proxy
    location /api/ {
        proxy_pass http://api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # API timeouts
        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
    
    # Static file serving with caching
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

---

## Disaster Recovery

### Backup Strategy

```yaml
# Automated backup configuration
apiVersion: batch/v1
kind: CronJob
metadata:
  name: database-backup
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: pg-dump
            image: postgres:15
            command:
            - /bin/bash
            - -c
            - |
              pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME \
                --verbose --no-password --format=custom \
                --compress=9 --file=/backup/backup-$(date +%Y%m%d_%H%M%S).sql
              
              # Upload to S3
              aws s3 cp /backup/backup-$(date +%Y%m%d_%H%M%S).sql \
                s3://radiology-ai-backups/database/
              
              # Cleanup local files older than 7 days
              find /backup -name "backup-*.sql" -mtime +7 -delete
            env:
            - name: DB_HOST
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: host
            - name: DB_USER
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: username
            - name: DB_NAME
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: database
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: password
            volumeMounts:
            - name: backup-storage
              mountPath: /backup
          volumes:
          - name: backup-storage
            emptyDir: {}
          restartPolicy: OnFailure
```

### Recovery Procedures

```bash
#!/bin/bash
# disaster-recovery.sh

set -e

BACKUP_DATE=${1:-$(date +%Y%m%d)}
BACKUP_BUCKET="s3://radiology-ai-backups"
TEMP_DIR="/tmp/recovery"

echo "Starting disaster recovery for date: $BACKUP_DATE"

# 1. Create temporary directory
mkdir -p $TEMP_DIR

# 2. Download database backup
echo "Downloading database backup..."
aws s3 cp $BACKUP_BUCKET/database/backup-${BACKUP_DATE}_*.sql $TEMP_DIR/

# 3. Download model files
echo "Downloading model files..."
aws s3 sync $BACKUP_BUCKET/models/ $TEMP_DIR/models/

# 4. Stop current services
echo "Stopping current services..."
kubectl scale deployment radiology-ai-system --replicas=0

# 5. Restore database
echo "Restoring database..."
DB_BACKUP=$(ls $TEMP_DIR/backup-${BACKUP_DATE}_*.sql | head -1)
pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME --clean --verbose $DB_BACKUP

# 6. Restore model files
echo "Restoring model files..."
kubectl delete pvc vosk-models-pvc --ignore-not-found
kubectl apply -f kubernetes/pvc-vosk-models.yaml
kubectl cp $TEMP_DIR/models/ $(kubectl get pods -l job-name=model-restore -o jsonpath='{.items[0].metadata.name}'):/models/

# 7. Restart services
echo "Restarting services..."
kubectl scale deployment radiology-ai-system --replicas=3

# 8. Verify system health
echo "Verifying system health..."
sleep 60
kubectl rollout status deployment radiology-ai-system
curl -f http://radiology-ai.example.com/health

# 9. Run integration tests
echo "Running integration tests..."
npm test -- --grep "integration"

# 10. Cleanup
rm -rf $TEMP_DIR

echo "Disaster recovery completed successfully!"
```

---

## Architecture Decisions

### 1. Technology Selection Decisions

| Decision | Rationale | Alternatives Considered | Trade-offs |
|----------|-----------|------------------------|------------|
| **Vosk for Speech Recognition** | Offline processing, German language support, medical terminology accuracy | Google Speech-to-Text, Azure Speech, AWS Transcribe | Lower cloud costs vs. potentially lower accuracy than cloud services |
| **Multi-LLM Architecture** | Redundancy, cost optimization, performance comparison | Single LLM provider | Complexity vs. reliability and cost control |
| **WebSocket over HTTP** | Real-time bidirectional communication needed | Server-Sent Events, Long Polling | Connection complexity vs. real-time performance |
| **PostgreSQL over NoSQL** | ACID compliance for medical data, complex queries | MongoDB, DynamoDB | SQL complexity vs. data consistency requirements |
| **Kubernetes over VMs** | Container orchestration, auto-scaling, resource efficiency | Traditional VMs, Docker Swarm | Learning curve vs. operational benefits |

### 2. Architecture Pattern Decisions

| Pattern | Implementation | Justification |
|---------|----------------|---------------|
| **Microservices** | Speech, AI, Orchestration as separate services | Independent scaling, technology diversity, fault isolation |
| **Event-Driven** | WebSocket events for real-time communication | Low latency, real-time user experience |
| **Circuit Breaker** | LLM service failure handling | Graceful degradation, system resilience |
| **CQRS** | Separate read/write models for reports | Read optimization, write consistency |
| **Saga Pattern** | Report generation workflow | Distributed transaction management |

### 3. Security Architecture Decisions

| Decision | Implementation | Rationale |
|----------|----------------|-----------|
| **Zero Trust Network** | All communication encrypted, authenticated | HIPAA compliance, data protection |
| **JWT for Authentication** | Stateless tokens with short expiry | Scalability, security |
| **Field-Level Encryption** | PHI encrypted at application level | Regulatory compliance, data protection |
| **Audit Logging** | Comprehensive access and modification logs | Compliance requirements, forensics |
| **Key Rotation** | Automated 90-day key rotation | Security best practices, compromise mitigation |

### 4. Performance Architecture Decisions

| Decision | Rationale | Impact |
|----------|-----------|--------|
| **In-Memory Audio Buffering** | Minimize disk I/O for real-time processing | Reduced latency, higher memory usage |
| **Connection Pooling** | Reuse expensive LLM connections | Better throughput, resource efficiency |
| **Multi-Level Caching** | Optimize for different access patterns | Improved response times, complexity |
| **Horizontal Auto-Scaling** | Handle variable load efficiently | Cost optimization, availability |
| **Database Partitioning** | Improve query performance on large datasets | Better performance, operational complexity |

### 5. Data Architecture Decisions

| Decision | Implementation | Justification |
|----------|----------------|---------------|
| **Report Versioning** | JSONB with version tracking | Audit requirements, data evolution |
| **Audio Data Retention** | 30-minute temporary storage | Privacy compliance, processing needs |
| **Model Storage** | S3 with versioning | Version control, disaster recovery |
| **Metrics Collection** | Prometheus + Grafana | Observability, performance monitoring |
| **Backup Strategy** | Daily automated backups to S3 | Business continuity, compliance |

---

## Conclusion

This architecture document provides a comprehensive overview of the Real-Time Radiology AI System's design, covering all aspects from high-level system architecture to detailed implementation decisions. The architecture is designed to be:

- **Scalable**: Handle growth from small practices to large hospital systems
- **Reliable**: 99.9% uptime with comprehensive error handling and recovery
- **Secure**: HIPAA/GDPR compliant with defense-in-depth security
- **Performant**: Sub-2-second response times with real-time processing
- **Maintainable**: Clean separation of concerns with comprehensive monitoring

The system leverages modern cloud-native technologies while maintaining the flexibility to deploy on-premise for organizations with specific security or compliance requirements.

---

*Document Version: 2.0*  
*Last Updated: January 31, 2025*  
*Next Review: April 30, 2025*

---

*Confidential and Proprietary - Medical AI Solutions GmbH 2025*