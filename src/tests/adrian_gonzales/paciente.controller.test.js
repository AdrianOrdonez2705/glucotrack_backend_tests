import { describe, it, expect, vi, beforeEach } from 'vitest';
import PacienteController from '../../controllers/paciente.controller.js';
import supabase from '../../config/database.js';
import bcrypt from 'bcrypt';

// --- CONFIGURACIÓN DE MOCKS ---

vi.mock('../../config/database.js', () => {
  const storageMock = {
    from: vi.fn().mockReturnThis(),
    upload: vi.fn(),
    getPublicUrl: vi.fn(),
  };

  const cadenaMock = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    storage: storageMock,
    then: vi.fn(),
  };

  return { default: cadenaMock };
});

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
  },
}));

vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('Pruebas Unitarias de PacienteController', () => {
  let req, res;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      originalUrl: '/api/test',
      method: 'GET',
      ip: '127.0.0.1',
      params: {},
      body: {},
      files: {},
    };

    res = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
  });

  // ==========================================
  // TESTS: registrarPaciente
  // ==========================================
  describe('registrarPaciente', () => {
    it('debería retornar 400 si falta el archivo de perfil', async () => {
      // 1. Preparación de la prueba
      req.files = {}; // Sin foto_perfil

      // 2. Lógica de la prueba
      await PacienteController.registrarPaciente(req, res);

      // 3. Verificación o Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Archivo de perfil faltante' });
    });

    it('debería retornar 400 si falta algún campo obligatorio en el body', async () => {
      // 1. Preparación de la prueba
      req.files = {
        foto_perfil: [{ originalname: 'avatar.png', buffer: Buffer.from('abc'), mimetype: 'image/png' }],
      };
      req.body = {
        nombre_completo: 'Test Paciente',
        correo: 'paciente@test.com',
        // Falta la contraseña y otros campos
      };

      // Simulamos la subida de la imagen y la url pública
      supabase.storage.upload.mockResolvedValueOnce({ data: { path: 'imgs/avatar.png' }, error: null });
      supabase.storage.getPublicUrl.mockReturnValueOnce({ data: { publicUrl: 'http://test.com/avatar.png' } });

      // 2. Lógica de la prueba
      await PacienteController.registrarPaciente(req, res);

      // 3. Verificación o Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Todos los campos obligatorios deben ser llenados' });
    });

  });

  // ==========================================
  // TESTS: perfilPaciente
  // ==========================================
  describe('perfilPaciente', () => {

    it('debería retornar 404 si el paciente no es encontrado', async () => {
      // 1. Preparación de la prueba
      req.params = { idPaciente: '10' };
      supabase.then.mockImplementationOnce((resolve) => resolve({ data: null, error: null }));

      // 2. Lógica de la prueba
      await PacienteController.perfilPaciente(req, res);

      // 3. Verificación o Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'No se encontró el paciente solicitado' });
    });


    it('debería retornar el perfil del paciente correctamente formateado', async () => {
      // 1. Preparación de la prueba
      req.params = { idPaciente: '10' };

      const mockDbData = {
        id_paciente: 10,
        genero: 'F',
        altura: 1.65,
        peso: 60.0,
        embarazo: true,
        nombre_emergencia: 'Ana Gomez',
        numero_emergencia: '77788899',
        foto_perfil: 'http://supabase.com/avatar.png',
        usuario: {
          id_usuario: 45,
          nombre_completo: 'Ana Lopez',
          fecha_nac: '1992-04-20T00:00:00',
          teléfono: '77799988',
          correo: 'ana@gmail.com',
          fecha_registro: '2026-01-01T00:00:00',
        },
        nivel_actividad_fisica: {
          descripcion: 'Bajo',
        },
        medico: {
          usuario: {
            nombre_completo: 'Dr. House',
          },
        },
        administrador: {
          usuario: {
            nombre_completo: 'Admin Central',
          },
        },
        paciente_enfermedad: [
          {
            enfermedades_base: {
              nombre_enfermedad: 'Diabetes Tipo 1',
            },
          },
        ],
        tratamiento_enfermedad: [
          {
            dosis: '10mg',
            tratamientos: {
              nombre_tratamiento: 'Insulina',
              descripcion: 'Inyección diaria',
            },
          },
        ],
        seguimiento_embarazo: [
          {
            semanas_embarazo: 8,
            fecha_registro: '2025-01-01T00:00:00',
            fecha_terminacion: '2025-09-01T00:00:00',
          },
          {
            semanas_embarazo: 12,
            fecha_registro: '2026-05-01T00:00:00',
            fecha_terminacion: null,
          },
        ],
      };

      supabase.then.mockImplementationOnce((resolve) => resolve({ data: mockDbData, error: null }));

      // 2. Lógica de la prueba
      await PacienteController.perfilPaciente(req, res);

      // 3. Verificación o Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        nombre: 'Ana Lopez',
        id: '45',
        fechaNac: '20/04/1992',
        genero: 'F',
        altura: 1.65,
        peso: 60.0,
        telefono: '77799988',
        correo: 'ana@gmail.com',
        nombre_emergencia: 'Ana Gomez',
        numero_emergencia: '77788899',
        foto_perfil: 'http://supabase.com/avatar.png',
        nombre_medico: 'Dr. House',
        fecha_registro: '2026-01-01T00:00:00',
        admitidoPor: 'Admin Central',
        actividadFisica: {
          nivel: 'Bajo',
          descripcion: 'Bajo',
        },
        afecciones: ['Diabetes Tipo 1'],
        tratamientos: [
          {
            titulo: 'Insulina',
            descripcion: 'Inyección diaria',
            dosis: '10mg',
          },
        ],
        embarazo: true,
        semanas_embarazo: 12,
        registro_embarazo: '2026-05-01T00:00:00',
      });
    });
  });

  // ==========================================
  // TESTS: registrosPaciente
  // ==========================================
  describe('registrosPaciente', () => {

    it('debería retornar la lista de registros correctamente formateada', async () => {
      // 1. Preparación de la prueba
      req.params = { idPaciente: '10' };

      const mockDbData = [
        {
          id_registro: 5,
          fecha: '2026-06-01',
          hora: '08:00:00',
          nivel_glucosa: '110.5',
          observaciones: 'Ninguna',
          momento_dia: {
            momento: 'Antes de desayunar',
          },
          medico: {
            usuario: {
              nombre_completo: 'Dr. House',
            },
          },
          alertas: [
            {
              id_alerta: 1,
              tipo_alerta: {
                tipo: 'Moderada',
              },
              retroalimentacion: {
                mensaje: 'Reduce azúcares',
              },
            },
          ],
        },
      ];

      supabase.then.mockImplementationOnce((resolve) => resolve({ data: mockDbData, error: null }));

      // 2. Lógica de la prueba
      await PacienteController.registrosPaciente(req, res);

      // 3. Verificación o Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([
        {
          id: 5,
          fecha: '2026-06-01',
          hora: '08:00',
          nivelGlucosa: 110.5,
          momentoDia: 'Antes de desayunar',
          quienTomoMuestra: 'Dr. House',
          observaciones: 'Ninguna',
          idAlerta: 1,
          tipo_alerta: 'Moderada',
          placeholderRetro: null,
          respuesta: 'Reduce azúcares',
        },
      ]);
    });
  });

  // ==========================================
  // TESTS: registrarGlucosa
  // ==========================================
  describe('registrarGlucosa', () => {
    it('debería retornar 400 si faltan campos obligatorios', async () => {
      // 1. Preparación de la prueba
      req.body = {
        fecha: '2026-06-01',
        hora: '08:00',
        // faltan otros campos
      };

      // 2. Lógica de la prueba
      await PacienteController.registrarGlucosa(req, res);

      // 3. Verificación o Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Todos los campos (menos observaciones) deben estar llenados' });
    });

    it('debería registrar correctamente la glucosa', async () => {
      // 1. Preparación de la prueba
      req.body = {
        fecha: '2026-06-01',
        hora: '08:00',
        id_momento: 1,
        id_paciente: 10,
        nivel_glucosa: 120,
        observaciones: 'Todo bien',
      };

      supabase.then.mockImplementationOnce((resolve) => resolve({ data: [{ id: 50, ...req.body }], error: null }));

      // 2. Lógica de la prueba
      await PacienteController.registrarGlucosa(req, res);

      // 3. Verificación o Assert
      expect(supabase.from).toHaveBeenCalledWith('registro_glucosa');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Registro insertado correctamente',
        id_registro: 50,
        registro_glucosa: expect.objectContaining({ id: 50 }),
      });
    });

  });

  // ==========================================
  // TESTS: actualizarPaciente
  // ==========================================
  describe('actualizarPaciente', () => {
    it('debería retornar 400 si faltan datos obligatorios', async () => {
      // 1. Preparación de la prueba
      req.params = { id_usuario: '5' };
      req.body = {
        nombre: 'Actualizado',
        // Faltan altura, peso, etc.
      };

      // 2. Lógica de la prueba
      await PacienteController.actualizarPaciente(req, res);

      // 3. Verificación o Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Faltan datos obligatorios' });
    });

  });

  // ==========================================
  // TESTS: obtenerSemanasEmbarazoActual
  // ==========================================
  describe('obtenerSemanasEmbarazoActual', () => {
    it('debería retornar null si el paciente no está embarazada', async () => {
      // 1. Preparación de la prueba
      req.params = { id_paciente: '10' };
      supabase.then.mockImplementationOnce((resolve) => resolve({ data: { embarazo: false }, error: null }));

      // 2. Lógica de la prueba
      await PacienteController.obtenerSemanasEmbarazoActual(req, res);

      // 3. Verificación o Assert
      expect(res.json).toHaveBeenCalledWith({ semanas_actuales: null });
    });


    it('debería calcular y retornar las semanas de embarazo correctamente si hay seguimiento activo', async () => {
      // 1. Preparación de la prueba
      req.params = { id_paciente: '10' };

      // Registro de hace 14 días (exactamente 2 semanas adicionales)
      const fechaRegistro = new Date();
      fechaRegistro.setDate(fechaRegistro.getDate() - 14);

      // 1. Select paciente (embarazo: true)
      // 2. Select seguimiento_embarazo
      supabase.then
        .mockImplementationOnce((resolve) => resolve({ data: { embarazo: true }, error: null }))
        .mockImplementationOnce((resolve) =>
          resolve({
            data: [
              {
                fecha_registro: fechaRegistro.toISOString(),
                semanas_embarazo: 8,
              },
            ],
            error: null,
          })
        );

      // 2. Lógica de la prueba
      await PacienteController.obtenerSemanasEmbarazoActual(req, res);

      // 3. Verificación o Assert
      expect(res.json).toHaveBeenCalledWith({ semanas_actuales: 10 });
    });

  });
});
