#!/bin/bash

# MedEssenceAI - Heroku Deployment Script
# This script will deploy the backend to Heroku with all required configuration

set -e  # Exit on any error

echo "🚀 Starting MedEssenceAI Backend Deployment to Heroku..."

# Check if we're in the backend directory
if [[ ! -f "package.json" ]]; then
    echo "❌ Error: Please run this script from the backend directory"
    exit 1
fi

# Check if Heroku CLI is installed and logged in
if ! command -v heroku &> /dev/null; then
    echo "❌ Error: Heroku CLI is not installed"
    exit 1
fi

echo "✅ Checking Heroku authentication..."
if ! heroku auth:whoami &> /dev/null; then
    echo "❌ Error: Not logged into Heroku. Please run 'heroku login' first"
    exit 1
fi

echo "✅ Heroku authentication confirmed"

# Step 1: Create Heroku application
echo "📱 Creating Heroku application..."
APP_NAME="medessence-backend"
if heroku apps:info $APP_NAME &> /dev/null; then
    echo "⚠️  App $APP_NAME already exists. Using existing app."
else
    heroku create $APP_NAME
    echo "✅ Created Heroku app: $APP_NAME"
fi

# Step 2: Add PostgreSQL database
echo "🗄️  Adding PostgreSQL database..."
if heroku addons:info heroku-postgresql --app $APP_NAME &> /dev/null; then
    echo "⚠️  PostgreSQL addon already exists"
else
    heroku addons:create heroku-postgresql:mini --app $APP_NAME
    echo "✅ PostgreSQL database added"
fi

# Step 3: Add Redis cache
echo "💾 Adding Redis cache..."
if heroku addons:info heroku-redis --app $APP_NAME &> /dev/null; then
    echo "⚠️  Redis addon already exists"
else
    heroku addons:create heroku-redis:mini --app $APP_NAME
    echo "✅ Redis cache added"
fi

# Step 4: Set environment variables
echo "🔧 Setting environment variables..."

# AI API Keys (set these manually in Heroku dashboard or use environment variables)
# heroku config:set OPENAI_API_KEY=your_openai_key_here --app $APP_NAME
# heroku config:set ANTHROPIC_API_KEY=your_anthropic_key_here --app $APP_NAME
# heroku config:set GOOGLE_API_KEY=your_google_key_here --app $APP_NAME
echo "⚠️  IMPORTANT: Set your AI API keys manually in Heroku dashboard"
echo "   Go to: https://dashboard.heroku.com/apps/$APP_NAME/settings"
echo "   Add config vars: OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY"

# JWT Configuration (generate secure random keys)
heroku config:set JWT_SECRET=$(openssl rand -base64 64) --app $APP_NAME
heroku config:set JWT_REFRESH_SECRET=$(openssl rand -base64 64) --app $APP_NAME

# CORS Configuration (for Vercel frontend)
heroku config:set CORS_ORIGINS=https://fresh-deploy-murex.vercel.app,https://fresh-deploy-murex.vercel.app/ --app $APP_NAME

# Node.js Configuration
heroku config:set NODE_ENV=production --app $APP_NAME
heroku config:set NPM_CONFIG_PRODUCTION=false --app $APP_NAME
heroku config:set LOG_LEVEL=info --app $APP_NAME

# AI Provider Configuration
heroku config:set AI_PROVIDER_PRIORITY=claude,gemini,openai --app $APP_NAME
heroku config:set CLAUDE_MODEL=claude-3-haiku-20240307 --app $APP_NAME
heroku config:set OPENAI_MODEL=gpt-4-1106-preview --app $APP_NAME
heroku config:set GEMINI_MODEL=gemini-2.5-pro --app $APP_NAME

# Medical AI Configuration
heroku config:set DEFAULT_LANGUAGE=de --app $APP_NAME
heroku config:set SUPPORTED_LANGUAGES=de,en,tr,fr,es,it --app $APP_NAME
heroku config:set ENABLE_MEDICAL_VALIDATION=true --app $APP_NAME
heroku config:set ENABLE_ICD_CODING=true --app $APP_NAME
heroku config:set ENABLE_STRUCTURED_FINDINGS=true --app $APP_NAME

# Application settings
heroku config:set APP_NAME="MedEssence AI Gateway" --app $APP_NAME
heroku config:set API_VERSION=v1 --app $APP_NAME

echo "✅ Environment variables configured"

# Step 5: Initialize git repository (if not already done)
if [[ ! -d ".git" ]]; then
    echo "📝 Initializing git repository..."
    git init
    git add .
    git commit -m "Initial backend deployment to Heroku"
    echo "✅ Git repository initialized"
else
    echo "✅ Git repository already exists"
    # Add any new files and commit
    git add .
    if ! git diff --cached --quiet; then
        git commit -m "Updates for Heroku deployment - $(date)"
        echo "✅ Committed recent changes"
    else
        echo "✅ No new changes to commit"
    fi
fi

# Step 6: Add Heroku remote
echo "🔗 Adding Heroku remote..."
if git remote | grep -q heroku; then
    git remote remove heroku
fi
heroku git:remote --app $APP_NAME
echo "✅ Heroku remote added"

# Step 7: Deploy to Heroku
echo "🚀 Deploying to Heroku..."
git push heroku main
echo "✅ Deployment completed"

# Step 8: Run database migration
echo "🗄️  Running database migration..."
heroku run npx prisma migrate deploy --app $APP_NAME
heroku run npx prisma generate --app $APP_NAME
echo "✅ Database migration completed"

# Step 9: Verify deployment
echo "🔍 Verifying deployment..."
sleep 10  # Wait for app to start

APP_URL="https://$APP_NAME.herokuapp.com"
echo "🌐 App URL: $APP_URL"

# Test health endpoint
if curl -f --silent "$APP_URL/api/health" > /dev/null; then
    echo "✅ Health check passed"
else
    echo "⚠️  Health check failed - checking logs..."
    heroku logs --tail --app $APP_NAME
fi

# Show app status
echo "📊 App Status:"
heroku ps --app $APP_NAME

echo ""
echo "🎉 DEPLOYMENT COMPLETE!"
echo ""
echo "📝 Next Steps:"
echo "1. Update Vercel environment variables:"
echo "   NEXT_PUBLIC_BACKEND_URL=$APP_URL"
echo "   NEXT_PUBLIC_WEBSOCKET_URL=wss://${APP_NAME}.herokuapp.com"
echo ""
echo "2. Test your deployment:"
echo "   curl $APP_URL/api/health"
echo ""
echo "3. View logs:"
echo "   heroku logs --tail --app $APP_NAME"
echo ""
echo "4. Open app in browser:"
echo "   heroku open --app $APP_NAME"
echo ""

echo "✨ Your MedEssenceAI backend is now live at: $APP_URL"