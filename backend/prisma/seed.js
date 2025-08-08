const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  try {
    // Create admin user
    const adminPasswordHash = await bcrypt.hash('Admin123!@#', 12);
    const admin = await prisma.user.upsert({
      where: { email: 'admin@radiology-ai.com' },
      update: {},
      create: {
        email: 'admin@radiology-ai.com',
        passwordHash: adminPasswordHash,
        firstName: 'System',
        lastName: 'Administrator',
        title: 'Dr.',
        role: 'ADMIN',
        specialization: 'System Administration',
        department: 'IT',
        institution: 'Radiology AI Medical Center',
        isActive: true,
        isVerified: true,
        gdprConsent: true,
        gdprConsentDate: new Date(),
      }
    });

    // Create chief radiologist
    const chiefPasswordHash = await bcrypt.hash('Chief123!@#', 12);
    const chief = await prisma.user.upsert({
      where: { email: 'chief@radiology-ai.com' },
      update: {},
      create: {
        email: 'chief@radiology-ai.com',
        passwordHash: chiefPasswordHash,
        firstName: 'Dr. Maria',
        lastName: 'Schmidt',
        title: 'Prof. Dr.',
        role: 'CHIEF_RADIOLOGIST',
        specialization: 'Diagnostic Radiology',
        licenseNumber: 'DE-RAD-001',
        department: 'Radiology',
        institution: 'Radiology AI Medical Center',
        isActive: true,
        isVerified: true,
        gdprConsent: true,
        gdprConsentDate: new Date(),
      }
    });

    // Create senior radiologist
    const seniorPasswordHash = await bcrypt.hash('Senior123!@#', 12);
    const senior = await prisma.user.upsert({
      where: { email: 'senior@radiology-ai.com' },
      update: {},
      create: {
        email: 'senior@radiology-ai.com',
        passwordHash: seniorPasswordHash,
        firstName: 'Dr. Hans',
        lastName: 'Müller',
        title: 'Dr.',
        role: 'SENIOR_RADIOLOGIST',
        specialization: 'Interventional Radiology',
        licenseNumber: 'DE-RAD-002',
        department: 'Radiology',
        institution: 'Radiology AI Medical Center',
        isActive: true,
        isVerified: true,
        gdprConsent: true,
        gdprConsentDate: new Date(),
      }
    });

    // Create radiologist
    const radiologistPasswordHash = await bcrypt.hash('Radio123!@#', 12);
    const radiologist = await prisma.user.upsert({
      where: { email: 'radiologist@radiology-ai.com' },
      update: {},
      create: {
        email: 'radiologist@radiology-ai.com',
        passwordHash: radiologistPasswordHash,
        firstName: 'Dr. Anna',
        lastName: 'Weber',
        title: 'Dr.',
        role: 'RADIOLOGIST',
        specialization: 'Diagnostic Radiology',
        licenseNumber: 'DE-RAD-003',
        department: 'Radiology',
        institution: 'Radiology AI Medical Center',
        isActive: true,
        isVerified: true,
        gdprConsent: true,
        gdprConsentDate: new Date(),
      }
    });

    // Create resident
    const residentPasswordHash = await bcrypt.hash('Resident123!@#', 12);
    const resident = await prisma.user.upsert({
      where: { email: 'resident@radiology-ai.com' },
      update: {},
      create: {
        email: 'resident@radiology-ai.com',
        passwordHash: residentPasswordHash,
        firstName: 'Dr. Thomas',
        lastName: 'Fischer',
        title: 'Dr.',
        role: 'RESIDENT',
        specialization: 'Radiology (In Training)',
        licenseNumber: 'DE-RES-001',
        department: 'Radiology',
        institution: 'Radiology AI Medical Center',
        isActive: true,
        isVerified: true,
        gdprConsent: true,
        gdprConsentDate: new Date(),
      }
    });

    // Create technician
    const technicianPasswordHash = await bcrypt.hash('Tech123!@#', 12);
    const technician = await prisma.user.upsert({
      where: { email: 'technician@radiology-ai.com' },
      update: {},
      create: {
        email: 'technician@radiology-ai.com',
        passwordHash: technicianPasswordHash,
        firstName: 'Sarah',
        lastName: 'Klein',
        role: 'TECHNICIAN',
        specialization: 'MTRA',
        department: 'Radiology',
        institution: 'Radiology AI Medical Center',
        isActive: true,
        isVerified: true,
        gdprConsent: true,
        gdprConsentDate: new Date(),
      }
    });

    console.log('👥 Created users:', {
      admin: admin.email,
      chief: chief.email,
      senior: senior.email,
      radiologist: radiologist.email,
      resident: resident.email,
      technician: technician.email
    });

    // Create permissions for users
    const permissions = [
      // Admin permissions
      { userId: admin.id, permission: 'SYSTEM_ADMIN', resource: null },
      { userId: admin.id, permission: 'USER_ADMIN', resource: null },
      { userId: admin.id, permission: 'AUDIT_READ', resource: null },
      { userId: admin.id, permission: 'METRICS_READ', resource: null },
      { userId: admin.id, permission: 'HEALTH_CHECK', resource: null },

      // Chief radiologist permissions
      { userId: chief.id, permission: 'USER_READ', resource: null },
      { userId: chief.id, permission: 'USER_CREATE', resource: null },
      { userId: chief.id, permission: 'USER_EDIT', resource: null },
      { userId: chief.id, permission: 'AUDIT_READ', resource: null },
      { userId: chief.id, permission: 'METRICS_READ', resource: null },
      { userId: chief.id, permission: 'HEALTH_CHECK', resource: null },
      { userId: chief.id, permission: 'TRANSCRIPTION_READ', resource: null },
      { userId: chief.id, permission: 'TRANSCRIPTION_CREATE', resource: null },
      { userId: chief.id, permission: 'TRANSCRIPTION_EDIT', resource: null },
      { userId: chief.id, permission: 'REPORT_READ', resource: null },
      { userId: chief.id, permission: 'REPORT_CREATE', resource: null },
      { userId: chief.id, permission: 'REPORT_EDIT', resource: null },
      { userId: chief.id, permission: 'REPORT_APPROVE', resource: null },
      { userId: chief.id, permission: 'REPORT_SIGN', resource: null },
      { userId: chief.id, permission: 'SUMMARY_READ', resource: null },
      { userId: chief.id, permission: 'SUMMARY_CREATE', resource: null },
      { userId: chief.id, permission: 'SUMMARY_EDIT', resource: null },

      // Senior radiologist permissions
      { userId: senior.id, permission: 'USER_READ', resource: null },
      { userId: senior.id, permission: 'TRANSCRIPTION_READ', resource: null },
      { userId: senior.id, permission: 'TRANSCRIPTION_CREATE', resource: null },
      { userId: senior.id, permission: 'TRANSCRIPTION_EDIT', resource: null },
      { userId: senior.id, permission: 'REPORT_READ', resource: null },
      { userId: senior.id, permission: 'REPORT_CREATE', resource: null },
      { userId: senior.id, permission: 'REPORT_EDIT', resource: null },
      { userId: senior.id, permission: 'REPORT_APPROVE', resource: null },
      { userId: senior.id, permission: 'REPORT_SIGN', resource: null },
      { userId: senior.id, permission: 'SUMMARY_READ', resource: null },
      { userId: senior.id, permission: 'SUMMARY_CREATE', resource: null },
      { userId: senior.id, permission: 'SUMMARY_EDIT', resource: null },

      // Radiologist permissions
      { userId: radiologist.id, permission: 'TRANSCRIPTION_READ', resource: null },
      { userId: radiologist.id, permission: 'TRANSCRIPTION_CREATE', resource: null },
      { userId: radiologist.id, permission: 'TRANSCRIPTION_EDIT', resource: null },
      { userId: radiologist.id, permission: 'REPORT_READ', resource: null },
      { userId: radiologist.id, permission: 'REPORT_CREATE', resource: null },
      { userId: radiologist.id, permission: 'REPORT_EDIT', resource: null },
      { userId: radiologist.id, permission: 'REPORT_SIGN', resource: null },
      { userId: radiologist.id, permission: 'SUMMARY_READ', resource: null },
      { userId: radiologist.id, permission: 'SUMMARY_CREATE', resource: null },

      // Resident permissions
      { userId: resident.id, permission: 'TRANSCRIPTION_READ', resource: null },
      { userId: resident.id, permission: 'TRANSCRIPTION_CREATE', resource: null },
      { userId: resident.id, permission: 'REPORT_READ', resource: null },
      { userId: resident.id, permission: 'REPORT_CREATE', resource: null },
      { userId: resident.id, permission: 'SUMMARY_READ', resource: null },
      { userId: resident.id, permission: 'SUMMARY_CREATE', resource: null },

      // Technician permissions
      { userId: technician.id, permission: 'TRANSCRIPTION_READ', resource: null },
      { userId: technician.id, permission: 'TRANSCRIPTION_CREATE', resource: null },
      { userId: technician.id, permission: 'REPORT_READ', resource: null },
      { userId: technician.id, permission: 'SUMMARY_READ', resource: null },
    ];

    // Create permissions
    for (const permission of permissions) {
      await prisma.userPermission.upsert({
        where: {
          userId_permission_resource: {
            userId: permission.userId,
            permission: permission.permission,
            resource: permission.resource
          }
        },
        update: {},
        create: {
          ...permission,
          grantedBy: admin.id,
          grantedAt: new Date()
        }
      });
    }

    console.log('🔐 Created permissions for all users');

    // Create system configuration
    const systemConfigs = [
      {
        key: 'SYSTEM_NAME',
        value: 'Radiology AI Gateway',
        description: 'System name displayed in UI',
        category: 'general'
      },
      {
        key: 'SYSTEM_VERSION',
        value: '1.0.0',
        description: 'Current system version',
        category: 'general'
      },
      {
        key: 'MAINTENANCE_MODE',
        value: 'false',
        description: 'Enable/disable maintenance mode',
        category: 'system'
      },
      {
        key: 'MAX_LOGIN_ATTEMPTS',
        value: '5',
        description: 'Maximum login attempts before account lockout',
        category: 'security'
      },
      {
        key: 'SESSION_TIMEOUT',
        value: '3600',
        description: 'Session timeout in seconds',
        category: 'security'
      },
      {
        key: 'AUDIT_RETENTION_DAYS',
        value: '2555',
        description: 'Audit log retention period in days (7 years)',
        category: 'compliance'
      },
      {
        key: 'GDPR_ENABLED',
        value: 'true',
        description: 'Enable GDPR compliance features',
        category: 'compliance'
      }
    ];

    for (const config of systemConfigs) {
      await prisma.systemConfig.upsert({
        where: { key: config.key },
        update: {},
        create: {
          ...config,
          changedBy: admin.id,
          changedAt: new Date()
        }
      });
    }

    console.log('⚙️ Created system configuration');

    // Create service health entries
    const services = [
      {
        serviceName: 'transcription',
        endpoint: 'http://localhost:8001',
        port: 8001
      },
      {
        serviceName: 'reports',
        endpoint: 'http://localhost:8002',
        port: 8002
      },
      {
        serviceName: 'summaries',
        endpoint: 'http://localhost:8003',
        port: 8003
      }
    ];

    for (const service of services) {
      await prisma.serviceHealth.upsert({
        where: { serviceName: service.serviceName },
        update: {},
        create: {
          ...service,
          status: 'UNKNOWN',
          lastCheck: new Date()
        }
      });
    }

    console.log('🏥 Created service health entries');

    // Create circuit breaker states
    for (const service of services) {
      await prisma.circuitBreakerState.upsert({
        where: { serviceName: service.serviceName },
        update: {},
        create: {
          serviceName: service.serviceName,
          state: 'CLOSED',
          failureCount: 0,
          failureThreshold: 5,
          timeoutMs: 30000,
          resetTimeoutMs: 60000
        }
      });
    }

    console.log('🔌 Created circuit breaker states');

    // Create sample audit logs
    const sampleAuditLogs = [
      {
        userId: admin.id,
        action: 'LOGIN_SUCCESS',
        resource: 'authentication',
        description: 'Admin login successful',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        riskLevel: 'LOW'
      },
      {
        userId: chief.id,
        action: 'REPORT_CREATED',
        resource: 'report',
        resourceId: 'report_001',
        description: 'Medical report created',
        ipAddress: '192.168.1.101',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        medicalDataType: 'report',
        gdprLawfulBasis: 'legitimate_interest',
        riskLevel: 'MEDIUM'
      },
      {
        userId: radiologist.id,
        action: 'TRANSCRIPTION_ACCESSED',
        resource: 'transcription',
        resourceId: 'trans_001',
        description: 'Transcription accessed for review',
        ipAddress: '192.168.1.102',
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        medicalDataType: 'transcription',
        gdprLawfulBasis: 'legitimate_interest',
        riskLevel: 'LOW'
      }
    ];

    for (const auditLog of sampleAuditLogs) {
      await prisma.auditLog.create({
        data: {
          ...auditLog,
          createdAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000) // Random time in last 24h
        }
      });
    }

    console.log('📋 Created sample audit logs');

    console.log('✅ Database seeding completed successfully!');
    console.log('\n📝 Default user accounts created:');
    console.log('Admin: admin@radiology-ai.com / Admin123!@#');
    console.log('Chief: chief@radiology-ai.com / Chief123!@#');
    console.log('Senior: senior@radiology-ai.com / Senior123!@#');
    console.log('Radiologist: radiologist@radiology-ai.com / Radio123!@#');
    console.log('Resident: resident@radiology-ai.com / Resident123!@#');
    console.log('Technician: technician@radiology-ai.com / Tech123!@#');
    console.log('\n⚠️  Please change default passwords in production!');

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });