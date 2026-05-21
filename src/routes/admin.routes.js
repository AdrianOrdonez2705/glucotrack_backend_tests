import express from 'express';
import AdminController from '../controllers/admin.controller.js';
import auditoriaAdmin from '../middlewares/auditoria.admin.js';

const router = express.Router();

router.post('/agregar', auditoriaAdmin, AdminController.agregarAdmin);

router.get('/pacientes/activos', AdminController.pacientesActivos);
router.get('/pacientes/solicitantes', AdminController.pacientesSolicitantes);
router.get('/obtenerAdmins/:idAdmin', auditoriaAdmin, AdminController.obtenerAdmins);
router.put('/paciente/activar/:idPaciente', auditoriaAdmin, AdminController.activarPaciente);

router.get('/medicos/activos', AdminController.medicosActivos);
router.get('/medicos/solicitantes', AdminController.medicosSolicitantes);
router.get('/perfilAdmin/:idUsuario', auditoriaAdmin, AdminController.perfilAdmin);
router.put('/medico/activar/:idMedico', auditoriaAdmin, AdminController.activarMedico);

export default router;
