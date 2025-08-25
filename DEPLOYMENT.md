# MedEssenceAI Production Deployment Guide

This guide provides step-by-step instructions for deploying MedEssenceAI in a production environment.

## 🏗️ Architecture Overview

```
Internet → Nginx (SSL/Proxy) → Frontend (Next.js) → WebSocket Proxy → Core Services
                             → API Routes                            → WebSpeech API
                                                                     → Multi-LLM Services
                                                                     → PostgreSQL
                                                                     → Redis
```

## 🚀 Quick Production Deployment

### Prerequisites

1. **Server Requirements**:
   - Ubuntu 20.04+ / CentOS 8+ / RHEL 8+
   - 16GB RAM minimum (32GB recommended)
   - 100GB SSD storage minimum
   - 4 CPU cores minimum (8 cores recommended)
   - Docker 20.10+ and Docker Compose 2.0+

2. **Network Requirements**:
   - Ports 80 (HTTP) and 443 (HTTPS) open
   - Domain name pointing to server IP
   - SSL certificate (Let's Encrypt recommended)

3. **API Keys Required**:
   - OpenAI API key
   - Claude (Anthropic) API key  
   - Google Gemini API key

### Step 1: Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.12.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Logout and login to apply group changes
```

### Step 2: Clone and Configure

```bash
# Clone repository
git clone <repository-url> medessenceai-production
cd medessenceai-production

# Copy environment template
cp .env.production.example .env.production

# Edit configuration (see Environment Configuration below)
nano .env.production
```

### Step 3: Environment Configuration

Edit `.env.production` with your actual values:

```bash
# API Keys (REQUIRED)
OPENAI_API_KEY=sk-your-actual-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-actual-claude-key-here  
GOOGLE_API_KEY=your-actual-gemini-key-here

# Database Passwords (CHANGE THESE!)
POSTGRES_PASSWORD=YourSecurePostgresPassword123!
REDIS_PASSWORD=YourSecureRedisPassword456!

# Domain Configuration
DOMAIN_NAME=your-actual-domain.com

# SSL Certificate Paths
SSL_CERT_PATH=/etc/ssl/certs/your-domain.crt
SSL_KEY_PATH=/etc/ssl/private/your-domain.key

# JWT Secret (Generate a secure random string)
JWT_SECRET=your-very-secure-jwt-secret-key-here-64-chars-minimum
```

### Step 4: SSL Certificate Setup

#### Option A: Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt install certbot

# Get certificate
sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com

# Copy certificates to project
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ssl/your-domain.crt
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ssl/your-domain.key
sudo chown $USER:$USER ssl/*
```

#### Option B: Custom Certificate

```bash
# Copy your certificate files
mkdir -p ssl
cp /path/to/your/certificate.crt ssl/your-domain.crt
cp /path/to/your/private.key ssl/your-domain.key
chmod 600 ssl/your-domain.key
chmod 644 ssl/your-domain.crt
```

### Step 5: Deploy Application

```bash
# Make deployment script executable
chmod +x scripts/deploy-production.sh

# Run deployment
./scripts/deploy-production.sh
```

The deployment script will:
- Validate configuration
- Build Docker images
- Start all services
- Perform health checks
- Show deployment status

### Step 6: Verify Deployment

```bash
# Check service status
docker-compose -f docker-compose.production.yml ps

# Check logs
docker-compose -f docker-compose.production.yml logs -f

# Test endpoints
curl -f https://your-domain.com/health
curl -f https://your-domain.com/api/health
```

## 🔧 Service Management

### Starting Services

```bash
# Start all services
docker-compose -f docker-compose.production.yml up -d

# Start specific service
docker-compose -f docker-compose.production.yml up -d websocket-proxy

# Start with monitoring
docker-compose -f docker-compose.production.yml --profile monitoring up -d
```

### Stopping Services

```bash
# Stop all services
docker-compose -f docker-compose.production.yml down

# Stop and remove volumes (careful!)
docker-compose -f docker-compose.production.yml down -v
```

### Scaling Services

```bash
# Scale WebSocket proxy for high load
docker-compose -f docker-compose.production.yml up -d --scale websocket-proxy=3

# Scale backend service for concurrent API requests
docker-compose -f docker-compose.production.yml up -d --scale backend=2
```

### Viewing Logs

```bash
# All services
docker-compose -f docker-compose.production.yml logs -f

# Specific service
docker-compose -f docker-compose.production.yml logs -f websocket-proxy

# Last 100 lines
docker-compose -f docker-compose.production.yml logs --tail=100
```

## 🔄 Updates and Maintenance

### Rolling Updates

```bash
# Pull latest images
docker-compose -f docker-compose.production.yml pull

# Rebuild custom images
docker-compose -f docker-compose.production.yml build --no-cache

# Rolling restart
docker-compose -f docker-compose.production.yml up -d --force-recreate --no-deps service-name
```

### Database Maintenance

```bash
# Backup database
./scripts/backup-system.sh

# Access PostgreSQL
docker-compose -f docker-compose.production.yml exec postgres psql -U medessenceai_user -d medessenceai_production

# Access Redis
docker-compose -f docker-compose.production.yml exec redis redis-cli
```

## 📊 Monitoring and Alerts

### Access Monitoring Dashboards

- **Grafana**: https://your-domain.com:3001
- **Prometheus**: https://your-domain.com:9090
- **Application Health**: https://your-domain.com/health

### Enable Monitoring

```bash
# Start with monitoring profile
docker-compose -f docker-compose.production.yml --profile monitoring up -d

# View monitoring services
docker-compose -f docker-compose.production.yml --profile monitoring ps
```

### Set Up Alerts

1. Configure email settings in `.env.production`
2. Customize alert rules in `docker/prometheus/alert.rules.yml`
3. Set up notification channels in Grafana

## 🔒 Security Considerations

### Firewall Configuration

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443

# Allow monitoring (restrict to admin IPs)
sudo ufw allow from YOUR_ADMIN_IP to any port 3001
sudo ufw allow from YOUR_ADMIN_IP to any port 9090

# Enable firewall
sudo ufw enable
```

### Regular Security Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Docker images
docker-compose -f docker-compose.production.yml pull
docker-compose -f docker-compose.production.yml up -d --force-recreate
```

### Backup Strategy

```bash
# Set up automated backups (cron job)
crontab -e

# Add this line for daily backups at 2 AM
0 2 * * * /path/to/medessenceai-production/scripts/backup-system.sh >/dev/null 2>&1
```

## 🆘 Troubleshooting

### Common Issues

#### Services Won't Start

```bash
# Check Docker daemon
sudo systemctl status docker

# Check for port conflicts
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :443

# Check system resources
free -h
df -h
```

#### Database Connection Issues

```bash
# Check database status
docker-compose -f docker-compose.production.yml exec postgres pg_isready

# View database logs
docker-compose -f docker-compose.production.yml logs postgres

# Reset database (WARNING: Data loss!)
docker-compose -f docker-compose.production.yml down
docker volume rm medessenceai-production_postgres-data
docker-compose -f docker-compose.production.yml up -d
```

#### SSL Certificate Issues

```bash
# Test SSL certificate
openssl s_client -connect your-domain.com:443 -servername your-domain.com

# Check certificate expiration
openssl x509 -in ssl/your-domain.crt -noout -dates

# Renew Let's Encrypt certificate
sudo certbot renew
```

#### Performance Issues

```bash
# Monitor resource usage
docker stats

# Check service health
curl -f https://your-domain.com/health

# View detailed logs
docker-compose -f docker-compose.production.yml logs --timestamps
```

### Getting Support

1. **Check logs first**: Always start with service logs
2. **GitHub Issues**: Report technical issues
3. **Documentation**: Check [docs.medessenceai.com](https://docs.medessenceai.com)
4. **Email Support**: support@medessenceai.com

## 📚 Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Nginx Configuration Guide](https://nginx.org/en/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)

---

**Production Deployment Checklist** ✅

- [ ] Server meets minimum requirements
- [ ] Docker and Docker Compose installed
- [ ] Domain name configured and DNS updated
- [ ] SSL certificates obtained and configured
- [ ] Environment file configured with real values
- [ ] API keys added and verified
- [ ] Database passwords changed from defaults
- [ ] Firewall configured properly
- [ ] Monitoring enabled and configured
- [ ] Backup strategy implemented
- [ ] Health checks passing
- [ ] Application accessible via HTTPS

**Remember**: Always test in a staging environment first!