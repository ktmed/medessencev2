# MedEssenceAI - Heroku Deployment Steps
**Date**: August 18, 2025

## ✅ Prerequisites Complete
- [x] Heroku CLI installed
- [x] Procfile created for backend
- [x] Package.json configured with proper start script

## 🚀 Step-by-Step Deployment

### 1. Complete Heroku Login
```bash
heroku login
# Follow browser authentication
heroku auth:whoami  # Verify login
```

### 2. Create Heroku Application
```bash
cd backend
heroku create medessence-backend
```

### 3. Add PostgreSQL Database
```bash
heroku addons:create heroku-postgresql:mini -a medessence-backend
# This automatically sets DATABASE_URL environment variable
```

### 4. Add Redis Cache
```bash
heroku addons:create heroku-redis:mini -a medessence-backend  
# This automatically sets REDIS_URL environment variable
```

### 5. Set Environment Variables
```bash
# AI API Keys (replace with your actual keys)
heroku config:set OPENAI_API_KEY=sk-your-openai-key -a medessence-backend
heroku config:set ANTHROPIC_API_KEY=sk-ant-your-anthropic-key -a medessence-backend
heroku config:set GOOGLE_API_KEY=AIza-your-google-key -a medessence-backend

# JWT Configuration
heroku config:set JWT_SECRET=$(openssl rand -base64 64) -a medessence-backend
heroku config:set JWT_REFRESH_SECRET=$(openssl rand -base64 64) -a medessence-backend

# CORS Configuration
heroku config:set CORS_ORIGIN=https://fresh-deploy-murex.vercel.app -a medessence-backend

# Node.js Configuration
heroku config:set NODE_ENV=production -a medessence-backend
heroku config:set NPM_CONFIG_PRODUCTION=false -a medessence-backend

# Logging
heroku config:set LOG_LEVEL=info -a medessence-backend
```

### 6. Deploy to Heroku
```bash
# Initialize git in backend directory (if not already done)
git init
git add .
git commit -m "Initial backend deployment"

# Add Heroku remote
heroku git:remote -a medessence-backend

# Deploy to Heroku
git push heroku main
```

### 7. Run Database Migration
```bash
# The Procfile will automatically run: npx prisma migrate deploy
# But you can also run manually:
heroku run npx prisma migrate deploy -a medessence-backend
heroku run npx prisma generate -a medessence-backend
```

### 8. Verify Deployment
```bash
# Check app status
heroku ps -a medessence-backend

# Check logs
heroku logs --tail -a medessence-backend

# Test health endpoint
curl https://medessence-backend.herokuapp.com/health
```

## 🔧 Update Vercel Environment Variables

### After successful Heroku deployment:

1. **Get Heroku App URL**:
```bash
heroku info -a medessence-backend | grep "Web URL"
# Should show: https://medessence-backend.herokuapp.com/
```

2. **Update Vercel Dashboard**:
   - Go to: https://vercel.com/dashboard
   - Select your project: fresh-deploy-murex
   - Go to Settings → Environment Variables
   - Add/Update these variables:

```env
NEXT_PUBLIC_BACKEND_URL=https://medessence-backend.herokuapp.com
NEXT_PUBLIC_WEBSOCKET_URL=wss://medessence-backend.herokuapp.com
```

3. **Redeploy Vercel Frontend**:
```bash
# In main project directory (not backend)
git commit --allow-empty -m "Update backend URLs for Heroku"
git push origin main
# This triggers automatic Vercel redeployment
```

## 🧪 Testing Complete System

### 1. Test Backend Health
```bash
curl https://medessence-backend.herokuapp.com/api/health
# Expected: {"status":"ok","timestamp":"...","version":"1.0.0"}
```

### 2. Test Frontend Connection
- Open: https://fresh-deploy-murex.vercel.app/
- Should show "Connected" status (green)
- Test voice recording and report generation

### 3. Test WebSocket Connection
In browser console on frontend:
```javascript
// Should see WebSocket connection established
console.log('WebSocket status:', socket.connected);
```

## 🔍 Troubleshooting

### Common Issues:

**1. Build Failures**
```bash
# Check build logs
heroku logs --tail -a medessence-backend

# Common fix: Ensure all dependencies in package.json
npm install
git add package*.json
git commit -m "Update dependencies"
git push heroku main
```

**2. Database Connection Issues**
```bash
# Check DATABASE_URL is set
heroku config -a medessence-backend | grep DATABASE_URL

# Run migration manually
heroku run npx prisma migrate deploy -a medessence-backend
```

**3. Environment Variable Issues**
```bash
# List all config vars
heroku config -a medessence-backend

# Set missing variables
heroku config:set VARIABLE_NAME=value -a medessence-backend
```

**4. Port Issues**
```bash
# Heroku automatically sets PORT, but verify server.js uses process.env.PORT
# File: backend/src/server.js should have:
# const port = process.env.PORT || 3000;
```

## 📊 Expected Results

After successful deployment:

✅ **Backend**: https://medessence-backend.herokuapp.com/  
✅ **Database**: PostgreSQL connected and migrated  
✅ **Cache**: Redis connected  
✅ **WebSocket**: Real-time communication working  
✅ **Frontend**: Connected to backend, all features working  

### Performance Expectations:
- **Health Check**: <200ms response time
- **API Endpoints**: <2s response time  
- **WebSocket**: Real-time connection
- **Database**: <500ms query time

## 💰 Cost Estimate

**Heroku Costs (Monthly)**:
- Web Dyno: $7/month (Eco dyno)
- PostgreSQL: $9/month (Mini plan)  
- Redis: $15/month (Mini plan)
- **Total**: ~$31/month

**Free Tier Options** (with limitations):
- Use free tier initially for testing
- Upgrade to paid plans for production

## 🚀 Next Steps After Deployment

1. **Test all features end-to-end**
2. **Set up monitoring and alerts**
3. **Configure custom domain** (optional)
4. **Set up CI/CD pipeline** for automated deployments
5. **Performance optimization** based on usage patterns

---

**Ready to execute these steps!** 🎯  
Once you complete Heroku login, we'll run through this deployment process.