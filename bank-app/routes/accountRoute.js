import {Router} from 'express'
import AccountController from '#controllers/accountController.js';
import authMiddleware from '#middlewares/authMiddleware.js';
import { depositValidator, withdrawValidator } from "#validators/accountValidator.js";
import validatorMiddleware from '#middlewares/validatorMiddleware.js';

const router = Router();
const accountController = new AccountController();

router.get('/balance/:userId', authMiddleware, accountController.getBalance.bind(accountController));
router.post('/deposit/:userId', authMiddleware, depositValidator, validatorMiddleware, accountController.deposit.bind(accountController));
router.post('/withdraw/:userId', authMiddleware, withdrawValidator, validatorMiddleware, accountController.withdraw.bind(accountController));

export default router;