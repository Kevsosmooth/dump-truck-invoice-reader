import prisma from '../config/prisma.js';

class AuditLogger {
  async log({ action, userId, targetType, targetId, details, ipAddress }) {
    try {
      return await prisma.auditLog.create({
        data: {
          action,
          userId,
          targetType,
          targetId,
          details,
          ipAddress,
          userAgent: details?.userAgent || null
        }
      });
    } catch (error) {
      console.error('Failed to create audit log:', error);
      // Don't throw - we don't want logging failures to break operations
    }
  }

  async getRecentLogs(limit = 100) {
    return await prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });
  }

  async getLogsByUser(userId, limit = 100) {
    return await prisma.auditLog.findMany({
      where: { userId },
      take: limit,
      orderBy: { createdAt: 'desc' }
    });
  }

  async getLogsByTarget(targetType, targetId, limit = 100) {
    return await prisma.auditLog.findMany({
      where: { targetType, targetId },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });
  }
}

export default new AuditLogger();