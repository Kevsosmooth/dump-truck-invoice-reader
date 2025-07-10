import { Router } from 'express';
import bcrypt from 'bcryptjs';

const router = Router();

// Temporary endpoint to generate bcrypt hash
router.get('/generate-hash', async (req, res) => {
  const password = 'password123';
  const hash = await bcrypt.hash(password, 10);
  
  return res.json({
    password,
    hash,
    info: 'Use this hash to update the test account in Supabase'
  });
});

export default router;