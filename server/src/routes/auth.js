import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Helper function to create session
const createSession = async (userId) => {
  // Clean up any expired sessions for this user
  await prisma.session.deleteMany({
    where: {
      userId,
      expiresAt: {
        lt: new Date()
      }
    }
  });

  // Check which secret we're using
  const jwtSecret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  
  if (!jwtSecret) {
    throw new Error('JWT_SECRET or SESSION_SECRET must be defined in environment variables');
  }

  // Add timestamp and random string to ensure uniqueness
  const token = jwt.sign(
    { 
      userId,
      timestamp: Date.now(),
      random: Math.random().toString(36).substring(7)
    },
    jwtSecret,
    { expiresIn: '7d' }
  );

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  try {
    await prisma.session.create({
      data: {
        userId,
        token,
        expiresAt
      }
    });
  } catch (error) {
    // If token already exists (extremely unlikely), generate a new one
    if (error.code === 'P2002') {
      return createSession(userId); // Recursive call with new random values
    }
    throw error;
  }

  return token;
};

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        credits: 0 // New users start with 0 credits
      }
    });

    // Create session
    const token = await createSession(user.id);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      domain: process.env.COOKIE_DOMAIN // Optional: for subdomain sharing
    });

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        credits: user.credits
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    // Create session
    const token = await createSession(user.id);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      domain: process.env.COOKIE_DOMAIN // Optional: for subdomain sharing
    });

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        credits: user.credits
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Failed to login' });
  }
});

// Google OAuth
router.get('/google', (req, res, next) => {
  // Store admin flag in session if present
  if (req.query.admin === 'true') {
    req.session = req.session || {};
    req.session.isAdminLogin = true;
    console.log('Admin login flag set in session:', req.session.isAdminLogin);
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get('/google/callback',
  passport.authenticate('google', { session: false }),
  async (req, res) => {
    try {
      const user = req.user;
      
      // Check if this is an admin login attempt
      const isAdminLogin = req.session?.isAdminLogin === true;
      console.log('Google callback - isAdminLogin:', isAdminLogin, 'session:', req.session);
      
      if (isAdminLogin) {
        // Clean up session flag
        if (req.session) {
          delete req.session.isAdminLogin;
        }
        
        // Redirect to admin auth handler
        return res.redirect(`/api/admin/auth/google/callback?userId=${user.id}`);
      }
      
      // Regular client login
      const token = await createSession(user.id);

      // Redirect to frontend with token
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      return res.redirect(`${clientUrl}/auth/callback?token=${token}`);
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      return res.redirect(`${clientUrl}/auth/error`);
    }
  }
);

// Logout
router.post('/logout', async (req, res) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
    
    if (token) {
      await prisma.session.delete({ where: { token } });
    }

    res.clearCookie('token');
    return res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ error: 'Failed to logout' });
  }
});

// Test endpoint to check JWT configuration
router.get('/test-jwt', async (req, res) => {
  const jwtSecret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  return res.json({
    hasJwtSecret: !!process.env.JWT_SECRET,
    hasSessionSecret: !!process.env.SESSION_SECRET,
    secretDefined: !!jwtSecret,
    nodeEnv: process.env.NODE_ENV
  });
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Session expired' });
    }

    return res.json({
      user: {
        id: session.user.id,
        email: session.user.email,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        role: session.user.role,
        credits: session.user.credits,
        profilePicture: session.user.profilePicture
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({ error: 'Failed to get user' });
  }
});

export default router;