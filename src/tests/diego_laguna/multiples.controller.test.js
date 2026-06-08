import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminController from '../../controllers/admin.controller.js';
import PacienteController from '../../controllers/paciente.controller.js';
import MedicoController from '../../controllers/medico.controller.js';
import supabase from '../../config/database.js';
import bcrypt from 'bcrypt';
import AuthController from '../../controllers/auth.controller.js';
import OtpCacheService from '../../services/otpCache.service.js';
import EmailService from '../../email/sendEmail.js';
// --- CONFIGURACIÓN DE MOCKS ---


// Mock de OtpCacheService
vi.mock('../../services/otpCache.service.js', () => ({
  default: {
    setOTP: vi.fn(),
    getOTP: vi.fn(),
    deleteOTP: vi.fn(),
  },
}));

// Mock de EmailService
vi.mock('../../email/sendEmail.js', () => ({
  default: {
    sendEmail: vi.fn().mockResolvedValue(true),
  },
}));

// Y asegúrate de que el mock de bcrypt incluya 'compare' además de 'hash'
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));
// Simulamos la dependencia de Supabase para interceptar consultas encadenadas
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
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),

    // Supabase usa Promises internamente; simular "then"
    // permite interceptar el await final
    then: vi.fn(),
    
    // Objeto storage agregado para poder simular la subida de archivos
    storage: storageMock,
  };

  return { default: cadenaMock };
});



// Silenciar console.log y console.error
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});


describe('Pruebas unitarias Diego Laguna',()=>{
    let req,res;

    beforeEach(()=>{
        vi.clearAllMocks();

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
  // TESTS: actualizarPaciente (PacienteController)
  // ==========================================
    describe('Tests Pacientes controller', ()=>{
        
        it('Actualizar paciente: debería retornar 404 si el paciente no es encontrado en la base de datos', async () => {
        // 1. Preparación
        req.params = { id_usuario: '999' };
        req.body = {
            nombre: 'Diego Laguna',
            altura: 1.75,
            peso: 70,
            telefono: '77777777',
            correo: 'diego@test.com',
            nombre_emergencia: 'Contacto',
            numero_emergencia: '66666666'
        };

        // Simulamos que la consulta select() de paciente devuelve null
        supabase.then.mockImplementationOnce((resolve) => resolve({ data: null, error: null }));

        // 2. Ejecución
        await PacienteController.actualizarPaciente(req, res);

        // 3. Verificación
        expect(supabase.from).toHaveBeenCalledWith('paciente');
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Paciente no encontrado' });
        });

        it('Actualizar paciente: debería retornar 500 si ocurre un error al actualizar el usuario', async () => {
        // 1. Preparación
        req.params = { id_usuario: '10' };
        req.body = {
            nombre: 'Diego Laguna',
            altura: 1.75,
            peso: 70,
            telefono: '77777777',
            correo: 'diego@test.com',
            nombre_emergencia: 'Contacto',
            numero_emergencia: '66666666'
        };

        // 1ra Promesa: Encuentra al paciente
        // 2da Promesa: Falla al actualizar el usuario
        supabase.then
            .mockImplementationOnce((resolve) => resolve({ data: { id_paciente: 5 }, error: null }))
            .mockImplementationOnce((resolve) => resolve({ data: null, error: new Error('Error DB Usuario') }));

        // 2. Ejecución
        await PacienteController.actualizarPaciente(req, res);

        // 3. Verificación
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Error al actualizar paciente',
            details: expect.any(Error)
        });
        });

        it('Actualizar paciente: debería actualizar datos básicos correctamente (sin cambios de embarazo)', async () => {
        // 1. Preparación
        req.params = { id_usuario: '10' };
        req.body = {
            nombre: 'Diego Laguna Actualizado',
            altura: 1.80,
            peso: 75,
            telefono: '77777777',
            correo: 'diego@test.com',
            nombre_emergencia: 'Contacto',
            numero_emergencia: '66666666'
            // No enviamos 'embarazo'
        };

        const mockUsuario = { id_usuario: 10, nombre_completo: 'Diego Laguna Actualizado' };
        const mockPaciente = { id_paciente: 5, altura: 1.80, peso: 75 };

        // 1ra: Encuentra paciente
        // 2da: Actualiza usuario
        // 3ra: Actualiza paciente
        supabase.then
            .mockImplementationOnce((resolve) => resolve({ data: { id_paciente: 5 }, error: null }))
            .mockImplementationOnce((resolve) => resolve({ data: mockUsuario, error: null }))
            .mockImplementationOnce((resolve) => resolve({ data: mockPaciente, error: null }));

        // 2. Ejecución
        await PacienteController.actualizarPaciente(req, res);

        // 3. Verificación
        expect(supabase.update).toHaveBeenNthCalledWith(1, {
            nombre_completo: 'Diego Laguna Actualizado',
            correo: 'diego@test.com',
            teléfono: '77777777',
        });
        expect(supabase.update).toHaveBeenNthCalledWith(2, {
            altura: 1.80,
            peso: 75, // Note que el controller parsea el peso a float
            embarazo: undefined,
            nombre_emergencia: 'Contacto',
            numero_emergencia: '66666666',
        });
        
        expect(res.json).toHaveBeenCalledWith({
            usuario: mockUsuario,
            paciente: mockPaciente,
        });
        });
    });

        // ==========================================
    // TESTS: MedicoController - Funciones Faltantes
    // ==========================================
    describe('Tests Medico Controller', ()=>{

    
        // ----------------------------------------------------
        // PRUEBA 1: retroalimentacionAlerta (Validación 400)
        // ----------------------------------------------------
        it('Retroalimentación medico: debería retornar 400 en retroalimentacionAlerta si faltan campos obligatorios', async () => {
        // 1. Preparación: Faltan 'mensaje' y 'alertas_id_alerta' en el body
        req.body = {
            id_medico: 1,
            fecha_registro: '2026-06-07',
        };

        // 2. Ejecución
        await MedicoController.retroalimentacionAlerta(req, res);

        // 3. Verificación: El controlador exige todos los campos para continuar[cite: 5]
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Todos los campos son requeridos' });
        });

        // ----------------------------------------------------
        // PRUEBA 2: alertasResueltas (Camino Feliz 200)
        // ----------------------------------------------------
        it('Alertas Resueltas: debería retornar una lista formateada de alertas resueltas (estado 200)', async () => {
        // 1. Preparación
        req.params = { idMedico: '5' };

        const mockData = [{
            id_alerta: 10,
            estado: false,
            tipo_alerta: { tipo: 'Grave' },
            retroalimentacion: { mensaje: 'Ajustar dosis de insulina' },
            registro_glucosa: {
            fecha: '2026-06-07',
            hora: '08:30:00',
            nivel_glucosa: 200,
            observaciones: 'Mareos por la mañana',
            id_paciente: 3,
            paciente: {
                id_paciente: 3,
                usuario: { nombre_completo: 'Carlos Perez' }
            },
            momento_dia: { momento: 'Ayunas' }
            }
        }];

        // Simulamos la respuesta de la base de datos filtrando estado=false[cite: 5]
        supabase.then.mockImplementationOnce((resolve) => resolve({ data: mockData, error: null }));

        // 2. Ejecución
        await MedicoController.alertasResueltas(req, res);

        // 3. Verificación: Comprueba el formato estructurado del mapeo final[cite: 5]
        expect(supabase.from).toHaveBeenCalledWith('alertas');
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith([{
            id: 10,
            nivel: 'Grave',
            idpaciente: 3,
            paciente: 'Carlos Perez',
            fecha: '2026-06-07',
            hora: '08:30',
            glucosa: 200,
            momento: 'Ayunas',
            observaciones: 'Mareos por la mañana',
            mensaje: 'Ajustar dosis de insulina'
        }]);
        });

        // ----------------------------------------------------
        // PRUEBA 3: actualizarMedico (Flujo con archivo)
        // ----------------------------------------------------
        it('Actualizar médico: debería actualizar los datos del médico y subir un nuevo carnet si se provee (estado 200)', async () => {
        // 1. Preparación
        req.params = { id_medico: '8' };
        req.body = {
            telefono: '77711222',
            departamento: 'Santa Cruz'
        };
        
        // Simulamos que se envió un archivo req.file (no req.files)[cite: 5]
        req.file = {
            originalname: 'nuevo_carnet.png',
            buffer: Buffer.from('dummy_data'),
            mimetype: 'image/png'
        };

        // Mocks de base de datos y storage
        // a. Buscar id_usuario del medico
        supabase.then.mockImplementationOnce((resolve) => resolve({ data: { id_usuario: 15 }, error: null }));
        
        // b. Subida del archivo al storage (Carnets_IMG)[cite: 5]
        supabase.storage.upload.mockResolvedValueOnce({ data: { path: 'imgs/nuevo.png' }, error: null });
        supabase.storage.getPublicUrl.mockReturnValueOnce({ data: { publicUrl: 'http://url.com/nuevo.png' } });
        
        // c. Actualizar tabla usuario
        supabase.then.mockImplementationOnce((resolve) => resolve({ error: null }));
        // d. Actualizar tabla medico
        supabase.then.mockImplementationOnce((resolve) => resolve({ error: null }));

        // 2. Ejecución
        await MedicoController.actualizarMedico(req, res);

        // 3. Verificación
        expect(supabase.from).toHaveBeenNthCalledWith(1, 'medico'); // Select inicial
        expect(supabase.storage.from).toHaveBeenCalledWith('Carnets_IMG');
        
        // Verifica que se actualizaron ambas tablas[cite: 5]
        expect(supabase.from).toHaveBeenCalledWith('usuario');
        expect(supabase.from).toHaveBeenCalledWith('medico');
        
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            message: 'Datos actualizados correctamente',
            carnet_url: 'http://url.com/nuevo.png'
        });
        });
    });
        // ==========================================
    // TESTS: AdminController - Funciones Faltantes
    // ==========================================

    describe('Tests Admin Controller', ()=>{

        // ----------------------------------------------------
        // PRUEBA 1: medicosSolicitantes (Camino sin datos)
        // ----------------------------------------------------
        it('Medicos solicitantes: debería retornar un array vacío y estado 200 si no hay médicos solicitantes pendientes', async () => {
        // 1. Preparación
        // La función no requiere params ni body, solo consulta los que tienen estado = false[cite: 6]
        supabase.then.mockImplementationOnce((resolve) => resolve({ data: [], error: null, status: 200 }));

        // 2. Ejecución
        await AdminController.medicosSolicitantes(req, res);

        // 3. Verificación
        expect(supabase.from).toHaveBeenCalledWith('medico');
        // Verifica que el filtro eq de supabase busque el estado = false[cite: 6]
        expect(supabase.eq).toHaveBeenCalledWith('usuario.estado', false); 
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith([]);
        });

        // ----------------------------------------------------
        // PRUEBA 2: pacientesSolicitantes (Formateo complejo)
        // ----------------------------------------------------
        it('Pacientes solicitantes: debería extraer correctamente las semanas de embarazo y retornar los pacientes inactivos', async () => {
        // 1. Preparación
        const mockPacientesData = [{
            id_paciente: 15,
            genero: 'F',
            peso: 60.5,
            altura: 1.60,
            embarazo: true,
            usuario: {
            nombre_completo: 'Lucia Fernandez',
            fecha_nac: '1995-10-10T00:00:00',
            correo: 'lucia@test.com',
            estado: false
            },
            seguimiento_embarazo: [
            { semanas_embarazo: 24 } // El controlador maneja si esto llega como array o como objeto[cite: 6]
            ],
            // CORRECCIÓN: Al no tener administrador, el controlador usará 'Pendiente'
            administrador: null 
        }];

        supabase.then.mockImplementationOnce((resolve) => resolve({ data: mockPacientesData, error: null }));

        // 2. Ejecución
        await AdminController.pacientesSolicitantes(req, res);

        // 3. Verificación
        expect(supabase.from).toHaveBeenCalledWith('paciente');
        expect(res.status).toHaveBeenCalledWith(200);
        // Validamos que el mapa de datos extraiga las semanas (24) y ponga el estado pendiente[cite: 6]
        expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({
            nombre: 'Lucia Fernandez',
            ci: 'lucia@test.com',
            fechaNac: '10/10/1995',
            embarazo: true,
            semanas_embarazo: 24,
            admitidoPor: 'Pendiente' // Ahora sí coincidirá
            })
        ]));
        });

        // ----------------------------------------------------
        // PRUEBA 3: activarPaciente (Actualización en cascada)
        // ----------------------------------------------------
        it('Activar paciente: debería actualizar el id_admin en la tabla paciente y el estado en la tabla usuario (estado 200)', async () => {
        // 1. Preparación
        req.params = { idPaciente: '42' };
        req.body = { idAdmin: '1' }; // Este dato es obligatorio[cite: 6]

        // Mocks: Son 3 promesas secuenciales
        // Promesa 1: Select del id_usuario basado en el id_paciente[cite: 6]
        supabase.then.mockImplementationOnce((resolve) => resolve({ data: { id_usuario: 88 }, error: null }));
        // Promesa 2: Update de la tabla paciente asignando el idAdmin[cite: 6]
        supabase.then.mockImplementationOnce((resolve) => resolve({ error: null }));
        // Promesa 3: Update de la tabla usuario cambiando el estado a true[cite: 6]
        supabase.then.mockImplementationOnce((resolve) => resolve({ data: { id_usuario: 88, estado: true }, error: null }));

        // 2. Ejecución
        await AdminController.activarPaciente(req, res);

        // 3. Verificación
        // Validamos que la primera consulta fue hacia la tabla paciente
        expect(supabase.from).toHaveBeenNthCalledWith(1, 'paciente');
        
        // Validamos la actualización en la tabla paciente[cite: 6]
        expect(supabase.update).toHaveBeenNthCalledWith(1, { administrador_id_admin: '1' });
        expect(supabase.eq).toHaveBeenCalledWith('id_paciente', '42');

        // Validamos la actualización en la tabla usuario[cite: 6]
        expect(supabase.update).toHaveBeenNthCalledWith(2, { estado: true });
        expect(supabase.eq).toHaveBeenCalledWith('id_usuario', 88);

        expect(res.json).toHaveBeenCalledWith({
            mensaje: 'Usuario activado correctamente',
            usuario: { id_usuario: 88, estado: true }
        });
        });
    });

    // ==========================================
  // TESTS: AuthController - Login
  // ==========================================
  describe('AuthController - login', () => {
    
    it('Login: debería validar credenciales, generar OTP, enviarlo por correo y retornar 200', async () => {
      // 1. Preparación
      req.body = {
        correo: 'paciente@test.com',
        contrasena: 'password123'
      };

      const mockUsuario = {
        id_usuario: 99,
        correo: 'paciente@test.com',
        contrasena: 'hashed_password_from_db',
        rol: 'paciente' // El controlador buscará luego en la tabla 'paciente'[cite: 7]
      };

      const mockRolData = {
        id_paciente: 45 // El id_rol final
      };

      // Simulamos que el usuario existe (primera promesa)
      supabase.then.mockImplementationOnce((resolve) => resolve({ data: mockUsuario, error: null }));
      
      // Simulamos que el rol del paciente existe (segunda promesa)
      supabase.then.mockImplementationOnce((resolve) => resolve({ data: mockRolData, error: null }));

      // Simulamos que la contraseña coincide[cite: 7]
      bcrypt.compare.mockResolvedValueOnce(true);

      // 2. Ejecución
      await AuthController.login(req, res);

      // 3. Verificación
      // Verifica las consultas a base de datos[cite: 7]
      expect(supabase.from).toHaveBeenNthCalledWith(1, 'usuario');
      expect(supabase.from).toHaveBeenNthCalledWith(2, 'paciente');

      // Verifica la validación de contraseña[cite: 7]
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashed_password_from_db');

      // Verifica el cache y el email[cite: 7]
      expect(OtpCacheService.setOTP).toHaveBeenCalledWith(99, expect.any(String), 300000);
      expect(EmailService.sendEmail).toHaveBeenCalledWith('paciente@test.com', expect.any(String), expect.any(String));

      // Verifica la respuesta final[cite: 7]
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        id_usuario: 99,
        id_rol: 45,
        message: 'OTP enviado al correo'
      });
    });

  });
});