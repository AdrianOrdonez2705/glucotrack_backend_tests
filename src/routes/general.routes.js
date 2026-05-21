import express from 'express';
import GeneralController from '../controllers/general.controller.js';

const router = express.Router();

router.get('/momentos', GeneralController.verMomentos);
router.get('/niveles', GeneralController.verNiveles);
router.get('/enfermedades', GeneralController.verEnfermedades);
router.get('/tratamientos', GeneralController.verTratamientos);
router.get('/especialidades', GeneralController.verEspecialidades);
router.get('/auditoria', GeneralController.verAuditoria);

export default router;
