import express from 'express';
import RegistroController from '../controllers/registro.controller.js';
import auditoriaPaciente from '../middlewares/auditoria.paciente.js';

const router = express.Router();

router.get('/datosGlucosa/:idUsuario', RegistroController.datosParaGlucosa);
router.post('/registrarAlerta', auditoriaPaciente, RegistroController.registrarAlerta);

export default router;
