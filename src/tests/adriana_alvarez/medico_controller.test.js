// PRUEBAS UNITARIAS — medico.controller.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MedicoController from '../../controllers/medico.controller.js';
import supabase from '../../config/database.js';
import bcrypt from 'bcrypt';

// ---------------------------------------
// CONFIGURACIÓN DE MOCKS
// ---------------------------------------

// Mock de Supabase: reemplaza la DB real por un objeto falso
// que imita el encadenamiento de métodos (from().select().eq()...)
vi.mock('../../config/database.js', () => {
  const cadenaMock = {
    // Métodos de consulta : cada uno devuelve "this" para poder seguir encadenando
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),

    // "then" es el punto donde el "await" resuelve la promesa.
    // Se controla en cada prueba con mockImplementationOnce()
    then: vi.fn(),

    // Mock del módulo storage de Supabase (para subida de archivos)
    storage: {
      from: vi.fn().mockReturnThis(),
      upload: vi.fn(),
      getPublicUrl: vi.fn(),
    },
  };

  return { default: cadenaMock };
});

// Mock de bcrypt reemplaza el hash real por una función controlable
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
  },
}));

// Silenciar logs para que no ensucien la salida del runner de tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

// ---------------------------------------
// SUITE PRINCIPAL
// ---------------------------------------

describe('Pruebas Unitarias de MedicoController', () => {
  let req, res;

  // beforeEach: se ejecuta ANTES de cada it()
  // Garantiza que cada prueba empieza con mocks limpios y req/res frescos
  beforeEach(() => {
    vi.clearAllMocks(); // Resetea contadores y resultados de llamadas anteriores

    // Objeto Request de Express simulado
    req = {
      originalUrl: '/api/test',
      method: 'GET',
      ip: '127.0.0.1',
      params: {},
      body: {},
      files: {},
      file: null,
    };

    // Objeto Response de Express simulado
    // mockReturnValue(res) permite encadenar: res.status(200).json(...)
    res = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
  });

  // ----------------------------------------------
  // PRUEBAS para registrarMedico con datos faltantes
  // ----------------------------------------------

  describe('registrarMedico', () => {

    // --------------------- PRUEBA 1 -----------------
    it('debería retornar 400 si falta el archivo de matrícula PDF', async () => {
      // 1. PREPARACIÓN
      // Simulamos que no se envió el archivo de matrícula.
      // req.files.matriculaProfesional está undefined
      req.files = {
        carnetProfesional: [{ originalname: 'carnet.jpg', buffer: Buffer.from(''), mimetype: 'image/jpeg' }],
      };
      req.body = {
        nombre_completo: 'Dr. Juan',
        correo: 'test@mail.com',
        contrasena: 'pass123',
        telefono: '77777777',
        fecha_nac: '1990-01-01',
        id_especialidad: 1,
        departamento: 'La Paz',
      };

      // 2. EJECUCIÓN
      await MedicoController.registrarMedico(req, res);

      // 3. VERIFICACIÓN
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Archivo de matrícula faltante' });
    });

    // ---------------------- PRUEBA 2 ----------------------
    it('debería retornar 400 si falta el archivo de carnet de identidad', async () => {
      // 1. PREPARACIÓN
      // Llega el PDF de matrícula pero no el carnet médico.
      req.files = {
        matriculaProfesional: [{ originalname: 'matricula.pdf', buffer: Buffer.from(''), mimetype: 'application/pdf' }],
        // carnetProfesional ausente
      };
      req.body = {
        nombre_completo: 'Juan',
        correo: 'test@mail.com',
        contrasena: 'pass123',
        telefono: '77777777',
        fecha_nac: '1990-01-01',
        id_especialidad: 1,
        departamento: 'La Paz',
      };

      // 2. EJECUCIÓN
      await MedicoController.registrarMedico(req, res);

      // 3. VERIFICACIÓN
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Archivo de carnet faltante' });
    });

  });

  // ----------------------------
  // PRUEBAS para verMedicos
  // ----------------------------

  describe('verMedicos', () => {

    // ---------------------- PRUEBA 3 ----------------------
    it('debería retornar 200 con la lista de médicos cuando la consulta es exitosa', async () => {
      // 1. PREPARACIÓN
      const datosMock = [
        { id_medico: 1, usuario: { nombre_completo: 'Dr. López' } },
        { id_medico: 2, usuario: { nombre_completo: 'Dr. Mamani' } },
      ];

      // Simulamos que la DB devuelve los datos correctamente
      supabase.then.mockImplementationOnce((resolve) =>
        resolve({ data: datosMock, error: null }),
      );

      // 2. EJECUCIÓN
      await MedicoController.verMedicos(req, res);

      // 3. VERIFICACIÓN
      expect(supabase.from).toHaveBeenCalledWith('medico');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(datosMock);
    });

    // ---------------------- PRUEBA 4 ----------------------
    it('debería retornar 500 si la DB lanza un error al obtener médicos', async () => {
      // 1. PREPARACIÓN
      // Simulamos que la DB responde con un error.
      // El controller hace "if (error) throw error" luego cae al catch y devuelve un error 500
      supabase.then.mockImplementationOnce((resolve) =>
        resolve({ data: null, error: new Error('DB offline') }),
      );

      // 2. EJECUCIÓN
      await MedicoController.verMedicos(req, res);

      // 3. VERIFICACIÓN
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error al obtener médicos' });
    });

  });

  // -------------------------------------
  // PRUEBAS para el perfilMedico
  // -------------------------------------

  describe('perfilMedico', () => {

    // ---------------------- PRUEBA 5 ----------------------
    it('debería retornar 400 si el idUsuario en params no es un número', async () => {
      // 1. PREPARACIÓN
      // Se envía un string y no numérico
      req.params = { idUsuario: 'xyz' };

      // 2. EJECUCIÓN
      await MedicoController.perfilMedico(req, res);

      // 3. VERIFICACIÓN
      // No se configura mock de DB porque el controller debe cortar antes de consultar
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'El ID de usuario debe ser un número válido',
      });
    });

    // ---------------------- PRUEBA 6 ----------------------
    it('debería retornar 404 si no se encuentra ningún médico con ese idUsuario', async () => {
      // 1. PREPARACIÓN
      // ID válido como número, pero la DB no encuentra el registro
      req.params = { idUsuario: '888' };

      supabase.then.mockImplementationOnce((resolve) =>
        resolve({ data: null, error: null, status: 200 }),
      );

      // 2. EJECUCIÓN
      await MedicoController.perfilMedico(req, res);

      // 3. VERIFICACIÓN
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'No se encontró el médico' });
    });

    // ---------------------- PRUEBA 7 ----------------------
    it('debería formatear correctamente el perfil y retornar 200', async () => {
      // 1. PREPARACIÓN
      req.params = { idUsuario: '10' };

      const datosMock = {
        id_medico: 5,
        matricula_profesional: 'https://url.com/matricula.pdf',
        departamento: 'Cochabamba',
        carnet_profesional: 'https://url.com/carnet.jpg',
        usuario: {
          nombre_completo: 'Dr. Rojas',
          fecha_nac: '1985-03-22T00:00:00',
          teléfono: '78881234',
          correo: 'rojas@medico.com',
        },
        administrador: {
          usuario: { nombre_completo: 'Admin Root' },
        },
      };

      supabase.then.mockImplementationOnce((resolve) =>
        resolve({ data: datosMock, error: null, status: 200 }),
      );

      // 2. EJECUCIÓN
      await MedicoController.perfilMedico(req, res);

      // 3. VERIFICACIÓN
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        id: 5,
        nombre: 'Dr. Rojas',
        fechaNac: '22/03/1985',
        telefono: '78881234',
        correo: 'rojas@medico.com',
        matricula: 'https://url.com/matricula.pdf',
        departamento: 'Cochabamba',
        carnet: 'https://url.com/carnet.jpg',
        admin: 'Admin Root',
      });
    });

  });

  // ------------------------------
  // PRUEBAS para verPacientes
  // ------------------------------

  describe('verPacientes', () => {

    // ---------------------- PRUEBA 8 ----------------------
    it('debería retornar 400 si el idMedico en params no es un número', async () => {
      // 1. PREPARACIÓN
      req.params = { idMedico: 'abc' };

      // 2. EJECUCIÓN
      await MedicoController.verPacientes(req, res);

      // 3. VERIFICACIÓN
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'El ID del médico debe ser un número válido',
      });
    });

    // ---------------------- PRUEBA 9 ----------------------
    it('debería retornar 200 con lista vacía si el médico no tiene pacientes activos', async () => {
      // 1. PREPARACIÓN
      // ID válido pero la consulta devuelve un array vacío.
      // El controller tiene: if (!data || data.length === 0) return res.status(200).json([])
      req.params = { idMedico: '7' };

      supabase.then.mockImplementationOnce((resolve) =>
        resolve({ data: [], error: null, status: 200 }),
      );

      // 2. EJECUCIÓN
      await MedicoController.verPacientes(req, res);

      // 3. VERIFICACIÓN
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([]);
    });

  });

  // ------------------------------------
  // PRUEBAS para las alertasActivas
  // -------------------------------------

  describe('alertasActivas', () => {

    // ---------------------- PRUEBA 10 ----------------------
    it('debería retornar 200 con lista vacía cuando no hay alertas activas', async () => {
      // 1. PREPARACIÓN
      req.params = { idMedico: '3' };

      // Devolvemos array vacío y el controller responde 200
      supabase.then.mockImplementationOnce((resolve) =>
        resolve({ data: [], error: null, status: 200 }),
      );

      // 2. EJECUCIÓN
      await MedicoController.alertasActivas(req, res);

      // 3. VERIFICACIÓN
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([]);
    });
  });
});
