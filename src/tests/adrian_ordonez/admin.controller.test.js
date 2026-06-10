// Pruebas Unitarias para admin.controller.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminController from '../../controllers/admin.controller.js';
import supabase from '../../config/database.js';
import bcrypt from 'bcrypt';

// --- CONFIGURACIÓN DE MOCKS ---

// Simulamos la dependencia de Supabase para interceptar consultas encadenadas
vi.mock('../../config/database.js', () => {
  const cadenaMock = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),

    // Supabase usa Promises internamente; simular "then"
    // permite interceptar el await final
    then: vi.fn(),
  };

  return { default: cadenaMock };
});

// Simulamos bcrypt globalmente para controlar el hashing
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
  },
}));

// Silenciar console.log y console.error
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('Pruebas Unitarias de AdminController', () => {
  let req, res;

  beforeEach(() => {
    vi.clearAllMocks();

    // Fábrica de objetos Request y Response simulados para Express
    req = {
      originalUrl: '/api/test',
      method: 'GET',
      ip: '127.0.0.1',
      params: {},
      body: {},
    };

    res = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
  });

  // ==========================================
  // TESTS: medicosActivos
  // ==========================================

  describe('medicosActivos', () => {
    // Estas son las pruebas unitarias it() es como @Test en java
    it('debería retornar correctamente una lista formateada de médicos activos', async () => {
      // 1. Preparación (Arrange)

      const datosMockDb = [
        {
          id_medico: 1,
          matricula_profesional: 'MP-123',
          departamento: 'La Paz',
          carnet_profesional: 'CI-888',

          usuario: {
            nombre_completo: 'Dr. John Doe',
            fecha_nac: '1980-05-15T00:00:00',
            teléfono: '77777777',
            correo: 'john@medical.com',
            estado: true,
          },

          administrador: {
            usuario: {
              nombre_completo: 'Admin Central',
            },
          },
        },
      ];

      supabase.then.mockImplementationOnce((resolve) =>
        resolve({
          data: datosMockDb,
          error: null,
          status: 200,
        }),
      );

      // 2. Ejecución (Act)

      await AdminController.medicosActivos(req, res);

      // 3. Verificación (Assert)

      expect(supabase.from).toHaveBeenCalledWith('medico');

      expect(supabase.eq).toHaveBeenCalledWith('usuario.estado', true);

      expect(res.status).toHaveBeenCalledWith(200);

      expect(res.json).toHaveBeenCalledWith([
        {
          id: 1,
          nombre: 'Dr. John Doe',
          fechaNac: '1980-05-15T00:00:00',
          telefono: '77777777',
          correo: 'john@medical.com',
          matricula: 'MP-123',
          departamento: 'La Paz',
          carnet: 'CI-888',
          admitidoPor: 'Admin Central',
        },
      ]);
    });

    it('debería retornar estado 403 si ocurre un error de autorización en la base de datos', async () => {
      // 1. Preparación (Arrange)

      const errorMock = {
        code: '28P01',
        message: 'Invalid authorization specification',
      };

      supabase.then.mockImplementationOnce((resolve) =>
        resolve({
          data: null,
          error: errorMock,
          status: 403,
        }),
      );

      // 2. Ejecución (Act)

      await AdminController.medicosActivos(req, res);

      // 3. Verificación (Assert)

      expect(res.status).toHaveBeenCalledWith(403);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'DB_AUTH_ERROR',
        }),
      );
    });
  });

  // ==========================================
  // TESTS: activarMedico
  // ==========================================

  describe('activarMedico', () => {
    it('debería retornar 400 si falta idAdmin en el body', async () => {
      // 1. Preparación (Arrange)

      req.params = {
        idMedico: '5',
      };

      req.body = {}; // Sin idAdmin

      // 2. Ejecución (Act)

      await AdminController.activarMedico(req, res);

      // 3. Verificación (Assert)

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        error: 'No hay administrador',
      });
    });

    it('debería retornar 404 si el médico no existe en la base de datos', async () => {
      // 1. Preparación (Arrange)

      req.params = {
        idMedico: '15',
      };

      req.body = {
        idAdmin: '99',
      };

      supabase.then.mockImplementationOnce((resolve) =>
        resolve({
          data: null,
          error: null,
        }),
      );

      // 2. Ejecución (Act)

      await AdminController.activarMedico(req, res);

      // 3. Verificación (Assert)

      expect(res.status).toHaveBeenCalledWith(404);

      expect(res.json).toHaveBeenCalledWith({
        error: 'Médico no encontrado',
      });
    });
  });

  // ==========================================
  // TESTS: pacientesActivos
  // ==========================================

  describe('pacientesActivos', () => {
    it('debería formatear correctamente entidades complejas y fechas (DD/MM/YYYY)', async () => {
      // 1. Preparación (Arrange)

      const datosMockPacientes = [
        {
          id_paciente: 2,
          genero: 'M',
          peso: 75.5,
          altura: 1.78,
          foto_perfil: 'url_avatar',

          usuario: {
            nombre_completo: 'Jane Doe',
            fecha_nac: '1995-12-25T00:00:00',
            teléfono: '66666666',
            correo: 'jane@mail.com',
          },

          nivel_actividad_fisica: {
            descripcion: 'Moderado',
          },

          medico: {
            usuario: {
              nombre_completo: 'Dr. House',
            },
          },

          administrador: {
            usuario: {
              nombre_completo: 'Admin Lopez',
            },
          },

          paciente_enfermedad: [
            {
              enfermedades_base: {
                nombre_enfermedad: 'Diabetes T2',
              },
            },
          ],

          tratamiento_enfermedad: [
            {
              dosis: '850mg',

              tratamientos: {
                nombre_tratamiento: 'Metformina',
                descripcion: 'Oral diaria',
              },
            },
          ],
        },
      ];

      supabase.then.mockImplementationOnce((resolve) =>
        resolve({
          data: datosMockPacientes,
          error: null,
        }),
      );

      // 2. Ejecución (Act)

      await AdminController.pacientesActivos(req, res);

      // 3. Verificación (Assert)

      expect(res.status).toHaveBeenCalledWith(200);

      expect(res.json).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 2,
          nombre: 'Jane Doe',

          // Verificación del formateador interno de fechas
          fechaNac: '25/12/1995',

          peso: '75.5',
          actividadFisica: 'Moderado',
          medico: 'Dr. House',

          afecciones: [
            {
              afeccion: 'Diabetes T2',
            },
          ],

          tratamientos: [
            {
              titulo: 'Metformina',
              desc: 'Oral diaria',
              dosis: '850mg',
            },
          ],
        }),
      ]);
    });
  });

  // ==========================================
  // TESTS: perfilAdmin
  // ==========================================

  describe('perfilAdmin', () => {
    it('debería retornar 400 si idUsuario falta o no es un número válido', async () => {
      // 1. Preparación (Arrange)

      req.params = {
        idUsuario: 'abc',
      };

      // 2. Ejecución (Act)

      await AdminController.perfilAdmin(req, res);

      // 3. Verificación (Assert)

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        error: 'El ID de usuario debe ser un número válido',
      });
    });

    it('debería retornar 404 si el perfil del administrador no existe', async () => {
      // 1. Preparación (Arrange)

      req.params = {
        idUsuario: '999',
      };

      supabase.then.mockImplementationOnce((resolve) =>
        resolve({
          data: null,
          error: null,
        }),
      );

      // 2. Ejecución (Act)

      await AdminController.perfilAdmin(req, res);

      // 3. Verificación (Assert)

      expect(res.status).toHaveBeenCalledWith(404);

      expect(res.json).toHaveBeenCalledWith({
        message: 'No se encontró el administrador',
      });
    });
  });

  // ==========================================
  // TESTS: agregarAdmin
  // ==========================================

  describe('agregarAdmin', () => {
    it('debería retornar error 400 si faltan propiedades requeridas en el payload', async () => {
      // 1. Preparación (Arrange)

      req.body = {
        nombre: 'New Admin',
        correo: 'admin@test.com',
      };

      // faltan contraseña, cargo, etc.

      // 2. Ejecución (Act)

      await AdminController.agregarAdmin(req, res);

      // 3. Verificación (Assert)

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        error: 'Todos los campos deben ser llenados',
      });
    });

    it('debería hashear la contraseña y realizar correctamente las dos inserciones en base de datos', async () => {
      // 1. Preparación (Arrange)

      req.body = {
        nombre: 'Sandro Rossel',
        correo: 'sandro@hospital.com',
        contrasena: 'password123',
        fechaNacimiento: '1990-01-01',
        telefono: '78945612',
        cargo: 'Supervisor',
        fecha_registro: '2025-01-01',
        administrador_id_admin: 1,
      };

      bcrypt.hash.mockResolvedValueOnce('mocked_hashed_string');

      // Primera inserción (tabla usuario)
      // Segunda inserción (tabla administrador)

      supabase.then
        .mockImplementationOnce((resolve) =>
          resolve({
            data: [{ id_usuario: 45 }],
            error: null,
          }),
        )
        .mockImplementationOnce((resolve) =>
          resolve({
            data: [{ id_admin: 12 }],
            error: null,
          }),
        );

      // 2. Ejecución (Act)

      await AdminController.agregarAdmin(req, res);

      // 3. Verificación (Assert)

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);

      expect(supabase.insert).toHaveBeenNthCalledWith(1, [
        expect.objectContaining({
          nombre_completo: 'Sandro Rossel',
          contrasena: 'mocked_hashed_string',
          rol: 'administrador',
        }),
      ]);

      expect(supabase.insert).toHaveBeenNthCalledWith(2, [
        expect.objectContaining({
          id_usuario: 45,
          cargo: 'Supervisor',
        }),
      ]);

      expect(res.status).toHaveBeenCalledWith(200);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Usuario y admin registrados correctamente',
        }),
      );
    });

    it('debería ejecutar el bloque catch y responder con estado 500 cuando exista un error en la base de datos', async () => {
      // 1. Preparación (Arrange)

      req.body = {
        nombre: 'Sandro Rossel',
        correo: 'sandro@hospital.com',
        contrasena: 'password123',
        fechaNacimiento: '1990-01-01',
        telefono: '78945612',
        cargo: 'Supervisor',
        fecha_registro: '2025-01-01',
        administrador_id_admin: 1,
      };

      bcrypt.hash.mockResolvedValueOnce('hashed');

      supabase.then.mockImplementationOnce((resolve) =>
        resolve({
          data: null,
          error: new Error('Simulated DB Crash'),
        }),
      );

      // 2. Ejecución (Act)

      await AdminController.agregarAdmin(req, res);

      // 3. Verificación (Assert)

      expect(res.status).toHaveBeenCalledWith(500);

      expect(res.json).toHaveBeenCalledWith({
        error: 'Simulated DB Crash',
      });
    });
  });
});
