import express from 'express';
import multer from 'multer';
import MedicoController from '../controllers/medico.controller.js';
import auditoriaMedico from '../middlewares/auditoria.medico.js';

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post(
  '/registrar',
  upload.fields([
    { name: 'matriculaProfesional', maxCount: 1 },
    { name: 'carnetProfesional', maxCount: 1 },
  ]),
  MedicoController.registrarMedico,
);

router.post('/responder/alerta', auditoriaMedico, MedicoController.retroalimentacionAlerta);
router.post('/registrar/glucosa', auditoriaMedico, MedicoController.registrarGlucosaMedico);
router.get('/perfil/:idUsuario', auditoriaMedico, MedicoController.perfilMedico);
router.get('/ver', MedicoController.verMedicos);
router.get('/misPacientes/:idMedico', auditoriaMedico, MedicoController.verPacientes);
router.get('/alertasActivas/:idMedico', auditoriaMedico, MedicoController.alertasActivas);
router.get('/alertasResueltas/:idMedico', auditoriaMedico, MedicoController.alertasResueltas);
router.put('/actualizar/:id_medico', auditoriaMedico, upload.single('carnet'), MedicoController.actualizarMedico);

export default router;
