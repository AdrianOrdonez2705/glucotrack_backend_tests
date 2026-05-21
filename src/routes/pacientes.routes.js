import express from 'express';
import multer from 'multer';
import PacienteController from '../controllers/paciente.controller.js';
import auditoriaPaciente from '../middlewares/auditoria.paciente.js';

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/perfil/:idPaciente', auditoriaPaciente, PacienteController.perfilPaciente);
router.get('/registros/:idPaciente', auditoriaPaciente, PacienteController.registrosPaciente);

router.post('/registrarGlucosa', auditoriaPaciente, PacienteController.registrarGlucosa);
router.post(
  '/registrarPaciente',
  upload.fields([{ name: 'foto_perfil', maxCount: 1 }]),
  PacienteController.registrarPaciente,
);

router.put('/actualizarPaciente/:id_usuario', auditoriaPaciente, PacienteController.actualizarPaciente);

router.get('/obtenerDatosEmbarazo/:id_paciente', PacienteController.obtenerSemanasEmbarazoActual);

export default router;
