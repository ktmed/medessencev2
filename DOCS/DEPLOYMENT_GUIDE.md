# MedEssenceAI - Deployment Guide
**Version**: 1.0  
**Date**: August 18, 2025  
**Live URL**: https://fresh-deploy-murex.vercel.app/

---

## 1. Current Deployment Status

### 1.1 Production Environment Overview
- **Frontend**: Successfully deployed to Vercel
- **Backend**: Currently local development only (needs cloud deployment)
- **Database**: Local PostgreSQL (needs cloud database)
- **AI Services**: Multi-LLM with API keys configured
- **WebSocket**: Connectivity issues on production (local works)

### 1.2 Working Components
✅ **Frontend Application**: Full React/Next.js app deployed  
✅ **Static Assets**: Medical dictionaries, UI components  
✅ **Client-side Features**: Speech recognition, UI interactions  
❌ **Backend Services**: Not deployed to production  
❌ **Database**: No cloud database configured  
❌ **WebSocket**: No real-time communication in production  

---

## 2. Vercel Deployment Configuration

### 2.1 Current Setup
The frontend is auto-deployed to Vercel through GitHub integration:

```
Repository: Connected to GitHub
Branch: main (auto-deploy)
Build Command: npm run build
Output Directory: .next
Install Command: npm install
```

### 2.2 Vercel Configuration Files

#### 2.2.1 Environment Variables (Vercel Dashboard)
Required environment variables in Vercel dashboard:
```bash
NEXT_PUBLIC_BACKEND_URL=https://your-backend-url.com
NEXT_PUBLIC_WEBSOCKET_URL=wss://your-websocket-url.com
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key  
GOOGLE_API_KEY=your_google_key
```

#### 2.2.2 Next.js Configuration
File: `/frontend/next.config.js`
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingRoot: undefined,
  },
  webpack: (config) => {
    // Audio file handling for voice features
    config.module.rules.push({
      test: /\.(mp3|wav|ogg)$/,
      use: {
        loader: 'file-loader',
        options: {
          publicPath: '/_next/static/sounds/',
          outputPath: 'static/sounds/',
        },
      },
    });
    return config;
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'microphone=self'
          }
        ]
      }
    ];
  }
};

module.exports = nextConfig;
```

### 2.3 Deployment Commands

#### 2.3.1 Manual Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to production
cd frontend
vercel --prod
```

#### 2.3.2 Auto-Deploy Process
```bash
# Current auto-deploy workflow
git add .
git commit -m "Update feature"
git push origin main
# → Triggers automatic Vercel deployment
```

---

## 3. Backend Deployment Strategy

### 3.1 Current Backend Architecture
```
backend/
├── src/
│   ├── server.js           # Main Express server
│   ├── routes/             # API endpoints
│   ├── middleware/         # Security, auth, logging
│   ├── database/           # PostgreSQL connection
│   └── websocket/          # Socket.IO implementation
├── Dockerfile              # Container configuration
└── docker-compose.yml     # Local development
```

### 3.2 Cloud Deployment Options

#### 3.2.1 Option A: Railway (Recommended)
Railway provides simple Node.js deployment with PostgreSQL:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway add postgresql
railway deploy
```

**Railway Configuration**:
- **Service**: Node.js backend from /backend directory
- **Database**: PostgreSQL with automatic backups
- **Environment**: Production environment variables
- **Domain**: Custom domain or railway.app subdomain

#### 3.2.2 Option B: Heroku
```bash
# Heroku deployment
heroku create medessence-backend
heroku addons:create heroku-postgresql:mini
git subtree push --prefix backend heroku main
```

#### 3.2.3 Option C: AWS ECS + RDS
```bash
# Docker build for AWS
docker build -t medessence-backend ./backend
docker tag medessence-backend:latest your-ecr-repo/medessence-backend:latest
docker push your-ecr-repo/medessence-backend:latest
```

### 3.3 Environment Variables for Backend
```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db
POSTGRES_PASSWORD=secure_password

# AI Services
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...

# Security
JWT_SECRET=your-jwt-secret-key
CORS_ORIGIN=https://fresh-deploy-murex.vercel.app

# WebSocket
WEBSOCKET_PORT=8080
SOCKET_IO_ORIGIN=https://fresh-deploy-murex.vercel.app
```

---

## 4. Database Deployment

### 4.1 PostgreSQL Cloud Options

#### 4.1.1 Supabase (Recommended)
```bash
# Supabase setup
npm install -g supabase
supabase init
supabase db push
```

#### 4.1.2 Railway PostgreSQL
```bash
# Included with Railway deployment
railway add postgresql
# Automatic DATABASE_URL configuration
```

#### 4.1.3 Neon PostgreSQL
```bash
# Serverless PostgreSQL
# Sign up at neon.tech
# Get connection string: postgresql://...@ep-...neon.tech/neondb
```

### 4.2 Database Schema Migration
```bash
# Using Prisma for schema management
cd backend
npx prisma generate
npx prisma db push
npx prisma db seed  # Optional seed data
```

---

## 5. Full Stack Deployment Workflow

### 5.1 Complete Deployment Steps

#### Step 1: Backend Deployment
```bash
# 1. Choose cloud provider (Railway recommended)
railway init

# 2. Configure PostgreSQL
railway add postgresql

# 3. Set environment variables
railway variables set OPENAI_API_KEY=your_key
railway variables set ANTHROPIC_API_KEY=your_key
railway variables set GOOGLE_API_KEY=your_key
railway variables set JWT_SECRET=your_secret
railway variables set CORS_ORIGIN=https://fresh-deploy-murex.vercel.app

# 4. Deploy backend
railway deploy
```

#### Step 2: Update Frontend Configuration
```bash
# Update Vercel environment variables
# In Vercel dashboard, add:
NEXT_PUBLIC_BACKEND_URL=https://your-railway-app.railway.app
NEXT_PUBLIC_WEBSOCKET_URL=wss://your-railway-app.railway.app
```

#### Step 3: Redeploy Frontend
```bash
# Trigger Vercel rebuild with new environment variables
git commit --allow-empty -m "Update backend URLs"
git push origin main
```

### 5.2 Post-Deployment Verification

#### 5.2.1 Health Check URLs
```bash
# Backend health check
curl https://your-backend-url.com/api/health

# Frontend access
open https://fresh-deploy-murex.vercel.app

# WebSocket test (in browser console)
const socket = io('wss://your-backend-url.com');
socket.on('connect', () => console.log('Connected!'));
```

#### 5.2.2 Feature Testing Checklist
- [ ] Frontend loads without errors
- [ ] Voice recording works (microphone permissions)
- [ ] WebSocket connection established
- [ ] AI report generation functional
- [ ] Export functionality works
- [ ] All UI components render correctly

---

## 6. CI/CD Pipeline Setup

### 6.1 GitHub Actions Workflow
Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      # Vercel auto-deploys via GitHub integration
      
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Railway
        run: |
          npm install -g @railway/cli
          railway login --token ${{ secrets.RAILWAY_TOKEN }}
          railway up --detach
```

### 6.2 Environment Secrets
Configure in GitHub repository settings:
- `RAILWAY_TOKEN`: Railway deployment token
- `VERCEL_TOKEN`: Vercel deployment token (if needed)

---

## 7. Monitoring & Maintenance

### 7.1 Health Monitoring
```bash
# Backend monitoring endpoints
GET /api/health              # General health
GET /api/health/database     # Database connectivity  
GET /api/health/llm          # AI services status
GET /api/health/transcription # Speech services
```

### 7.2 Logging Strategy
- **Frontend**: Browser console + Vercel Function logs
- **Backend**: Structured logging to cloud provider logs
- **Database**: Query performance monitoring
- **AI Services**: API usage tracking and error rates

### 7.3 Backup Strategy
```bash
# Database backups (automated by cloud provider)
# Code backups (Git repository)
# Configuration backups (environment variable documentation)
```

---

## 8. Troubleshooting

### 8.1 Common Deployment Issues

#### 8.1.1 WebSocket Connection Failures
**Symptom**: "Connected" status not showing in frontend  
**Cause**: Backend WebSocket service not deployed  
**Solution**: Deploy backend with WebSocket support to cloud provider

#### 8.1.2 API Endpoint 404 Errors
**Symptom**: Frontend can't reach backend APIs  
**Cause**: Incorrect `NEXT_PUBLIC_BACKEND_URL` configuration  
**Solution**: Update Vercel environment variables with correct backend URL

#### 8.1.3 Database Connection Errors
**Symptom**: Backend fails to start with DB connection error  
**Cause**: Invalid `DATABASE_URL` or database not accessible  
**Solution**: Verify cloud database configuration and connection string

#### 8.1.4 Build Failures
**Symptom**: Vercel build fails  
**Cause**: Missing dependencies or environment variables  
**Solution**: Check build logs, verify package.json and environment config

### 8.2 Performance Issues
```bash
# Frontend performance
lighthouse https://fresh-deploy-murex.vercel.app

# Backend performance  
curl -w "@curl-format.txt" -s -o /dev/null https://your-backend-url.com/api/health

# Database performance
# Monitor query execution times in cloud provider dashboard
```

### 8.3 Recovery Procedures
```bash
# Rollback deployment (if needed)
vercel --prod --force  # Force redeploy previous version
railway rollback       # Rollback backend deployment

# Emergency recovery
git revert HEAD        # Revert problematic commit
git push origin main   # Trigger new deployment
```

---

## 9. Security Considerations

### 9.1 Production Security Checklist
- [ ] HTTPS enforced on all endpoints
- [ ] CORS properly configured for production domains
- [ ] API keys stored as environment variables (not in code)
- [ ] Database credentials secured
- [ ] JWT secrets properly configured
- [ ] Rate limiting enabled
- [ ] Security headers configured

### 9.2 Environment Variable Security
```bash
# Never commit to repository:
.env*
.env.local
.env.production

# Use cloud provider secret management:
# Vercel: Environment Variables dashboard
# Railway: railway variables set KEY=value
```

---

## 10. Cost Optimization

### 10.1 Current Costs (Estimated)
- **Vercel**: Free tier (upgrade to Pro if needed: $20/month)
- **Railway**: $5/month + usage for PostgreSQL
- **AI APIs**: Variable based on usage (OpenAI, Claude, Gemini)
- **Total**: ~$25-50/month for production deployment

### 10.2 Scaling Considerations
- **Vercel Edge Functions**: Auto-scaling frontend
- **Railway**: Container auto-scaling
- **Database**: Connection pooling for efficiency
- **AI APIs**: Implement caching to reduce API calls

---

**Next Steps**:
1. Choose backend deployment platform (Railway recommended)
2. Set up cloud PostgreSQL database
3. Deploy backend services
4. Update frontend environment variables
5. Test complete end-to-end functionality
6. Set up monitoring and alerting
7. Document production URLs and credentials

---

**Deployment Support**:  
For deployment assistance or issues, create GitHub issue with deployment logs.