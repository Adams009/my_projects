import {Router} from 'express'
import AuthController from '#controllers/authController.js';
import { registerValidator, loginValidator } from "#validators/authValidator.js";
import validatorMiddleware from "#middlewares/validatorMiddleware.js";

const router = Router();
const authController = new AuthController();

router.post('/register', registerValidator, validatorMiddleware, authController.register.bind(authController));
router.post('/login', loginValidator, validatorMiddleware, authController.login.bind(authController));
router.post('/refresh-token', authController.refreshToken.bind(authController));

export default router;