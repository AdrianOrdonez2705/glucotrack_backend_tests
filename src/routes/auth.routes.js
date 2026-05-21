import express from 'express';
import AuthController from '../controllers/auth.controller.js';
import auditoriaEndpoint from '../middlewares/auditoria.login.js';

const router = express.Router();

router.post('/api/login', auditoriaEndpoint(), AuthController.login);
router.post('/api/verify-otp', auditoriaEndpoint(), AuthController.verifyOtp);
router.put('/usuario/:id_usuario/password', AuthController.updatePassword);

export default router;
