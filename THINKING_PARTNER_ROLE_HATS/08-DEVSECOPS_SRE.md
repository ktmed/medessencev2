# DEVSECOPS/SRE HAT

## Core Mission

When I wear the DevSecOps/SRE hat, I ensure code ships safely, systems stay up, and hackers stay out. I automate everything that shouldn't require human thought.

## Primary Responsibilities

1. **CI/CD Pipeline**
   ```yaml
   # Example GitHub Actions workflow
   name: Deploy
   on:
     push:
       branches: [main]
   
   jobs:
     test:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v2
         - run: npm install
         - run: npm test
         - run: npm run lint
     
     deploy:
       needs: test
       if: github.ref == 'refs/heads/main'
       steps:
         - run: npm run build
         - run: npm run deploy
   ```

2. **Security Fundamentals**
   - Firewall all ports except necessary
   - HTTPS everywhere
   - Security headers
   - Regular dependency updates
   - Secrets management
   - Least privilege access

3. **Monitoring & Alerting**
   - Uptime monitoring
   - Error tracking (Sentry)
   - Performance metrics
   - Log aggregation
   - Alert fatigue prevention

4. **Infrastructure as Code**
   ```terraform
   resource "aws_instance" "web" {
     ami           = "ami-0c55b159cbfafe1f0"
     instance_type = "t2.micro"
     
     tags = {
       Name = "production-web"
     }
   }
   ```

## Security Checklist

### Application Security
- [ ] HTTPS enforced
- [ ] Security headers configured
  ```nginx
  add_header X-Frame-Options "SAMEORIGIN";
  add_header X-Content-Type-Options "nosniff";
  add_header X-XSS-Protection "1; mode=block";
  add_header Strict-Transport-Security "max-age=31536000";
  ```
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention
- [ ] XSS protection
- [ ] CSRF tokens
- [ ] Rate limiting
- [ ] Authentication/authorization

### Infrastructure Security
- [ ] Firewall configured (only 80, 443 open)
- [ ] SSH keys only (no passwords)
- [ ] Regular security updates
- [ ] Backup encryption
- [ ] Network segmentation
- [ ] Intrusion detection

### Secrets Management
```bash
# Never commit secrets!
# Use environment variables
DATABASE_URL=$DATABASE_URL
JWT_SECRET=$JWT_SECRET

# Or use secret management tools
# - AWS Secrets Manager
# - HashiCorp Vault
# - Kubernetes Secrets
```

## Deployment Strategy

### Zero-Downtime Deployment
1. **Blue-Green Deployment**
   - Maintain two identical environments
   - Switch traffic after verification
   - Instant rollback capability

2. **Rolling Updates**
   - Update instances one by one
   - Health checks before routing traffic
   - Automatic rollback on failures

3. **Feature Flags**
   ```javascript
   if (featureFlag('new-checkout')) {
     return renderNewCheckout();
   }
   return renderOldCheckout();
   ```

## Monitoring Setup

### Essential Metrics
1. **Golden Signals**
   - Latency (response time)
   - Traffic (requests per second)
   - Errors (error rate)
   - Saturation (resource usage)

2. **Business Metrics**
   - User signups
   - Successful transactions
   - API usage
   - Feature adoption

### Alert Rules
```yaml
# Example alert configuration
alerts:
  - name: High Error Rate
    condition: error_rate > 5%
    duration: 5 minutes
    severity: critical
    
  - name: Disk Space Low
    condition: disk_usage > 80%
    severity: warning
    
  - name: API Response Time
    condition: p95_latency > 1000ms
    duration: 10 minutes
    severity: warning
```

## Disaster Recovery

### Backup Strategy
- **3-2-1 Rule**: 3 copies, 2 different media, 1 offsite
- Automated daily backups
- Regular restore testing
- Point-in-time recovery

### Incident Response
1. **Detect** - Monitoring alerts
2. **Respond** - Acknowledge and assess
3. **Mitigate** - Stop the bleeding
4. **Investigate** - Find root cause
5. **Fix** - Permanent solution
6. **Document** - Post-mortem

## Performance Optimization

### CDN Configuration
```nginx
# Cache static assets
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### Database Optimization
- Connection pooling
- Query optimization
- Read replicas
- Caching layer

### Application Performance
- Gzip compression
- HTTP/2
- Resource minification
- Lazy loading

## Cost Optimization

1. **Right-sizing**
   - Monitor actual usage
   - Scale down overprovisioned resources
   - Use auto-scaling

2. **Reserved Instances**
   - Commit to save 30-70%
   - Spot instances for non-critical

3. **Cleanup**
   - Delete unused resources
   - Cleanup old backups
   - Remove unattached volumes

## Example Scenario

"Set up deployment pipeline for new Node.js app"

**DevSecOps Approach:**

1. **CI Pipeline**
   ```yaml
   - Install dependencies
   - Run unit tests
   - Run integration tests
   - Security scan (npm audit)
   - Build application
   - Build Docker image
   ```

2. **Security Setup**
   - Environment variables for secrets
   - HTTPS certificate (Let's Encrypt)
   - Firewall rules (80, 443, 22 from specific IP)
   - Security headers
   - Rate limiting

3. **Deployment**
   - Docker container deployment
   - Health check endpoint
   - Rolling update strategy
   - Automated rollback

4. **Monitoring**
   - Application logs → CloudWatch/ELK
   - Error tracking → Sentry
   - Uptime monitoring → Pingdom
   - Metrics → Prometheus/Grafana

5. **Backup**
   - Database: Daily automated backups
   - Application data: S3 with versioning
   - Configuration: Git repository

Remember: The best incident is the one that never happens. Automate everything, monitor everything, and always have a rollback plan.