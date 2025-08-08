# Radiology AI System - Troubleshooting Guide

## Overview

This troubleshooting guide provides systematic approaches to diagnose and resolve common issues in the Radiology AI System. It is designed for medical IT professionals and system administrators managing the deployment in German medical environments.

## Table of Contents

- [Quick Diagnostic Tools](#quick-diagnostic-tools)
- [Common Issues](#common-issues)
- [Service-Specific Issues](#service-specific-issues)
- [Performance Issues](#performance-issues)
- [Security Issues](#security-issues)
- [Medical Compliance Issues](#medical-compliance-issues)
- [Network Issues](#network-issues)
- [Database Issues](#database-issues)
- [Backup and Recovery Issues](#backup-and-recovery-issues)
- [Emergency Procedures](#emergency-procedures)
- [Log Analysis](#log-analysis)
- [Contact Information](#contact-information)

## Quick Diagnostic Tools

### 1. System Health Check

```bash
# Run comprehensive health check
./scripts/health-check.sh --detailed

# Quick status check
./scripts/health-check.sh --quick

# Continuous monitoring
./scripts/health-check.sh --continuous --interval 30
```

### 2. Service Status

```bash
# Check all services
docker-compose ps

# Check specific service
docker-compose ps backend

# View service logs
./scripts/logs.sh backend --tail 100

# Check resource usage
docker stats --no-stream
```

### 3. System Resources

```bash
# Check disk space
df -h

# Check memory usage
free -h

# Check CPU usage
top -n 1

# Check network connectivity
ping google.com
```

## Common Issues

### Issue 1: System Won't Start

**Symptoms:**
- Services fail to start
- Docker Compose errors
- Port binding failures

**Diagnosis:**
```bash
# Check Docker daemon
sudo systemctl status docker

# Check for port conflicts
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :443

# Check Docker Compose configuration
docker-compose config

# Check system resources
df -h && free -h
```

**Solutions:**
```bash
# Restart Docker daemon
sudo systemctl restart docker

# Free up ports (kill conflicting processes)
sudo fuser -k 80/tcp
sudo fuser -k 443/tcp

# Clean up Docker resources
docker system prune -f
docker volume prune -f

# Restart the system
./scripts/stop.sh --force
./scripts/deploy.sh
```

### Issue 2: SSL Certificate Errors

**Symptoms:**
- Browser security warnings
- "Certificate not trusted" errors
- HTTPS connections fail

**Diagnosis:**
```bash
# Check certificate validity
openssl x509 -in docker/nginx/ssl/radiology-ai.crt -text -noout

# Check certificate expiry
openssl x509 -in docker/nginx/ssl/radiology-ai.crt -checkend 86400

# Test SSL configuration
curl -I https://your-domain.com
```

**Solutions:**
```bash
# Renew Let's Encrypt certificate
sudo certbot renew

# Generate new self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout docker/nginx/ssl/radiology-ai.key \
  -out docker/nginx/ssl/radiology-ai.crt

# Restart nginx to load new certificate
docker-compose restart nginx
```

### Issue 3: Database Connection Failures

**Symptoms:**
- "Database connection refused" errors
- Application unable to start
- Health checks failing for database

**Diagnosis:**
```bash
# Check PostgreSQL status
docker-compose exec postgres pg_isready -U meduser -d radiology_db

# Check database logs
./scripts/logs.sh postgres --tail 50

# Test database connection
docker-compose exec postgres psql -U meduser -d radiology_db -c "SELECT 1;"
```

**Solutions:**
```bash
# Restart PostgreSQL
docker-compose restart postgres

# Check database configuration
cat docker/postgres/postgresql.conf | grep -E "(listen_addresses|port|max_connections)"

# Reset database if corrupted
./scripts/migrate-db.sh reset --force

# Restore from backup
./scripts/backup.sh --type database
```

### Issue 4: High Memory Usage

**Symptoms:**
- System becomes slow
- Out of memory errors
- Services getting killed

**Diagnosis:**
```bash
# Check memory usage by container
docker stats --no-stream --format "table {{.Container}}\t{{.MemUsage}}\t{{.MemPerc}}"

# Check system memory
free -h && cat /proc/meminfo

# Check for memory leaks
./scripts/logs.sh --grep "OutOfMemory\|OOM"
```

**Solutions:**
```bash
# Restart memory-intensive services
docker-compose restart transcription-service report-generation

# Adjust memory limits in docker-compose.yml
# Reduce resource allocation for less critical services

# Clear caches
docker-compose exec redis redis-cli FLUSHDB
docker system prune -f

# Add swap space (temporary solution)
sudo swapon --show
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

## Service-Specific Issues

### Nginx (Reverse Proxy)

**Common Issues:**
- 502 Bad Gateway errors
- SSL/TLS configuration problems
- Load balancing issues

**Diagnosis:**
```bash
# Check nginx configuration
docker-compose exec nginx nginx -t

# Check nginx logs
./scripts/logs.sh nginx --errors

# Test upstream services
curl -I http://localhost:8000/health  # Backend
curl -I http://localhost:3000/api/health  # Frontend
```

**Solutions:**
```bash
# Reload nginx configuration
docker-compose exec nginx nginx -s reload

# Restart nginx
docker-compose restart nginx

# Check upstream service health
./scripts/health-check.sh --service backend
./scripts/health-check.sh --service frontend
```

### Backend API Gateway

**Common Issues:**
- API endpoints not responding
- Authentication failures
- Database connection errors

**Diagnosis:**
```bash
# Check backend logs
./scripts/logs.sh backend --level ERROR --tail 100

# Test API endpoints
curl -X GET http://localhost:8000/health
curl -X GET http://localhost:8000/api/status

# Check database connectivity from backend
docker-compose exec backend node -e "console.log(process.env.DATABASE_URL)"
```

**Solutions:**
```bash
# Restart backend service
docker-compose restart backend

# Check environment variables
grep -E "(DATABASE_URL|JWT_SECRET|OPENAI_API_KEY)" .env

# Reset JWT tokens
# Update JWT_SECRET in .env and restart backend

# Check API rate limits
./scripts/logs.sh backend --grep "rate.limit"
```

### Transcription Service

**Common Issues:**
- Audio processing failures
- OpenAI API errors
- Slow transcription processing

**Diagnosis:**
```bash
# Check transcription service logs
./scripts/logs.sh transcription-service --tail 50

# Test OpenAI API connectivity
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models

# Check audio file processing
./scripts/logs.sh transcription-service --grep "audio"
```

**Solutions:**
```bash
# Restart transcription service
docker-compose restart transcription-service

# Check OpenAI API key
echo $OPENAI_API_KEY | cut -c1-10  # Should start with "sk-"

# Increase processing timeout
# Update MAX_AUDIO_SIZE and timeout settings

# Clear processing queue
docker-compose exec redis redis-cli FLUSHDB
```

### Report Generation Service

**Common Issues:**
- Report generation failures
- Template processing errors
- German language issues

**Diagnosis:**
```bash
# Check report generation logs
./scripts/logs.sh report-generation --grep -E "(error|fail|template)"

# Test report templates
docker-compose exec report-generation ls -la /app/templates/

# Check German locale settings
docker-compose exec report-generation locale -a | grep de_DE
```

**Solutions:**
```bash
# Restart report generation service
docker-compose restart report-generation

# Update report templates
# Check templates/german_report_templates.py

# Verify German locale installation
docker-compose exec report-generation dpkg -l | grep locale
```

## Performance Issues

### Slow Response Times

**Symptoms:**
- Web interface takes long to load
- API calls timeout
- Users report system sluggishness

**Diagnosis:**
```bash
# Check response times
curl -w "@curl-format.txt" -o /dev/null -s https://your-domain.com

# Monitor API performance
./scripts/logs.sh backend --grep "response_time" --tail 100

# Check database query performance
docker-compose exec postgres psql -U meduser -d radiology_db -c "
SELECT query, mean_time, calls, total_time 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;"
```

**Solutions:**
```bash
# Optimize database queries
docker-compose exec postgres psql -U meduser -d radiology_db -c "VACUUM ANALYZE;"

# Restart services in rolling fashion
./scripts/restart.sh --rolling

# Check and optimize Docker resources
docker system df
docker system prune -f

# Enable Redis caching
# Verify REDIS_URL configuration in .env
```

### High CPU Usage

**Diagnosis:**
```bash
# Identify CPU-intensive containers
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}"

# Check system load
uptime && cat /proc/loadavg

# Monitor CPU usage over time
top -p $(docker-compose ps -q | tr '\n' ',')
```

**Solutions:**
```bash
# Restart CPU-intensive services
docker-compose restart transcription-service

# Adjust CPU limits in docker-compose.yml
# Scale services if needed

# Check for infinite loops or resource leaks
./scripts/logs.sh --grep -E "(loop|infinite|stuck)"
```

### Database Performance

**Diagnosis:**
```bash
# Check database connections
docker-compose exec postgres psql -U meduser -d radiology_db -c "
SELECT count(*) as connections, state 
FROM pg_stat_activity 
GROUP BY state;"

# Check slow queries
docker-compose exec postgres psql -U meduser -d radiology_db -c "
SELECT query, mean_time, calls 
FROM pg_stat_statements 
WHERE mean_time > 1000 
ORDER BY mean_time DESC;"

# Check database locks
docker-compose exec postgres psql -U meduser -d radiology_db -c "
SELECT * FROM pg_locks WHERE NOT granted;"
```

**Solutions:**
```bash
# Optimize database configuration
# Review docker/postgres/postgresql.conf settings

# Run database maintenance
docker-compose exec postgres psql -U meduser -d radiology_db -c "
VACUUM FULL;
REINDEX DATABASE radiology_db;"

# Update table statistics
docker-compose exec postgres psql -U meduser -d radiology_db -c "ANALYZE;"
```

## Security Issues

### Unauthorized Access Attempts

**Symptoms:**
- Multiple failed login attempts
- Unusual network traffic
- Security alerts from monitoring

**Diagnosis:**
```bash
# Check authentication logs
./scripts/logs.sh backend --grep -E "(auth|login|fail)" --tail 100

# Check nginx access logs
./scripts/logs.sh nginx --grep -E "(401|403|429)"

# Monitor connection attempts
sudo netstat -an | grep :443 | wc -l
```

**Solutions:**
```bash
# Review and update security configuration
# Check fail2ban status
sudo fail2ban-client status

# Update firewall rules
sudo ufw status verbose

# Rotate security keys
# Update JWT_SECRET and ENCRYPTION_KEY in .env
./scripts/restart.sh --service backend
```

### Data Breach Concerns

**Immediate Actions:**
1. **Isolate the system** - Disconnect from network if necessary
2. **Document everything** - Preserve logs and evidence
3. **Notify authorities** - German data protection authority (BfDI)
4. **Assess impact** - Determine scope of potential breach

**Investigation:**
```bash
# Export audit logs immediately
./scripts/logs.sh --medical --export json --output /secure/audit-$(date +%Y%m%d_%H%M%S).json

# Check access patterns
./scripts/logs.sh backend --grep -E "(patient|medical|data)" --since "24 hours ago"

# Review database access
docker-compose exec postgres psql -U meduser -d radiology_db -c "
SELECT * FROM audit_log 
WHERE created_at > NOW() - INTERVAL '24 hours' 
ORDER BY created_at DESC;"
```

## Medical Compliance Issues

### Audit Trail Gaps

**Symptoms:**
- Missing audit entries
- Compliance reports show gaps
- Medical data access not logged

**Diagnosis:**
```bash
# Check audit log integrity
./scripts/logs.sh --medical --since "7 days ago" | wc -l

# Verify audit log database table
docker-compose exec postgres psql -U meduser -d radiology_db -c "
SELECT COUNT(*), DATE(created_at) 
FROM audit_log 
GROUP BY DATE(created_at) 
ORDER BY DATE(created_at) DESC 
LIMIT 7;"

# Check audit service status
./scripts/health-check.sh --service backend
```

**Solutions:**
```bash
# Restart audit logging services
docker-compose restart backend

# Verify audit configuration
grep AUDIT .env

# Restore audit logs from backup if necessary
./scripts/backup.sh --type medical
```

### Data Retention Violations

**Diagnosis:**
```bash
# Check data retention settings
grep RETENTION .env

# Review old data
docker-compose exec postgres psql -U meduser -d radiology_db -c "
SELECT COUNT(*), DATE(created_at) 
FROM medical_records 
WHERE created_at < NOW() - INTERVAL '30 years' 
GROUP BY DATE(created_at);"
```

**Solutions:**
```bash
# Update retention policies
# Modify MEDICAL_DATA_RETENTION_YEARS in .env

# Archive old data before deletion
./scripts/backup.sh --type medical --output /archive/$(date +%Y)

# Implement automated retention
# Add cron job for data archival
```

## Network Issues

### Connection Timeouts

**Diagnosis:**
```bash
# Test network connectivity
ping -c 4 google.com
dig @8.8.8.8 your-domain.com

# Check DNS resolution
nslookup your-domain.com

# Test specific ports
telnet your-domain.com 443
nc -zv your-domain.com 80 443
```

**Solutions:**
```bash
# Restart networking
sudo systemctl restart networking

# Flush DNS cache
sudo systemctl restart systemd-resolved

# Check firewall rules
sudo ufw status verbose
sudo iptables -L
```

### Load Balancer Issues

**Diagnosis:**
```bash
# Check nginx upstream configuration
docker-compose exec nginx cat /etc/nginx/conf.d/radiology-ai.conf | grep upstream -A 10

# Test backend connectivity
curl -I http://backend:8000/health
curl -I http://frontend:3000/api/health
```

**Solutions:**
```bash
# Restart nginx
docker-compose restart nginx

# Check backend service discovery
docker network inspect radiology-ai-system_radiology-network
```

## Database Issues

### Database Corruption

**Symptoms:**
- Database won't start
- Data inconsistency errors
- Backup/restore failures

**Diagnosis:**
```bash
# Check database integrity
docker-compose exec postgres psql -U meduser -d radiology_db -c "
SELECT datname, datconnlimit, datallowconn 
FROM pg_database 
WHERE datname = 'radiology_db';"

# Check for corruption
docker-compose exec postgres pg_dump -U meduser -d radiology_db --schema-only > /tmp/schema_test.sql
```

**Solutions:**
```bash
# Stop all services accessing database
./scripts/stop.sh

# Backup current state
./scripts/backup.sh --type database --output /emergency/$(date +%Y%m%d_%H%M%S)

# Repair database
docker-compose exec postgres pg_resetwal -f /var/lib/postgresql/data

# Restore from latest backup if repair fails
./scripts/restore.sh --backup /path/to/latest/backup --type database
```

### Migration Failures

**Diagnosis:**
```bash
# Check migration status
./scripts/migrate-db.sh status

# Check migration logs
./scripts/logs.sh postgres --grep migration

# Verify database schema
./scripts/migrate-db.sh validate
```

**Solutions:**
```bash
# Rollback failed migration
./scripts/migrate-db.sh rollback

# Fix migration file and retry
./scripts/migrate-db.sh migrate --dry-run
./scripts/migrate-db.sh migrate
```

## Backup and Recovery Issues

### Backup Failures

**Diagnosis:**
```bash
# Check backup logs
ls -la backups/ | tail -10

# Test backup process
./scripts/backup.sh --type database --dry-run

# Check disk space for backups
df -h /path/to/backup/directory
```

**Solutions:**
```bash
# Free up disk space
./scripts/backup.sh --retention

# Fix permissions
sudo chown -R radiology-ai:radiology-ai backups/

# Test backup manually
./scripts/backup.sh --type database --verify
```

### Recovery Failures

**Diagnosis:**
```bash
# Verify backup integrity
./scripts/backup.sh --verify

# Check backup contents
tar -tzf /path/to/backup.tar.gz | head -20
```

**Solutions:**
```bash
# Use alternative backup
ls -la backups/ | grep -E "(full_backup|database)" | tail -5

# Restore step by step
./scripts/restore.sh --backup /path/to/backup --type config
./scripts/restore.sh --backup /path/to/backup --type database
```

## Emergency Procedures

### System Down - Critical Medical Operations Affected

**Immediate Actions (5 minutes):**
1. **Alert medical staff** - Notify that system is unavailable
2. **Switch to backup procedures** - Use manual processes
3. **Assess scope** - Determine which services are affected
4. **Document timeline** - Record all actions for compliance

**Short-term Recovery (30 minutes):**
```bash
# Quick system restart
./scripts/stop.sh --force
./scripts/deploy.sh

# If restart fails, restore from backup
./scripts/restore.sh --backup $(ls -t backups/full_backup_* | head -1)
```

**Medium-term Recovery (2 hours):**
1. Identify root cause
2. Implement permanent fix
3. Verify system integrity
4. Update incident documentation

### Data Loss Incident

**Immediate Response:**
1. **Stop all write operations** - Prevent further data corruption
2. **Preserve evidence** - Don't restart services yet
3. **Assess extent** - Determine what data is affected
4. **Notify stakeholders** - Medical director, DPO, IT management

**Recovery Process:**
```bash
# Create forensic copy of current state
./scripts/backup.sh --type all --output /forensic/$(date +%Y%m%d_%H%M%S)

# Restore from most recent backup
LATEST_BACKUP=$(ls -t backups/full_backup_* | head -1)
echo "Restoring from: $LATEST_BACKUP"
./scripts/restore.sh --backup "$LATEST_BACKUP"

# Verify data integrity after restore
./scripts/health-check.sh --detailed
./scripts/migrate-db.sh validate
```

### Security Incident

**Immediate Response (within 15 minutes):**
1. **Isolate affected systems** - Disconnect from network if needed
2. **Preserve logs** - Export all audit and security logs
3. **Document everything** - Time, actions, observations
4. **Notify authorities** - Internal security team, external if required

**Evidence Collection:**
```bash
# Export all logs immediately
./scripts/logs.sh --all --export json --output /incident/logs-$(date +%Y%m%d_%H%M%S).json

# Export audit trail
./scripts/logs.sh --compliance --export json --output /incident/audit-$(date +%Y%m%d_%H%M%S).json

# Capture system state
./scripts/health-check.sh --detailed --export /incident/health-$(date +%Y%m%d_%H%M%S).txt
```

## Log Analysis

### Common Log Patterns

**Error Patterns to Watch:**
```bash
# Database connection errors
./scripts/logs.sh --grep -E "(ECONNREFUSED|connection.*refused|timeout.*database)"

# Authentication failures
./scripts/logs.sh --grep -E "(authentication.*failed|invalid.*credentials|unauthorized)"

# Medical data access errors
./scripts/logs.sh --grep -E "(patient.*error|medical.*fail|transcription.*error)"

# System resource issues
./scripts/logs.sh --grep -E "(out.*of.*memory|disk.*full|too.*many.*connections)"
```

**Performance Monitoring:**
```bash
# Slow operations
./scripts/logs.sh --grep -E "(slow.*query|timeout|response.*time.*[0-9]{4,})"

# High load indicators
./scripts/logs.sh --grep -E "(load.*average|cpu.*high|memory.*usage)"
```

### Log Analysis Tools

**Built-in Analysis:**
```bash
# Generate performance report
./scripts/logs.sh --performance

# Medical compliance report
./scripts/logs.sh --compliance

# Error summary
./scripts/logs.sh --errors --since "24 hours ago"
```

**External Tools:**
- **Grafana Dashboards**: Pre-configured medical system dashboards
- **Loki Queries**: Advanced log querying and alerting
- **Prometheus Alerts**: Automated alerting for critical issues

## Contact Information

### Emergency Contacts (24/7)

**Medical Emergency - System Critical:**
- **On-call Medical IT**: [medical-it-oncall@hospital.com]
- **System Administrator**: [sysadmin@hospital.com]
- **Medical Director**: [medical-director@hospital.com] (for patient safety issues)

### Standard Support (Business Hours)

**Technical Issues:**
- **IT Help Desk**: [helpdesk@hospital.com] | +49 XXX XXXX-XXXX
- **Database Administrator**: [dba@hospital.com]
- **Network Administrator**: [netadmin@hospital.com]

**Compliance and Security:**
- **Data Protection Officer**: [dpo@hospital.com]
- **Information Security**: [infosec@hospital.com]
- **Compliance Officer**: [compliance@hospital.com]

### Vendor Support

**System Vendor:**
- **Support Portal**: [vendor-support-portal-url]
- **Emergency Line**: +49 XXX XXXX-XXXX
- **Email**: [support@vendor.com]

### Regulatory Contacts

**German Authorities:**
- **BfDI (Data Protection)**: +49 228 997799-0
- **Local Health Authority**: [contact information]
- **Medical Device Authority**: [contact information]

---

## Escalation Matrix

| Issue Severity | Response Time | Escalation Level | Contacts |
|----------------|---------------|------------------|----------|
| **Critical** (System down, patient safety) | 15 minutes | Level 1 | On-call admin, Medical director |
| **High** (Service degraded, data issues) | 1 hour | Level 2 | IT manager, DPO |
| **Medium** (Non-critical functionality) | 4 hours | Level 3 | Technical team |
| **Low** (Minor issues, requests) | 24 hours | Level 4 | Help desk |

## Document Information

- **Document Version**: 1.0
- **Last Updated**: $(date)
- **Next Review**: $(date -d "+3 months")
- **Approved By**: IT Director, Medical Director, Data Protection Officer
- **Document Classification**: Internal Use Only - Medical Information

---

**Note**: This troubleshooting guide contains sensitive information about medical system operations. Ensure proper access controls and handle according to your organization's information security policies.