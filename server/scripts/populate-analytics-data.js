import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

async function populateAnalyticsData() {
  console.log('🌱 Starting to populate analytics data...');

  try {
    // Create test users
    const users = [];
    for (let i = 0; i < 50; i++) {
      const createdAt = faker.date.past({ years: 1 });
      const user = await prisma.user.create({
        data: {
          email: faker.internet.email(),
          name: faker.person.fullName(),
          googleId: faker.string.uuid(),
          credits: faker.number.int({ min: 0, max: 500 }),
          role: faker.helpers.arrayElement(['USER', 'ADMIN']),
          createdAt,
          lastLoginAt: faker.date.between({ from: createdAt, to: new Date() })
        }
      });
      users.push(user);
    }
    console.log(`✅ Created ${users.length} users`);

    // Create processing sessions and jobs
    for (const user of users.slice(0, 30)) { // Use first 30 users
      const sessionCount = faker.number.int({ min: 1, max: 5 });
      
      for (let s = 0; s < sessionCount; s++) {
        const sessionCreatedAt = faker.date.between({ 
          from: user.createdAt, 
          to: new Date() 
        });
        
        const session = await prisma.processingSession.create({
          data: {
            userId: user.id,
            status: faker.helpers.arrayElement(['completed', 'failed', 'processing']),
            totalPages: faker.number.int({ min: 1, max: 20 }),
            processedPages: faker.number.int({ min: 0, max: 20 }),
            modelId: 'Silvi_Reader_Full_2.0',
            createdAt: sessionCreatedAt,
            updatedAt: sessionCreatedAt
          }
        });

        // Create jobs for each session
        const jobCount = faker.number.int({ min: 1, max: 10 });
        for (let j = 0; j < jobCount; j++) {
          const jobCreatedAt = new Date(sessionCreatedAt.getTime() + j * 60000); // Space out by 1 minute
          const status = faker.helpers.arrayElement(['completed', 'failed', 'processing']);
          
          await prisma.job.create({
            data: {
              userId: user.id,
              sessionId: session.id,
              fileName: faker.system.fileName({ extensionCount: 0 }) + '.pdf',
              originalName: faker.system.fileName({ extensionCount: 0 }) + '.pdf',
              pageNumber: j + 1,
              status,
              error: status === 'failed' ? faker.helpers.arrayElement([
                'Document processing failed',
                'Invalid file format',
                'Azure API timeout',
                'Extraction failed'
              ]) : null,
              createdAt: jobCreatedAt,
              updatedAt: new Date(jobCreatedAt.getTime() + faker.number.int({ min: 1000, max: 30000 }))
            }
          });
        }
      }
    }
    console.log('✅ Created processing sessions and jobs');

    // Create transactions (credit usage and purchases)
    for (const user of users) {
      // Credit purchases
      const purchaseCount = faker.number.int({ min: 0, max: 3 });
      for (let p = 0; p < purchaseCount; p++) {
        const purchaseDate = faker.date.between({ 
          from: user.createdAt, 
          to: new Date() 
        });
        
        await prisma.transaction.create({
          data: {
            userId: user.id,
            type: 'PURCHASE',
            amount: faker.helpers.arrayElement([50, 100, 250, 500, 1000]),
            description: 'Credit purchase',
            createdAt: purchaseDate
          }
        });
      }

      // Credit usage
      const usageCount = faker.number.int({ min: 0, max: 20 });
      for (let u = 0; u < usageCount; u++) {
        const usageDate = faker.date.between({ 
          from: user.createdAt, 
          to: new Date() 
        });
        
        await prisma.transaction.create({
          data: {
            userId: user.id,
            type: 'DEDUCT',
            amount: faker.number.int({ min: 1, max: 10 }),
            description: 'Document processing',
            createdAt: usageDate
          }
        });
      }
    }
    console.log('✅ Created transactions');

    // Create audit logs
    const actions = [
      'USER_LOGIN',
      'USER_LOGOUT',
      'DOCUMENT_UPLOADED',
      'DOCUMENT_PROCESSED',
      'CREDITS_ADDED',
      'CREDITS_DEDUCTED',
      'SESSION_CREATED',
      'SESSION_COMPLETED'
    ];

    for (const user of users.slice(0, 20)) { // Use first 20 users
      const logCount = faker.number.int({ min: 5, max: 15 });
      
      for (let l = 0; l < logCount; l++) {
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: faker.helpers.arrayElement(actions),
            entityType: faker.helpers.arrayElement(['USER', 'SESSION', 'JOB', 'TRANSACTION']),
            entityId: faker.string.uuid(),
            ipAddress: faker.internet.ip(),
            userAgent: faker.internet.userAgent(),
            createdAt: faker.date.between({ 
              from: user.createdAt, 
              to: new Date() 
            })
          }
        });
      }
    }
    console.log('✅ Created audit logs');

    // Get summary
    const [userCount, jobCount, transactionCount] = await Promise.all([
      prisma.user.count(),
      prisma.job.count(),
      prisma.transaction.count()
    ]);

    console.log('\n📊 Summary:');
    console.log(`   Users: ${userCount}`);
    console.log(`   Jobs: ${jobCount}`);
    console.log(`   Transactions: ${transactionCount}`);
    console.log('\n✨ Analytics data population complete!');

  } catch (error) {
    console.error('❌ Error populating data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
populateAnalyticsData();