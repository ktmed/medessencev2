# Radiology AI System - Production Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the Radiology AI System in a production environment, specifically designed for German medical facilities with strict compliance requirements.

## Table of Contents

- [System Requirements](#system-requirements)
- [Pre-deployment Setup](#pre-deployment-setup)
- [Installation Process](#installation-process)
- [Configuration](#configuration)
- [Security Setup](#security-setup)
- [Monitoring and Logging](#monitoring-and-logging)
- [Backup and Recovery](#backup-and-recovery)
- [Maintenance](#maintenance)
- [Compliance](#compliance)
- [Troubleshooting](#troubleshooting)

## System Requirements

### Hardware Specifications

#### Minimum Requirements
- **CPU**: 8 cores (Intel Xeon or AMD EPYC recommended)
- **RAM**: 16 GB DDR4
- **Storage**: 500 GB SSD (NVMe preferred)
- **Network**: 1 Gbps connection

#### Recommended Requirements (Production)
- **CPU**: 16+ cores (Intel Xeon or AMD EPYC)
- **RAM**: 32+ GB DDR4 ECC
- **Storage**: 1+ TB NVMe SSD with RAID 1
- **Network**: 10 Gbps connection
- **Backup Storage**: Additional 2+ TB for backups

### Software Requirements

#### Operating System
- **Primary**: Ubuntu 22.04 LTS (recommended)
- **Alternative**: RHEL 8/9, CentOS Stream 9, Debian 12

#### Container Runtime
- **Docker**: Version 24.0+ (Docker CE recommended)
- **Docker Compose**: Version 2.20+

### Network Requirements
- **Ports**: 80 (HTTP), 443 (HTTPS), 22 (SSH)
- **Internal Communication**: Docker networks (172.20.0.0/16, 172.21.0.0/16)
- **Firewall**: Configured to allow only necessary traffic
- **SSL/TLS**: Valid certificates for HTTPS

## Pre-deployment Setup

### 1. System Preparation

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl wget git jq bc openssl

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker $USER
```

### 2. Security Hardening

```bash
# Configure firewall
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Set up fail2ban
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Configure automatic security updates
sudo apt install -y unattended-upgrades
echo 'Unattended-Upgrade::Automatic-Reboot "false";' | sudo tee /etc/apt/apt.conf.d/50unattended-upgrades
```

### 3. Create Deployment User

```bash
# Create dedicated user for the application
sudo useradd -m -s /bin/bash radiology-ai
sudo usermod -aG docker radiology-ai

# Create necessary directories
sudo mkdir -p /opt/radiology-ai
sudo chown radiology-ai:radiology-ai /opt/radiology-ai
```

## Installation Process

### 1. Clone Repository

```bash
# Switch to deployment user
su - radiology-ai

# Clone the repository
cd /opt
git clone <repository-url> radiology-ai
cd radiology-ai

# Verify repository integrity
git verify-commit HEAD  # If GPG signing is used
```

### 2. Run Setup Script

```bash
# Make setup script executable
chmod +x scripts/setup-deployment.sh

# Run the setup with medical compliance options
./scripts/setup-deployment.sh

# Review generated configuration
cat .env
```

### 3. Configure Environment

Edit the `.env` file with your specific settings:

```bash
# Copy and edit environment configuration
cp .env.template .env
nano .env
```

Key configurations to update:

```bash
# Domain and URLs
DOMAIN=your-medical-domain.com
FRONTEND_API_URL=https://your-medical-domain.com
FRONTEND_WS_URL=wss://your-medical-domain.com

# OpenAI API Configuration
OPENAI_API_KEY=sk-your-openai-api-key

# Email notifications
SMTP_HOST=smtp.your-hospital.com
SMTP_USERNAME=radiology-ai@your-hospital.com
SMTP_PASSWORD=your-secure-smtp-password
EMAIL_FROM=radiology-ai@your-hospital.com
```

### 4. SSL Certificate Setup

#### Option A: Let's Encrypt (Recommended for internet-facing deployments)

```bash
# Install certbot
sudo apt install -y certbot

# Obtain certificate
sudo certbot certonly --standalone -d your-medical-domain.com

# Copy certificates to application directory
sudo cp /etc/letsencrypt/live/your-medical-domain.com/fullchain.pem docker/nginx/ssl/radiology-ai.crt
sudo cp /etc/letsencrypt/live/your-medical-domain.com/privkey.pem docker/nginx/ssl/radiology-ai.key
sudo chown radiology-ai:radiology-ai docker/nginx/ssl/*
```

#### Option B: Custom CA Certificate (For internal deployments)

```bash
# Replace generated self-signed certificates with your CA-signed certificates
cp your-certificate.crt docker/nginx/ssl/radiology-ai.crt
cp your-private-key.key docker/nginx/ssl/radiology-ai.key
cp your-ca-chain.crt docker/nginx/ssl/radiology-ai-chain.crt
```

### 5. Database Initialization

```bash
# Initialize database schema
./scripts/migrate-db.sh

# Verify database setup
./scripts/health-check.sh --service postgres
```

### 6. Deploy Application

```bash
# Deploy the complete system
./scripts/deploy.sh

# Verify deployment
./scripts/health-check.sh --detailed

# Check all services are running
docker-compose ps
```

## Configuration

### Service Configuration

#### 1. Nginx (Reverse Proxy)
- **Configuration**: `docker/nginx/nginx.conf`
- **SSL Settings**: `docker/nginx/conf.d/radiology-ai.conf`
- **Security Headers**: Already configured for medical compliance

#### 2. PostgreSQL Database
- **Configuration**: `docker/postgres/postgresql.conf`
- **Authentication**: `docker/postgres/pg_hba.conf`
- **Optimized for**: Medical data processing and German locale

#### 3. Redis Cache
- **Configuration**: `docker/redis/redis.conf`
- **Persistence**: AOF enabled for medical data integrity
- **Security**: Password protected with renamed commands

### Monitoring Configuration

#### 1. Prometheus
- **Configuration**: `docker/prometheus/prometheus.yml`
- **Alert Rules**: `docker/prometheus/alert.rules.yml`
- **Recording Rules**: `docker/prometheus/recording.rules.yml`

#### 2. Grafana
- **Dashboards**: Pre-configured medical system dashboards
- **Data Sources**: Prometheus, Loki, PostgreSQL
- **Access**: https://your-domain.com/grafana

#### 3. Loki + Promtail
- **Log Aggregation**: `docker/loki/loki-config.yml`
- **Log Collection**: `docker/promtail/promtail-config.yml`
- **Compliance**: Configured for German medical data retention

## Security Setup

### 1. Network Security

```bash
# Configure Docker networks
docker network create radiology-ai-system_radiology-network --subnet=172.20.0.0/16
docker network create radiology-ai-system_monitoring --subnet=172.21.0.0/16
```

### 2. Data Encryption

- **At Rest**: Database and Redis data encryption
- **In Transit**: TLS 1.3 for all communications
- **Backup Encryption**: GPG encryption for sensitive backups

### 3. Access Control

```bash
# Set up proper file permissions
chmod 600 .env
chmod 600 docker/nginx/ssl/*.key
chmod 755 scripts/*.sh

# Configure log rotation with appropriate permissions
sudo cp /etc/logrotate.d/radiology-ai /etc/logrotate.d/
```

### 4. Medical Data Protection (GDPR/German MDR Compliance)

- **Data Anonymization**: Enabled in production logs
- **Audit Logging**: Comprehensive audit trail for all medical data access
- **Retention Policies**: 30-year retention for medical data
- **Access Logging**: All medical data access is logged and monitored

## Monitoring and Logging

### 1. System Monitoring

Access monitoring dashboards:
- **Grafana**: https://your-domain.com/grafana
- **Prometheus**: https://your-domain.com/prometheus (restricted access)

### 2. Health Checks

```bash
# Perform health checks
./scripts/health-check.sh --detailed

# Continuous monitoring
./scripts/health-check.sh --continuous --interval 60

# Service-specific checks
./scripts/health-check.sh --service backend
```

### 3. Log Management

```bash
# View application logs
./scripts/logs.sh

# View specific service logs
./scripts/logs.sh backend

# Search logs for medical events
./scripts/logs.sh --medical --since "1 hour ago"

# Export compliance logs
./scripts/logs.sh --compliance --export json
```

### 4. Alerting

Configure alerting channels in Grafana:

1. **Email Alerts**: For system failures
2. **Slack Integration**: For team notifications
3. **SMS Alerts**: For critical medical system failures

## Backup and Recovery

### 1. Automated Backups

```bash
# Configure automated daily backups
crontab -e

# Add the following line for daily backups at 2 AM
0 2 * * * /opt/radiology-ai/scripts/backup.sh --type full --encrypt --retention

# Weekly full backups
0 2 * * 0 /opt/radiology-ai/scripts/backup.sh --type full --encrypt --remote --retention
```

### 2. Manual Backup

```bash
# Create full system backup
./scripts/backup.sh --type full --encrypt --verify

# Database-only backup
./scripts/backup.sh --type database --encrypt

# Medical compliance backup
./scripts/backup.sh --type medical --encrypt --output /secure/medical-backups
```

### 3. Recovery Procedures

```bash
# Restore from backup
./scripts/restore.sh --backup /path/to/backup/directory

# Restore specific component
./scripts/restore.sh --backup /path/to/backup --type database

# Test recovery (dry run)
./scripts/restore.sh --backup /path/to/backup --dry-run
```

## Maintenance

### 1. Regular Maintenance Tasks

#### Daily
- Monitor system health via Grafana dashboards
- Review error logs and alerts
- Verify backup completion

#### Weekly
- Update Docker images (if security updates available)
- Review system performance metrics
- Test backup recovery procedures

#### Monthly
- Update SSL certificates (if needed)
- Review and update security configurations
- Performance optimization review

### 2. System Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Docker images
docker-compose pull
./scripts/restart.sh --rebuild

# Update application code
git pull
./scripts/deploy.sh
```

### 3. Database Maintenance

```bash
# Run database maintenance
./scripts/migrate-db.sh validate

# Optimize database performance
docker-compose exec postgres psql -U meduser -d radiology_db -c "VACUUM ANALYZE;"

# Check database integrity
docker-compose exec postgres psql -U meduser -d radiology_db -c "SELECT * FROM pg_stat_user_tables;"
```

## Compliance

### German Medical Device Regulation (MDR) Compliance

1. **Data Protection**: All patient data is encrypted and access-controlled
2. **Audit Trail**: Complete audit logging for all medical data operations
3. **Data Retention**: 30-year retention policy as required by German law
4. **Access Control**: Role-based access with medical professional verification
5. **System Validation**: Comprehensive testing and validation procedures

### GDPR Compliance

1. **Data Minimization**: Only necessary medical data is collected
2. **Right to Erasure**: Procedures for data deletion upon request
3. **Data Portability**: Export capabilities for patient data
4. **Consent Management**: Patient consent tracking and management
5. **Breach Notification**: Automated alerting for potential data breaches

### Documentation Requirements

Maintain the following documentation:
- System architecture and data flow diagrams
- Risk assessment and mitigation plans
- User access logs and audit reports
- Backup and recovery test records
- Incident response procedures

## Performance Optimization

### 1. Database Optimization

```bash
# Optimize PostgreSQL settings
docker-compose exec postgres psql -U meduser -d radiology_db -c "
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats 
WHERE schemaname = 'public'
ORDER BY n_distinct DESC;
"
```

### 2. Resource Monitoring

```bash
# Monitor resource usage
docker stats

# Check disk usage
df -h

# Monitor memory usage
free -h

# Check system load
uptime
```

### 3. Performance Tuning

Adjust resource limits in `docker-compose.yml`:

```yaml
deploy:
  resources:
    limits:
      memory: 2G
      cpus: '1.0'
    reservations:
      memory: 1G
      cpus: '0.5'
```

## Disaster Recovery

### 1. Backup Strategy

- **Local Backups**: Daily encrypted backups to local storage
- **Remote Backups**: Weekly encrypted backups to secure cloud storage
- **Offsite Backups**: Monthly backups to physically separate location

### 2. Recovery Time Objectives (RTO)

- **Critical System Failure**: 4 hours maximum downtime
- **Database Corruption**: 2 hours maximum recovery time
- **Complete System Loss**: 24 hours maximum recovery time

### 3. Recovery Procedures

1. **Assess Damage**: Determine scope of system failure
2. **Notify Stakeholders**: Alert medical staff and administration
3. **Restore from Backup**: Use most recent verified backup
4. **Verify System Integrity**: Run comprehensive health checks
5. **Resume Operations**: Gradually restore service access

## Support and Maintenance Contacts

### Technical Support
- **System Administrator**: [admin@your-hospital.com]
- **Database Administrator**: [dba@your-hospital.com]
- **Security Officer**: [security@your-hospital.com]

### Medical Compliance
- **Data Protection Officer**: [dpo@your-hospital.com]
- **Medical Director**: [medical-director@your-hospital.com]
- **Compliance Officer**: [compliance@your-hospital.com]

## Appendices

### Appendix A: Environment Variables Reference

See `.env.template` for complete list of configuration options.

### Appendix B: Port Reference

| Service | Internal Port | External Port | Purpose |
|---------|---------------|---------------|---------|
| Nginx | 80, 443 | 80, 443 | Web server and SSL termination |
| Backend | 8000 | - | API gateway |
| Frontend | 3000 | - | Web interface |
| PostgreSQL | 5432 | - | Database |
| Redis | 6379 | - | Cache and sessions |
| Grafana | 3000 | - | Monitoring dashboards |
| Prometheus | 9090 | - | Metrics collection |

### Appendix C: Log File Locations

| Component | Log Location | Retention |
|-----------|--------------|-----------|
| Nginx | `/opt/radiology-ai/logs/nginx/` | 30 days |
| Application | `/opt/radiology-ai/logs/app/` | 90 days |
| Medical Audit | `/opt/radiology-ai/logs/medical-audit/` | 10 years |
| System | `/var/log/syslog` | 30 days |

### Appendix D: Compliance Checklist

- [ ] SSL certificates installed and valid
- [ ] Firewall configured and active
- [ ] Backup procedures tested and documented
- [ ] User access controls implemented
- [ ] Audit logging enabled and verified
- [ ] Data encryption at rest and in transit
- [ ] Medical data retention policies configured
- [ ] Incident response procedures documented
- [ ] Staff training completed and documented
- [ ] Regular security assessments scheduled

---

**Document Version**: 1.0  
**Last Updated**: $(date)  
**Next Review**: $(date -d "+6 months")  
**Approved By**: Medical Director, IT Director, Data Protection Officer