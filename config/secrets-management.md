# Secrets Management Strategy for MedEssenceAI

## Overview

This document outlines the comprehensive secrets management strategy for MedEssenceAI, designed to meet HIPAA compliance requirements and follow security best practices.

## Secrets Management Architecture

### External Secrets Management Systems

We recommend using external secrets management systems instead of storing secrets directly in Kubernetes:

#### Primary: AWS Secrets Manager
- **Purpose**: Primary secrets store for production
- **Benefits**: HIPAA-compliant, automatic rotation, versioning, audit logging
- **Integration**: External Secrets Operator (ESO)

#### Secondary: HashiCorp Vault
- **Purpose**: Alternative for on-premises deployments
- **Benefits**: Open-source, advanced policy management, dynamic secrets
- **Integration**: Vault Agent or External Secrets Operator

#### Tertiary: Azure Key Vault / Google Secret Manager
- **Purpose**: Cloud-specific deployments
- **Benefits**: Native cloud integration, compliance certifications

### Secrets Categories

#### 1. Database Secrets
```
medessence/<environment>/database
├── username
├── password
├── connection_string
└── encryption_key
```

#### 2. AI Provider Keys
```
medessence/<environment>/ai-providers
├── openai_api_key
├── anthropic_api_key
├── google_api_key
└── azure_cognitive_key
```

#### 3. Medical Compliance Keys (HIPAA)
```
medessence/<environment>/medical-encryption
├── phi_encryption_key
├── phi_encryption_iv
├── medical_record_key
├── audit_log_encryption_key
└── file_encryption_key
```

#### 4. Authentication & Session Secrets
```
medessence/<environment>/auth
├── jwt_secret
├── jwt_refresh_secret
├── session_secret
└── encryption_key
```

#### 5. External Service Keys
```
medessence/<environment>/external-services
├── smtp_password
├── slack_webhook_url
├── sentry_dsn
├── monitoring_tokens
└── backup_credentials
```

## Implementation Guide

### 1. AWS Secrets Manager Setup

#### Create Secrets Structure
```bash
# Database credentials
aws secretsmanager create-secret \
    --name "medessence/production/database" \
    --description "Database credentials for MedEssenceAI production" \
    --secret-string '{
        "username": "medessence_prod",
        "password": "SECURE_PASSWORD_HERE",
        "host": "postgres-service",
        "port": "5432",
        "database": "medessence"
    }' \
    --kms-key-id alias/medessence-secrets

# AI Provider Keys
aws secretsmanager create-secret \
    --name "medessence/production/ai-providers" \
    --description "AI provider API keys" \
    --secret-string '{
        "openai_api_key": "sk-...",
        "anthropic_api_key": "sk-ant-...",
        "google_api_key": "AIza..."
    }' \
    --kms-key-id alias/medessence-secrets

# Medical Encryption Keys
aws secretsmanager create-secret \
    --name "medessence/production/medical-encryption" \
    --description "HIPAA-compliant encryption keys" \
    --secret-string '{
        "phi_encryption_key": "GENERATED_AES_256_KEY",
        "phi_encryption_iv": "GENERATED_AES_IV",
        "medical_record_key": "GENERATED_AES_256_KEY",
        "audit_log_encryption_key": "GENERATED_AES_256_KEY"
    }' \
    --kms-key-id alias/medessence-secrets
```

### 2. External Secrets Operator Configuration

#### Install ESO
```bash
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets -n external-secrets-system --create-namespace
```

#### Configure SecretStore
```yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secrets-store
  namespace: medessence-production
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        secretRef:
          accessKeyID:
            name: aws-credentials
            key: access-key-id
          secretAccessKey:
            name: aws-credentials
            key: secret-access-key
```

### 3. Secret Rotation Strategy

#### Automatic Rotation Schedule
- **Database passwords**: Every 90 days
- **API keys**: Every 180 days
- **Encryption keys**: Every 365 days (with backward compatibility)
- **JWT secrets**: Every 30 days

#### Rotation Implementation
```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: database-secret-with-rotation
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-store
    kind: SecretStore
  target:
    name: postgres-credentials
    creationPolicy: Owner
    template:
      metadata:
        annotations:
          reloader.stakater.com/match: "true"
  data:
  - secretKey: username
    remoteRef:
      key: medessence/production/database
      property: username
  - secretKey: password
    remoteRef:
      key: medessence/production/database
      property: password
```

## Security Best Practices

### 1. Encryption at Rest
- All secrets encrypted with AWS KMS or equivalent
- Separate KMS keys for different secret categories
- Key rotation enabled on KMS keys

### 2. Encryption in Transit
- TLS 1.3 for all secret retrieval operations
- Certificate pinning where possible
- mTLS for service-to-service communication

### 3. Access Control
- Principle of least privilege
- Role-based access control (RBAC)
- Regular access reviews and audits

### 4. Audit and Monitoring
- All secret access logged and monitored
- Anomaly detection for unusual access patterns
- Integration with SIEM systems

## HIPAA Compliance Requirements

### 1. Administrative Safeguards
- **Assigned Security Responsibility**: Designated security officer for secrets management
- **Access Management**: Unique user identification and emergency access procedures
- **Information Access Management**: Automatic logoff and encryption/decryption

### 2. Physical Safeguards
- **Facility Access Controls**: Data center security for cloud providers
- **Device and Media Controls**: Secure disposal and reuse of storage media

### 3. Technical Safeguards
- **Access Control**: Unique user identification and automatic logoff
- **Audit Controls**: Comprehensive logging of all secret access
- **Integrity**: PHI alteration/destruction protection
- **Person or Entity Authentication**: Strong authentication for secret access
- **Transmission Security**: End-to-end encryption for PHI transmission

## Emergency Procedures

### 1. Secret Compromise Response
1. **Immediate Containment**
   - Revoke compromised secrets immediately
   - Block access from compromised systems
   - Generate new secrets

2. **Assessment**
   - Determine scope of compromise
   - Identify affected systems and data
   - Assess potential data exposure

3. **Recovery**
   - Deploy new secrets to all systems
   - Verify system functionality
   - Update monitoring and alerts

4. **Post-Incident**
   - Conduct thorough investigation
   - Update security procedures
   - Notify relevant authorities if PHI involved

### 2. Disaster Recovery
- Secrets backed up in multiple regions
- Automated failover for secret retrieval
- Regular disaster recovery testing

## Monitoring and Alerting

### 1. Secret Access Monitoring
```yaml
# CloudWatch Log Group for secret access
aws logs create-log-group --log-group-name /medessence/secrets/access

# CloudWatch Alarm for unusual access patterns
aws cloudwatch put-metric-alarm \
    --alarm-name "medessence-unusual-secret-access" \
    --alarm-description "Unusual secret access patterns detected" \
    --metric-name "SecretAccessCount" \
    --namespace "MedEssence/Security" \
    --statistic "Sum" \
    --period 300 \
    --threshold 50 \
    --comparison-operator "GreaterThanThreshold"
```

### 2. Failed Access Alerts
- Multiple failed authentication attempts
- Access from unusual locations/times
- Bulk secret retrieval operations

## Development and Testing

### 1. Development Environment Secrets
- Use separate AWS accounts or namespaces
- Mock/dummy data for non-sensitive testing
- Automated secret provisioning for dev environments

### 2. Secret Validation
- Automated testing of secret rotation
- Health checks for secret connectivity
- Integration tests with external services

## Migration Plan

### Phase 1: Setup External Secrets Management
1. Deploy External Secrets Operator
2. Configure AWS Secrets Manager
3. Create initial secret structure

### Phase 2: Migrate Existing Secrets
1. Audit current secret usage
2. Migrate secrets category by category
3. Update applications to use new secrets

### Phase 3: Implement Rotation
1. Configure automatic rotation
2. Test rotation procedures
3. Enable monitoring and alerting

### Phase 4: Compliance and Audit
1. Document all procedures
2. Conduct compliance audit
3. Train team on new procedures

## Tools and Utilities

### Secret Generation Scripts
```bash
#!/bin/bash
# generate-secrets.sh - Generate cryptographically secure secrets

# Generate AES-256 key
openssl rand -hex 32

# Generate AES-128 IV
openssl rand -hex 16

# Generate JWT secret
openssl rand -base64 48

# Generate password with specific requirements
openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
```

### Secret Validation Scripts
```bash
#!/bin/bash
# validate-secrets.sh - Validate secret format and strength

validate_key_strength() {
    local key=$1
    local min_length=$2
    
    if [ ${#key} -lt $min_length ]; then
        echo "ERROR: Key too short (${#key} < $min_length)"
        return 1
    fi
    
    echo "OK: Key length valid (${#key} >= $min_length)"
    return 0
}
```

## Troubleshooting

### Common Issues
1. **Secret not found**: Check secret path and permissions
2. **Connection timeout**: Verify network connectivity to secrets store
3. **Permission denied**: Review IAM roles and policies
4. **Rotation failure**: Check service connectivity during rotation window

### Debug Commands
```bash
# Test secret retrieval
aws secretsmanager get-secret-value --secret-id medessence/production/database

# Check External Secrets Operator status
kubectl get externalsecrets -n medessence-production

# Verify secret creation
kubectl get secrets -n medessence-production
kubectl describe secret postgres-credentials -n medessence-production
```

---

**Note**: This secrets management strategy must be regularly reviewed and updated to maintain compliance with evolving security standards and regulations.