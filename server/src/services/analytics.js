import { prisma } from '../index.js';

// Calculate success rate for jobs
const calculateSuccessRate = (jobs) => {
  if (!jobs || jobs.length === 0) return 0;
  const completed = jobs.filter(j => j.status === 'COMPLETED').length;
  return (completed / jobs.length) * 100;
};

// Calculate average processing time in seconds
const calculateAvgProcessingTime = (jobs) => {
  const completedJobs = jobs.filter(j => 
    j.status === 'COMPLETED' && 
    j.processingStartTime && 
    j.processingEndTime
  );
  
  if (completedJobs.length === 0) return 0;
  
  const totalTime = completedJobs.reduce((sum, job) => {
    const start = new Date(job.processingStartTime).getTime();
    const end = new Date(job.processingEndTime).getTime();
    return sum + (end - start) / 1000; // Convert to seconds
  }, 0);
  
  return Math.round(totalTime / completedJobs.length);
};

// Calculate average confidence score
const calculateAvgConfidence = (jobs) => {
  const jobsWithConfidence = jobs.filter(j => j.avgConfidence !== null);
  if (jobsWithConfidence.length === 0) return 0;
  
  const totalConfidence = jobsWithConfidence.reduce((sum, job) => sum + job.avgConfidence, 0);
  return totalConfidence / jobsWithConfidence.length;
};

// Get model performance data
const getModelPerformance = async (userId) => {
  // Get the most recently used model
  const recentJob = await prisma.job.findFirst({
    where: { 
      userId,
      modelConfigId: { not: null },
      status: 'COMPLETED'
    },
    orderBy: { completedAt: 'desc' },
    include: {
      modelConfig: {
        include: {
          fieldConfigs: true
        }
      }
    }
  });

  if (!recentJob || !recentJob.modelConfig) {
    return {
      currentModel: null,
      avgConfidence: 0,
      fieldsExtracted: { successful: 0, total: 0 },
      recentExtractions: []
    };
  }

  // Get recent extractions for this model
  const recentExtractions = await prisma.job.findMany({
    where: {
      userId,
      modelConfigId: recentJob.modelConfigId,
      status: 'COMPLETED',
      avgConfidence: { not: null }
    },
    orderBy: { completedAt: 'desc' },
    take: 5,
    select: {
      id: true,
      fileName: true,
      avgConfidence: true,
      extractedFieldsCount: true,
      completedAt: true
    }
  });

  // Calculate average confidence for this model
  const modelJobs = await prisma.job.findMany({
    where: {
      userId,
      modelConfigId: recentJob.modelConfigId,
      status: 'COMPLETED',
      avgConfidence: { not: null }
    }
  });

  const avgConfidence = calculateAvgConfidence(modelJobs);

  // Count enabled fields
  const enabledFields = recentJob.modelConfig.fieldConfigs.filter(f => f.isEnabled).length;

  return {
    currentModel: {
      id: recentJob.modelConfigId,
      version: recentJob.modelConfig.azureModelId,
      displayName: recentJob.modelConfig.displayName
    },
    avgConfidence,
    fieldsExtracted: {
      successful: recentJob.extractedFieldsCount || 0,
      total: enabledFields
    },
    recentExtractions: recentExtractions.map(job => ({
      id: job.id,
      fileName: job.fileName,
      confidence: job.avgConfidence,
      fieldsExtracted: job.extractedFieldsCount,
      completedAt: job.completedAt
    }))
  };
};

// Main analytics function
export const getDashboardAnalytics = async (userId) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);
  const lastMonth = new Date(today);
  lastMonth.setDate(lastMonth.getDate() - 30);

  // Get jobs for different time periods
  const [todayJobs, yesterdayJobs, allJobs, user] = await Promise.all([
    prisma.job.findMany({
      where: {
        userId,
        createdAt: { gte: today }
      }
    }),
    prisma.job.findMany({
      where: {
        userId,
        createdAt: {
          gte: yesterday,
          lt: today
        }
      }
    }),
    prisma.job.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true }
    })
  ]);

  // Calculate metrics
  const successRate = calculateSuccessRate(allJobs);
  const yesterdaySuccessRate = calculateSuccessRate(yesterdayJobs);
  const successRateTrend = successRate - yesterdaySuccessRate;

  const avgProcessingTime = calculateAvgProcessingTime(allJobs);
  const yesterdayAvgTime = calculateAvgProcessingTime(yesterdayJobs);
  const timeTrend = yesterdayAvgTime - avgProcessingTime; // Negative is better

  const documentsToday = todayJobs.length;
  const documentsYesterday = yesterdayJobs.length;
  const documentsTrend = documentsToday - documentsYesterday;

  const accuracyScore = calculateAvgConfidence(allJobs);
  const yesterdayAccuracy = calculateAvgConfidence(yesterdayJobs);
  const accuracyTrend = accuracyScore - yesterdayAccuracy;

  // Get model performance
  const modelPerformance = await getModelPerformance(userId);

  // Get processing statistics
  const [documentsWeek, documentsMonth] = await Promise.all([
    prisma.job.count({
      where: {
        userId,
        createdAt: { gte: lastWeek }
      }
    }),
    prisma.job.count({
      where: {
        userId,
        createdAt: { gte: lastMonth }
      }
    })
  ]);

  // Get success metrics
  const failedJobs = await prisma.job.count({
    where: {
      userId,
      status: 'FAILED'
    }
  });

  // Calculate credit usage
  const creditsToday = todayJobs.reduce((sum, job) => sum + (job.creditsUsed || 0), 0);
  const creditsYesterday = yesterdayJobs.reduce((sum, job) => sum + (job.creditsUsed || 0), 0);

  // Get credit usage trend for last 7 days
  const creditUsageTrend = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    
    const dayJobs = await prisma.job.findMany({
      where: {
        userId,
        createdAt: {
          gte: date,
          lt: nextDate
        }
      },
      select: { creditsUsed: true }
    });
    
    const credits = dayJobs.reduce((sum, job) => sum + (job.creditsUsed || 0), 0);
    creditUsageTrend.push({ date: date.toISOString().split('T')[0], credits });
  }

  // Get field extraction insights
  const extractionAnalytics = await prisma.extractionAnalytics.groupBy({
    by: ['fieldName'],
    where: {
      userId,
      extractionDate: { gte: lastMonth }
    },
    _count: { fieldName: true },
    _avg: { confidenceScore: true },
    orderBy: { _count: { fieldName: 'desc' } },
    take: 10
  });

  const mostExtractedFields = extractionAnalytics.slice(0, 5).map(f => ({
    name: f.fieldName,
    count: f._count.fieldName,
    avgConfidence: f._avg.confidenceScore
  }));

  const fieldsByConfidence = [...extractionAnalytics].sort((a, b) => 
    (b._avg.confidenceScore || 0) - (a._avg.confidenceScore || 0)
  );

  const highestConfidenceFields = fieldsByConfidence.slice(0, 5).map(f => ({
    name: f.fieldName,
    avgConfidence: f._avg.confidenceScore,
    count: f._count.fieldName
  }));

  const lowestConfidenceFields = fieldsByConfidence.slice(-5).reverse().map(f => ({
    name: f.fieldName,
    avgConfidence: f._avg.confidenceScore,
    count: f._count.fieldName
  }));

  return {
    stats: {
      successRate: {
        value: `${successRate.toFixed(1)}%`,
        trend: successRateTrend > 0 ? `+${successRateTrend.toFixed(1)}%` : `${successRateTrend.toFixed(1)}%`
      },
      avgProcessingTime: {
        value: `${avgProcessingTime}s`,
        trend: timeTrend > 0 ? `+${timeTrend}s` : `${timeTrend}s`
      },
      documentsToday: {
        value: documentsToday,
        trend: documentsTrend > 0 ? `+${documentsTrend}` : `${documentsTrend}`
      },
      accuracyScore: {
        value: `${accuracyScore.toFixed(1)}%`,
        trend: accuracyTrend > 0 ? `+${accuracyTrend.toFixed(1)}%` : `${accuracyTrend.toFixed(1)}%`
      }
    },
    modelPerformance,
    activeModel: modelPerformance.currentModel ? {
      ...modelPerformance.currentModel,
      availableFields: modelPerformance.fieldsExtracted.total,
      totalExtractions: allJobs.filter(j => j.modelConfigId === modelPerformance.currentModel.id).length
    } : null,
    processingStats: {
      documentsToday,
      documentsWeek,
      documentsMonth,
      avgProcessingTime
    },
    successMetrics: {
      overallSuccessRate: successRate,
      todaySuccessRate: calculateSuccessRate(todayJobs),
      failedJobs,
      avgRetryCount: 0 // TODO: Implement retry tracking
    },
    creditUsage: {
      creditsToday,
      creditsRemaining: user?.credits || 0,
      avgCreditsPerDoc: documentsToday > 0 ? Math.round(creditsToday / documentsToday) : 0,
      usageTrend: creditUsageTrend
    },
    fieldInsights: {
      mostExtracted: mostExtractedFields,
      highestConfidence: highestConfidenceFields,
      lowestConfidence: lowestConfidenceFields,
      fieldSuccessRate: extractionAnalytics.length > 0 ? 
        (extractionAnalytics.filter(f => (f._avg.confidenceScore || 0) > 0.8).length / extractionAnalytics.length * 100).toFixed(1) : 
        '0'
    }
  };
};

// Get analytics for admin dashboard
export const getAdminAnalytics = async () => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastMonth = new Date(today);
  lastMonth.setMonth(lastMonth.getMonth() - 1);

  const [totalUsers, totalDocuments, creditsUsed, activeSessions] = await Promise.all([
    prisma.user.count(),
    prisma.job.count(),
    prisma.job.aggregate({
      _sum: { creditsUsed: true }
    }),
    prisma.processingSession.count({
      where: {
        status: { in: ['PROCESSING', 'UPLOADING'] }
      }
    })
  ]);

  // Calculate trends (comparing to last month)
  const [lastMonthUsers, lastMonthDocuments, lastMonthCredits] = await Promise.all([
    prisma.user.count({
      where: { createdAt: { lt: lastMonth } }
    }),
    prisma.job.count({
      where: { createdAt: { lt: lastMonth } }
    }),
    prisma.job.aggregate({
      where: { createdAt: { lt: lastMonth } },
      _sum: { creditsUsed: true }
    })
  ]);

  const usersTrend = lastMonthUsers > 0 ? 
    ((totalUsers - lastMonthUsers) / lastMonthUsers * 100) : 0;
  const documentsTrend = lastMonthDocuments > 0 ? 
    ((totalDocuments - lastMonthDocuments) / lastMonthDocuments * 100) : 0;
  const creditsTrend = lastMonthCredits._sum.creditsUsed > 0 ? 
    (((creditsUsed._sum.creditsUsed || 0) - (lastMonthCredits._sum.creditsUsed || 0)) / lastMonthCredits._sum.creditsUsed * 100) : 0;

  // Get average API response time from recent jobs
  const recentJobs = await prisma.job.findMany({
    where: {
      processingStartTime: { not: null },
      processingEndTime: { not: null },
      status: 'COMPLETED'
    },
    orderBy: { completedAt: 'desc' },
    take: 100
  });

  const avgResponseTime = calculateAvgProcessingTime(recentJobs) * 1000; // Convert to ms

  // Calculate storage usage (estimate based on job count and average file size)
  const avgFileSize = 500 * 1024; // 500KB average
  const totalStorage = totalDocuments * avgFileSize;
  const maxStorage = 100 * 1024 * 1024 * 1024; // 100GB
  const storageUsage = Math.round((totalStorage / maxStorage) * 100);

  return {
    totalUsers,
    totalDocuments,
    creditsUsed: creditsUsed._sum.creditsUsed || 0,
    activeSessions,
    usersTrend,
    documentsTrend,
    creditsTrend,
    apiResponseTime: avgResponseTime,
    storageUsage
  };
};