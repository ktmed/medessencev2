# 🧠 GGUF Models Testing Plan for RadExtract
## Safe Testing of Multiple Local Models for Medical Report Generation

---

## 🎯 Testing Objectives

1. **Safety First**: Test models without system crashes (learned from Ollama experience)
2. **Performance Comparison**: Benchmark different GGUF models for medical reports
3. **Quality Assessment**: Evaluate German medical terminology and structure
4. **Resource Optimization**: Find best quality/performance balance
5. **Integration Validation**: Ensure smooth RadExtract integration

## 📋 Testing Phases

### Phase 1: GPT-OSS-20B Validation ✅
**Status**: Ready to test  
**Safety Script**: `./scripts/safe-test-gpt-oss.sh`

**What it does**:
- ✅ Pre-flight system resource validation  
- ✅ Safe model download with progress monitoring
- ✅ Resource monitoring during initialization
- ✅ Emergency stop procedures
- ✅ Fallback verification to cloud APIs

### Phase 2: Ollama GGUF Model Survey 🔄  
**Status**: Ready to test  
**Testing Script**: `./scripts/test-gguf-models.sh`

## 🧪 Models Selected for Testing

### Medical Specialist Models
| Model | Size | Focus | Expected Quality |
|-------|------|-------|------------------|
| `meditron:7b` | 7B | Medical domain specialist | ⭐⭐⭐⭐⭐ |
| `medllama2:7b` | 7B | Medical Q&A focused | ⭐⭐⭐⭐ |

### High Reasoning Models  
| Model | Size | Focus | Expected Quality |
|-------|------|-------|------------------|
| `deepseek-r1:7b` | 7B | Advanced reasoning | ⭐⭐⭐⭐⭐ |
| `deepseek-r1:14b` | 14B | Superior reasoning | ⭐⭐⭐⭐⭐ |
| `cogito:8b` | 8B | Hybrid reasoning | ⭐⭐⭐⭐ |
| `orca2:7b` | 7B | Microsoft research | ⭐⭐⭐⭐ |

### General Purpose High Quality
| Model | Size | Focus | Expected Quality |
|-------|------|-------|------------------|
| `llama3.1:8b` | 8B | Latest Meta model | ⭐⭐⭐⭐⭐ |
| `qwen2.5:7b` | 7B | Multilingual support | ⭐⭐⭐⭐ |
| `gemma2:9b` | 9B | Google model | ⭐⭐⭐⭐ |
| `mistral:7b` | 7B | Instruction following | ⭐⭐⭐⭐ |

### Efficient Models
| Model | Size | Focus | Expected Quality |
|-------|------|-------|------------------|
| `phi3.5:3.8b` | 3.8B | Microsoft efficient | ⭐⭐⭐ |
| `gemma2:2b` | 2B | Lightweight capable | ⭐⭐⭐ |

## 🛡️ Safety Measures

### Pre-Testing Validation
- ✅ **RAM Check**: 8GB+ total, 4GB+ available
- ✅ **Disk Space**: 50GB+ for multiple models
- ✅ **CPU Cores**: 4+ recommended
- ✅ **System Load**: < 70% before testing

### During Testing Protection
- ✅ **Resource Monitoring**: Real-time RAM/CPU tracking
- ✅ **Timeout Protection**: 5-minute max per model test
- ✅ **Emergency Stop**: Ctrl+C handler with cleanup
- ✅ **Progressive Loading**: Test smaller models first

### Post-Testing Cleanup
- ✅ **Model Management**: Option to remove failed models
- ✅ **Disk Space Recovery**: Cleanup temporary files
- ✅ **System Restoration**: Ensure clean state

## 📊 Testing Metrics

### Performance Benchmarks
- **Model Loading Time**: Target < 30 seconds
- **First Generation**: Target < 15 seconds  
- **Subsequent Generations**: Target < 8 seconds
- **Memory Usage**: Monitor peak RAM consumption
- **CPU Utilization**: Track average load during generation

### Quality Assessment
- **German Medical Terms**: Proper terminology usage
- **Report Structure**: Technik, Befund, Beurteilung, Empfehlung
- **Medical Accuracy**: Factual consistency with input
- **Language Quality**: Natural German text flow
- **JSON Compatibility**: Structured output parsing

### Integration Compatibility  
- **RadExtract API**: Seamless integration with Multi-LLM service
- **Fallback Behavior**: Graceful failure to cloud APIs
- **Concurrency**: Multiple request handling
- **Stability**: No memory leaks or crashes

## 🚀 Testing Execution Plan

### Step 1: System Preparation
```bash
# Check current system state
free -h && df -h . && uptime

# Ensure clean Docker state  
docker system prune -f

# Backup current configuration
cp .env .env.backup
```

### Step 2: GPT-OSS-20B Testing
```bash
# Run safe GPT-OSS test
./scripts/safe-test-gpt-oss.sh

# Monitor results
docker logs radiology-ai-system-websocket-proxy-1 | grep GPT-OSS

# Test via frontend
open http://localhost:3000
```

### Step 3: Ollama GGUF Survey
```bash
# Install Ollama if needed
curl -fsSL https://ollama.com/install.sh | sh

# Run comprehensive model testing
./scripts/test-gguf-models.sh

# Review results
cat ./gguf-test-results/model-comparison-*.json
```

### Step 4: Performance Analysis
```bash
# Compare generation times
grep -o '"generation_time": [0-9.]*' ./gguf-test-results/*.json

# Check quality scores
grep -o '"quality_score": [0-9]*' ./gguf-test-results/*.json

# Identify best performers
sort -n ./gguf-test-results/*.json | head -5
```

## 📈 Expected Results Matrix

### Resource Requirements
| Model Category | RAM Usage | Generation Time | Quality Score |
|---------------|-----------|-----------------|---------------|
| Medical (7B) | 6-8GB | 5-10s | 4-5/5 |
| Reasoning (7-14B) | 8-12GB | 8-15s | 4-5/5 |
| General (7-9B) | 6-10GB | 6-12s | 3-4/5 |
| Efficient (2-4B) | 3-5GB | 3-6s | 2-3/5 |

### Recommended Configuration
Based on testing, we'll identify:
1. **Best Overall**: Quality + Performance balance
2. **Best Medical**: Highest medical accuracy
3. **Most Efficient**: Fastest with acceptable quality
4. **Most Reliable**: Most stable during long sessions

## 🎯 Integration Priority

Post-testing, the Multi-LLM service priority will be:
```
1. 🥇 GPT-OSS-20B (if available)
2. 🥈 Best Ollama Model (from testing)
3. 🥉 Claude API (cloud fallback)
4. 4️⃣ OpenAI API (cloud fallback)
5. 5️⃣ Gemini API (cloud fallback)
```

## 🔍 Success Criteria

### Phase 1 (GPT-OSS) Success
- [ ] Downloads without system crash
- [ ] Initializes within 60 seconds
- [ ] Generates German medical reports
- [ ] Response time < 10 seconds
- [ ] No memory leaks after 10 generations

### Phase 2 (Ollama Survey) Success  
- [ ] Tests at least 8 different models
- [ ] No system crashes during testing
- [ ] Identifies 3+ viable models
- [ ] Documents performance characteristics
- [ ] Provides clear recommendation

### Overall Success
- [ ] RadExtract has 2+ high-quality local models
- [ ] Complete offline processing capability
- [ ] Reliable fallback to cloud APIs
- [ ] Improved privacy for medical data
- [ ] No degradation of existing functionality

## 🚨 Emergency Procedures

### If System Becomes Unresponsive
```bash
# Emergency stop sequence
docker-compose down --remove-orphans
killall ollama
killall node
pkill -f "python.*vosk"

# System recovery
free && sync
docker system prune -f
```

### If Models Cause Crashes
```bash
# Remove problematic models
ollama list | grep [MODEL_NAME] && ollama rm [MODEL_NAME]

# Clear Docker caches
docker system prune -a -f

# Restore to Production Baseline v2.0
./.production-restore.sh
```

## 📚 Documentation Outputs

### Test Reports Generated
1. **`gguf-test-results/model-comparison-[timestamp].json`** - Raw test data
2. **`gguf-test-results/model-comparison-report-[timestamp].md`** - Human readable report
3. **Performance benchmarks** - Speed and quality metrics
4. **Resource usage profiles** - Memory and CPU consumption
5. **Integration recommendations** - Best models for RadExtract

### Model Selection Guide
Based on results, we'll create:
- **Production recommendations** for different hardware specs
- **Development configurations** for different use cases  
- **Fallback strategies** for different scenarios
- **Performance tuning guides** for optimal settings

---

## 🎉 Ready to Test!

Both testing frameworks are ready:

### Quick GPT-OSS Test
```bash
./scripts/safe-test-gpt-oss.sh
```

### Comprehensive GGUF Survey  
```bash
./scripts/test-gguf-models.sh
```

**Let's start with the safe GPT-OSS test to validate our approach, then move to the comprehensive Ollama survey!** 🚀