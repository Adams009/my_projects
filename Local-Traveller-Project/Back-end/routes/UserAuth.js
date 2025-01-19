import express from 'express';

import registerController from '../controllers/UserReg.js';
import { loginLimiter, refreshTokenLimiter } from '../utils/limiters.js';
import { loginUser, refreshToken, logoutUser } from '../controllers/UserAuth.js';

const router = express.Router();

router.post('/register', registerController)
router.post('/login', loginLimiter, loginUser)
router.post('/refresh', refreshTokenLimiter, refreshToken)
router.post('/logout', logoutUser)


export default router