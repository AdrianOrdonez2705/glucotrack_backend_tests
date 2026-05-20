const supabase = require('../../database'); // tu cliente Supabase
const bcrypt=require('bcrypt')

const medicosActivos = async (req, res) => {
  const rutaOriginal = req.originalUrl || '/api/medicos-activos'; // Ajusta según tu ruta

  try {
    // Extraemos también el 'status' HTTP que devuelve Supabase por defecto
    const { data, error, status } = await supabase
      .from('medico')
      .select(`
        id_medico,
        matricula_profesional,
        departamento,
        carnet_profesional,
        usuario!inner (
          nombre_completo,
          fecha_nac,
          teléfono,
          correo,
          estado
        ),
        administrador (
          usuario (
            nombre_completo
          )
        )
      `)
      .eq('usuario.estado', true);

    // 1. MANEJO DE ERRORES DE SUPABASE / BASE DE DATOS
    if (error) {
      console.error({
        fecha: new Date().toISOString(),
        endpoint: rutaOriginal,
        metodo: req.method,
        ip: req.ip,
        resultado: 'FALLIDO',
        motivo: error.message,
        codigo_supabase: error.code,
        detalles: error.details
      });

      // Manejo de códigos HTTP según el error de Postgres/PostgREST
      if (error.code && error.code.startsWith('28')) {
        // Errores clase 28 en Postgres son fallos de Autenticación/Autorización
        return res.status(403).json({ error: 'No autorizado para consultar la base de datos', code: 'DB_AUTH_ERROR' });
      } 
      
      if (error.code === '57014') {
        // Query canceled / timeout
        return res.status(504).json({ error: 'La base de datos tardó demasiado en responder', code: 'DB_TIMEOUT' });
      }

      // Error genérico de consulta (ej. columnas que no existen, errores de sintaxis)
      return res.status(status || 500).json({ error: 'Error al consultar los médicos', code: 'DB_QUERY_ERROR' });
    }

    // 2. MANEJO DE LISTAS VACÍAS
    if (!data || data.length === 0) {
      console.log({
        fecha: new Date().toISOString(),
        endpoint: rutaOriginal,
        metodo: req.method,
        ip: req.ip,
        resultado: 'EXITOSO',
        mensaje: 'Consulta ejecutada, pero no hay médicos activos.'
      });
      // Retornar 200 con un array vacío es la mejor práctica REST para listas
      return res.status(200).json([]); 
    }

    // 3. MAPEO DE DATOS (Con programación defensiva)
    // Usamos el operador ?. (optional chaining) y || (fallback) para evitar que 
    // un registro incompleto en la BD tumbe el servidor con un TypeError.
    const medicosFormateados = data.map(m => ({
      id: m.id_medico,
      nombre: m.usuario?.nombre_completo || 'Sin nombre',
      fechaNac: m.usuario?.fecha_nac || null,
      telefono: m.usuario?.teléfono || 'No registrado',
      correo: m.usuario?.correo || 'No registrado',
      matricula: m.matricula_profesional || 'N/A',
      departamento: m.departamento || 'N/A',
      carnet: m.carnet_profesional || 'N/A',
      admitidoPor: m.administrador?.usuario?.nombre_completo || 'Sistema' // Fallback si no hay admin asociado
    }));

    // 4. RESPUESTA EXITOSA
    console.log({
      fecha: new Date().toISOString(),
      endpoint: rutaOriginal,
      metodo: req.method,
      ip: req.ip,
      resultado: 'EXITOSO',
      registros_obtenidos: medicosFormateados.length
    });

    return res.status(200).json(medicosFormateados);

  } catch (err) {
    // 5. MANEJO DE ERRORES INTERNOS (Ej. Caída de red de Node, error en el .map())
    console.error({
      fecha: new Date().toISOString(),
      endpoint: rutaOriginal,
      metodo: req.method,
      ip: req.ip,
      resultado: 'CRÍTICO',
      motivo: err.message,
      stack: err.stack // Imprime la línea exacta del código que falló en tu consola
    });

    return res.status(500).json({ 
      error: 'Error interno inesperado del servidor',
      code: 'INTERNAL_SERVER_ERROR' 
    });
  }
};
const medicosSolicitantes = async (req, res) => {
  const rutaOriginal = req.originalUrl || '/api/medicos-solicitantes';

  try {
    // 1. Consulta a Supabase
    // La única diferencia aquí es eq('usuario.estado', false)
    const { data, error, status } = await supabase
      .from('medico')
      .select(`
        id_medico,
        matricula_profesional,
        departamento,
        carnet_profesional,
        usuario!inner (
          nombre_completo,
          fecha_nac,
          teléfono,
          correo,
          estado
        ),
        administrador (
          usuario (
            nombre_completo
          )
        )
      `)
      .eq('usuario.estado', false); // 👈 Filtramos por estado false

    // 2. MANEJO DE ERRORES DE SUPABASE
    if (error) {
      console.error({
        fecha: new Date().toISOString(),
        endpoint: rutaOriginal,
        metodo: req.method,
        ip: req.ip,
        resultado: 'FALLIDO',
        motivo: error.message,
        codigo_supabase: error.code,
        detalles: error.details
      });

      if (error.code && error.code.startsWith('28')) {
        return res.status(403).json({ error: 'No autorizado para consultar la base de datos', code: 'DB_AUTH_ERROR' });
      } 
      
      if (error.code === '57014') {
        return res.status(504).json({ error: 'La base de datos tardó demasiado en responder', code: 'DB_TIMEOUT' });
      }

      return res.status(status || 500).json({ error: 'Error al consultar los médicos solicitantes', code: 'DB_QUERY_ERROR' });
    }

    // 3. MANEJO DE LISTAS VACÍAS
    if (!data || data.length === 0) {
      console.log({
        fecha: new Date().toISOString(),
        endpoint: rutaOriginal,
        metodo: req.method,
        ip: req.ip,
        resultado: 'EXITOSO',
        mensaje: 'Consulta ejecutada, pero no hay médicos solicitantes pendientes.'
      });
      return res.status(200).json([]); 
    }

    // 4. MAPEO DE DATOS (Aplanando el JSON)
    const medicosFormateados = data.map(m => ({
      id: m.id_medico,
      nombre: m.usuario?.nombre_completo || 'Sin nombre',
      fechaNac: m.usuario?.fecha_nac || null,
      telefono: m.usuario?.teléfono || 'No registrado',
      correo: m.usuario?.correo || 'No registrado',
      matricula: m.matricula_profesional || 'N/A',
      departamento: m.departamento || 'N/A',
      carnet: m.carnet_profesional || 'N/A',
      admitidoPor: m.administrador?.usuario?.nombre_completo || 'Pendiente' // Ajustado semánticamente para solicitantes
    }));

    // 5. RESPUESTA EXITOSA
    console.log({
      fecha: new Date().toISOString(),
      endpoint: rutaOriginal,
      metodo: req.method,
      ip: req.ip,
      resultado: 'EXITOSO',
      registros_obtenidos: medicosFormateados.length
    });

    return res.status(200).json(medicosFormateados);

  } catch (err) {
    // 6. MANEJO DE ERRORES INTERNOS
    console.error({
      fecha: new Date().toISOString(),
      endpoint: rutaOriginal,
      metodo: req.method,
      ip: req.ip,
      resultado: 'CRÍTICO',
      motivo: err.message,
      stack: err.stack 
    });

    return res.status(500).json({ 
      error: 'Error interno inesperado del servidor',
      code: 'INTERNAL_SERVER_ERROR' 
    });
  }
};


const activarMedico = async (req, res) => {
  const idMedico = req.params.idMedico;
  const { idAdmin } = req.body;

  if (!idAdmin) {
    return res.status(400).json({ error: 'No hay administrador' });
  }
  console.log('BODY:', req.body);
console.log('PARAMS:', req.params);
  try {
    const { data: medicoData, error: medicoError } = await supabase
      .from('medico')
      .select('id_usuario')
      .eq('id_medico', idMedico)
      .single();

    if (medicoError || !medicoData) {
      return res.status(404).json({ error: 'Médico no encontrado' });
    }

    const idUsuario = medicoData.id_usuario;

    const { error: updateErrorMedico } = await supabase
      .from('medico')
      .update({
        administrador_id_admin: idAdmin
      })
      .eq('id_medico', idMedico);

    if (updateErrorMedico) {
      return res.status(400).json({ error: updateErrorMedico.message });
    }

    const { error: updateErrorUsuario } = await supabase
      .from('usuario')
      .update({ estado: true })
      .eq('id_usuario', idUsuario);

    if (updateErrorUsuario) {
      return res.status(400).json({ error: updateErrorUsuario.message });
    }

    res.json({ mensaje: 'Usuario activado correctamente' });

  } catch (err) {
    res.status(500).json({
      error: 'Error del servidor',
      detalles: err.message
    });
  }
};

const pacientesActivos = async (req, res) => {
  const rutaOriginal = req.originalUrl || '/api/pacientes-activos';

  try {
    // 1. Consulta a Supabase con Relaciones Múltiples y Anidadas
    const { data, error, status } = await supabase
      .from('paciente')
      .select(`
        id_paciente,
        genero,
        peso,
        altura,
        nombre_emergencia,
        numero_emergencia,
        foto_perfil,
        usuario!inner (
          nombre_completo,
          fecha_nac,
          teléfono,
          correo,
          estado
        ),
        nivel_actividad_fisica (
          descripcion
        ),
        medico (
          usuario (
            nombre_completo
          )
        ),
        administrador!inner (
          usuario (
            nombre_completo
          )
        ),
        paciente_enfermedad (
          enfermedades_base (
            nombre_enfermedad
          )
        ),
        tratamiento_enfermedad (
          dosis,
          tratamientos (
            nombre_tratamiento,
            descripcion
          )
        )
      `)
      .eq('usuario.estado', true);

    // 2. MANEJO DE ERRORES DE SUPABASE
    if (error) {
      console.error({
        fecha: new Date().toISOString(),
        endpoint: rutaOriginal,
        metodo: req.method,
        ip: req.ip,
        resultado: 'FALLIDO',
        motivo: error.message,
        codigo_supabase: error.code
      });

      if (error.code && error.code.startsWith('28')) {
        return res.status(403).json({ error: 'No autorizado para consultar la base de datos', code: 'DB_AUTH_ERROR' });
      } 
      if (error.code === '57014') {
        return res.status(504).json({ error: 'Timeout en la base de datos', code: 'DB_TIMEOUT' });
      }

      return res.status(status || 500).json({ error: 'Error al consultar los pacientes', code: 'DB_QUERY_ERROR' });
    }

    // 3. MANEJO DE LISTAS VACÍAS
    if (!data || data.length === 0) {
      console.log({
        fecha: new Date().toISOString(),
        endpoint: rutaOriginal,
        metodo: req.method,
        resultado: 'EXITOSO',
        mensaje: 'No hay pacientes activos.'
      });
      return res.status(200).json([]); 
    }

    // --- Función auxiliar para formatear la fecha igual que to_char(..., 'DD/MM/YYYY') ---
    const formatearFecha = (fechaString) => {
      if (!fechaString) return null;
      // Asumiendo que viene como YYYY-MM-DD
      const partes = fechaString.split('T')[0].split('-'); 
      if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
      return fechaString;
    };

    // 4. MAPEO DE DATOS (Aplanando y reestructurando el JSON)
    const pacientesFormateados = data.map(p => {
      // Mapeamos las afecciones (subconsulta 1)
      const afeccionesList = p.paciente_enfermedad 
        ? p.paciente_enfermedad.map(pe => ({
            afeccion: pe.enfermedades_base?.nombre_enfermedad || 'Desconocida'
          }))
        : [];

      // Mapeamos los tratamientos (subconsulta 2)
      const tratamientosList = p.tratamiento_enfermedad
        ? p.tratamiento_enfermedad.map(te => ({
            titulo: te.tratamientos?.nombre_tratamiento || 'Sin título',
            desc: te.tratamientos?.descripcion || '',
            dosis: te.dosis ? String(te.dosis) : null
          }))
        : [];

      return {
        id: p.id_paciente,
        nombre: p.usuario?.nombre_completo || 'Sin nombre',
        ci: p.usuario?.correo, // ⚠️ OJO: En tu SQL asignaste u.correo a 'ci'. Lo mantuve tal cual.
        fechaNac: formatearFecha(p.usuario?.fecha_nac),
        genero: p.genero || null,
        peso: p.peso ? String(p.peso) : null,
        altura: p.altura ? String(p.altura) : null,
        actividadFisica: p.nivel_actividad_fisica?.descripcion || null,
        telefono: p.usuario?.teléfono || 'No registrado',
        correo: p.usuario?.correo || 'No registrado',
        nombre_emergencia: p.nombre_emergencia || null,
        numero_emergencia: p.numero_emergencia || null,
        medico: p.medico?.usuario?.nombre_completo || null,
        foto_perfil: p.foto_perfil || null,
        afecciones: afeccionesList,
        tratamientos: tratamientosList,
        admitidoPor: p.administrador?.usuario?.nombre_completo || 'Sistema'
      };
    });

    // 5. RESPUESTA EXITOSA
    console.log({
      fecha: new Date().toISOString(),
      endpoint: rutaOriginal,
      metodo: req.method,
      ip: req.ip,
      resultado: 'EXITOSO',
      registros_obtenidos: pacientesFormateados.length
    });

    return res.status(200).json(pacientesFormateados);

  } catch (err) {
    console.error({
      fecha: new Date().toISOString(),
      endpoint: rutaOriginal,
      metodo: req.method,
      ip: req.ip,
      resultado: 'CRÍTICO',
      motivo: err.message,
      stack: err.stack 
    });

    return res.status(500).json({ 
      error: 'Error interno del servidor',
      code: 'INTERNAL_SERVER_ERROR' 
    });
  }
};

const pacientesSolicitantes = async (req, res) => {
  const rutaOriginal = req.originalUrl || '/api/pacientes-solicitantes';

  try {
    // 1. Consulta a Supabase
    const { data, error, status } = await supabase
      .from('paciente')
      .select(`
        id_paciente,
        genero,
        peso,
        altura,
        nombre_emergencia,
        numero_emergencia,
        foto_perfil,
        embarazo,
        usuario!inner (
          nombre_completo,
          fecha_nac,
          teléfono,
          correo,
          estado
        ),
        nivel_actividad_fisica (
          descripcion
        ),
        medico (
          usuario (
            nombre_completo
          )
        ),
        administrador (
          usuario (
            nombre_completo
          )
        ),
        seguimiento_embarazo (
          semanas_embarazo
        ),
        paciente_enfermedad (
          enfermedades_base (
            nombre_enfermedad
          )
        ),
        tratamiento_enfermedad (
          dosis,
          tratamientos (
            nombre_tratamiento,
            descripcion
          )
        )
      `)
      .eq('usuario.estado', false); // 👈 Filtramos por estado false

    // 2. MANEJO DE ERRORES DE SUPABASE
    if (error) {
      console.error({
        fecha: new Date().toISOString(),
        endpoint: rutaOriginal,
        metodo: req.method,
        ip: req.ip,
        resultado: 'FALLIDO',
        motivo: error.message,
        codigo_supabase: error.code
      });

      if (error.code && error.code.startsWith('28')) {
        return res.status(403).json({ error: 'No autorizado para consultar la base de datos', code: 'DB_AUTH_ERROR' });
      } 
      if (error.code === '57014') {
        return res.status(504).json({ error: 'Timeout en la base de datos', code: 'DB_TIMEOUT' });
      }

      return res.status(status || 500).json({ error: 'Error al consultar los pacientes solicitantes', code: 'DB_QUERY_ERROR' });
    }

    // 3. MANEJO DE LISTAS VACÍAS
    if (!data || data.length === 0) {
      console.log({
        fecha: new Date().toISOString(),
        endpoint: rutaOriginal,
        metodo: req.method,
        resultado: 'EXITOSO',
        mensaje: 'No hay pacientes solicitantes pendientes.'
      });
      return res.status(200).json([]); 
    }

    // --- Función auxiliar para formatear la fecha ---
    const formatearFecha = (fechaString) => {
      if (!fechaString) return null;
      const partes = fechaString.split('T')[0].split('-'); 
      if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
      return fechaString;
    };

    // 4. MAPEO DE DATOS
    const pacientesFormateados = data.map(p => {
      // Mapeamos las afecciones
      const afeccionesList = p.paciente_enfermedad 
        ? p.paciente_enfermedad.map(pe => ({
            afeccion: pe.enfermedades_base?.nombre_enfermedad || 'Desconocida'
          }))
        : [];

      // Mapeamos los tratamientos
      const tratamientosList = p.tratamiento_enfermedad
        ? p.tratamiento_enfermedad.map(te => ({
            titulo: te.tratamientos?.nombre_tratamiento || 'Sin título',
            desc: te.tratamientos?.descripcion || '',
            dosis: te.dosis ? String(te.dosis) : null
          }))
        : [];

      // Extraer semanas de embarazo (Supabase suele devolver un array si es una relación 1:N o un objeto si es 1:1)
      const semanasEmbarazo = Array.isArray(p.seguimiento_embarazo) 
        ? p.seguimiento_embarazo[0]?.semanas_embarazo 
        : p.seguimiento_embarazo?.semanas_embarazo;

      return {
        id: p.id_paciente,
        nombre: p.usuario?.nombre_completo || 'Sin nombre',
        ci: p.usuario?.correo, 
        fechaNac: formatearFecha(p.usuario?.fecha_nac),
        genero: p.genero || null,
        peso: p.peso ? String(p.peso) : null,
        altura: p.altura ? String(p.altura) : null,
        actividadFisica: p.nivel_actividad_fisica?.descripcion || null,
        telefono: p.usuario?.teléfono || 'No registrado',
        correo: p.usuario?.correo || 'No registrado',
        nombre_emergencia: p.nombre_emergencia || null,
        numero_emergencia: p.numero_emergencia || null,
        medico: p.medico?.usuario?.nombre_completo || null,
        foto_perfil: p.foto_perfil || null,
        embarazo: p.embarazo || false, // 👈 Nuevo campo
        semanas_embarazo: semanasEmbarazo || null, // 👈 Nuevo campo de la relación
        afecciones: afeccionesList,
        tratamientos: tratamientosList,
        admitidoPor: p.administrador?.usuario?.nombre_completo || 'Pendiente' // 👈 Tiene sentido que sea "Pendiente" si aún no son admitidos
      };
    });

    // 5. RESPUESTA EXITOSA
    console.log({
      fecha: new Date().toISOString(),
      endpoint: rutaOriginal,
      metodo: req.method,
      ip: req.ip,
      resultado: 'EXITOSO',
      registros_obtenidos: pacientesFormateados.length
    });

    return res.status(200).json(pacientesFormateados);

  } catch (err) {
    console.error({
      fecha: new Date().toISOString(),
      endpoint: rutaOriginal,
      metodo: req.method,
      ip: req.ip,
      resultado: 'CRÍTICO',
      motivo: err.message,
      stack: err.stack 
    });

    return res.status(500).json({ 
      error: 'Error interno del servidor',
      code: 'INTERNAL_SERVER_ERROR' 
    });
  }
};




const activarPaciente= async (req, res) => {
  const idPaciente = req.params.idPaciente;
    const { idAdmin } = req.body;
    if (!idAdmin) {
    return res.status(400).json({ error: 'No hay administrador' });
  }
  try {
    // 1. Obtener id_usuario desde medico
    const { data: pacienteData, error: pacienteError } = await supabase
      .from('paciente')
      .select('id_usuario')
      .eq('id_paciente', idPaciente)
      .single();

    if (pacienteError) {
      return res.status(400).json({ error: medicoError.message });
    }

    if (!pacienteData) {
      return res.status(404).json({ error: 'Medico no encontrado' });
    }

    const idUsuario = pacienteData.id_usuario;
    const { error: updateErrorPaciente } = await supabase
      .from('paciente')
      .update({
        administrador_id_admin: idAdmin
      })
      .eq('id_paciente', idPaciente);

    if (updateErrorPaciente) {
      return res.status(400).json({ error: updateErrorPaciente.message });
    }
    // 2. Actualizar estado del usuario
    const { data: updateData, error: updateError } = await supabase
      .from('usuario')
      .update({ estado: true })
      .eq('id_usuario', idUsuario);

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    res.json({ mensaje: 'Usuario activado correctamente', usuario: updateData });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor', detalles: err.message });
  }
};


const perfilAdmin = async (req, res) => {
  try {
    // Validamos que el ID sea un número válido
    const idUsuario = parseInt(req.params.idUsuario);
    if (isNaN(idUsuario)) {
      return res.status(400).json({ error: 'El ID de usuario debe ser un número válido' });
    }

    // 1. Consulta a Supabase usando .maybeSingle()
    const { data, error, status } = await supabase
      .from('administrador')
      .select(`
        id_admin,
        cargo,
        fecha_ingreso,
        usuario!inner (
          nombre_completo,
          correo,
          fecha_nac,
          teléfono
        ),
        administrador (
          usuario (
            nombre_completo
          )
        )
      `)
      .eq('id_usuario', idUsuario)
      .maybeSingle(); 

    // 2. MANEJO DE ERRORES DE SUPABASE
    if (error) {
      console.error({
        fecha: new Date().toISOString(),
        metodo: req.method,
        ip: req.ip,
        resultado: 'FALLIDO',
        motivo: error.message,
        codigo_supabase: error.code
      });

      return res.status(status || 500).json({ error: 'Error al consultar el perfil del administrador', code: 'DB_QUERY_ERROR' });
    }

    // 3. MANEJO DE REGISTRO NO ENCONTRADO (404)
    if (!data) {
      console.log({
        fecha: new Date().toISOString(),
        resultado: 'NO ENCONTRADO',
        mensaje: `No se encontró un administrador con el id_usuario: ${idUsuario}`
      });
      return res.status(404).json({ message: 'No se encontró el administrador' });
    }

    // --- Función auxiliar para formatear fechas (DD/MM/YYYY) ---
    const formatearFecha = (fechaString) => {
      if (!fechaString) return null;
      const partes = fechaString.split('T')[0].split('-'); 
      if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
      return fechaString;
    };

    // 4. MAPEO DE DATOS (Construcción directa del objeto)
    const adminFormateado = {
      id: data.id_admin,
      nombre: data.usuario?.nombre_completo || 'Sin nombre',
      correo: data.usuario?.correo || 'Sin correo',
      fechaNac: formatearFecha(data.usuario?.fecha_nac),
      telefono: data.usuario?.teléfono || 'No registrado',
      cargo: data.cargo || 'N/A',
      fechaIn: formatearFecha(data.fecha_ingreso),
      // Mapeamos el "Self-Join" del administrador que lo admitió
      admitidoPor: data.administrador?.usuario?.nombre_completo || 'No'
    };

    // 5. RESPUESTA EXITOSA
    console.log({
      fecha: new Date().toISOString(),
      metodo: req.method,
      ip: req.ip,
      resultado: 'EXITOSO',
      admin_id: adminFormateado.id
    });

    return res.status(200).json(adminFormateado);

  } catch (err) {
    // 6. MANEJO DE ERRORES CRÍTICOS (Ej. código mal escrito)
    console.error({
      fecha: new Date().toISOString(),
      metodo: req.method,
      ip: req.ip,
      resultado: 'CRÍTICO',
      motivo: err.message,
      stack: err.stack
    });

    return res.status(500).json({ error: 'Error interno del servidor', code: 'INTERNAL_SERVER_ERROR' });
  }
};



const agregarAdmin=async(req,res)=>{
 
    const {
      nombre,
      correo,
      contrasena,
      fechaNacimiento,
      telefono,
      cargo,
      fecha_registro,
      administrador_id_admin
    }=req.body;
    if(!nombre|| !correo ||!contrasena || !fechaNacimiento|| !cargo||!fecha_registro ||!telefono||!administrador_id_admin){
      return res.status(400).json({ error: 'Todos los campos deben ser llenados' });
    }
    try{
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(contrasena, saltRounds);
      const {data, error}=await supabase.
      from('usuario')
      .insert([
                {
                    nombre_completo:nombre,
                    correo:correo,
                    contrasena: hashedPassword,
                    rol:'administrador',
                    fecha_nac:fechaNacimiento,
                    teléfono:telefono,
                    estado:true,
                    
                },
            ]).select();
            if( error) throw error;
             const usuario_insertado = data[0];

             const { data: adminData, error: adminError } = await supabase
            .from("administrador")
            .insert([
                {
                    id_usuario: usuario_insertado.id_usuario,
                    cargo:cargo,
                    fecha_ingreso:fecha_registro,
                    administrador_id_admin:administrador_id_admin
                }
            ]).select();
            if(adminError) throw adminError;
           
            res.status(200).json({
            message: 'Usuario y admin registrados correctamente',
            usuario_insertado,
            adminData
            }); 
    }catch(error){
      console.error("Error al insertar los datos: ", error.message);
      res.status(500).json({ error: error.message });
    }
}

const obtenerAdmins = async (req, res) => {
  try {
    // Validamos que el ID sea un número válido
    const idAdmin = parseInt(req.params.idAdmin);
    if (isNaN(idAdmin)) {
      return res.status(400).json({ error: 'El ID de administrador debe ser un número válido' });
    }

    // 1. Consulta a Supabase
    const { data, error, status } = await supabase
      .from('administrador')
      .select(`
        id_admin,
        cargo,
        fecha_ingreso,
        usuario!inner (
          nombre_completo,
          correo,
          fecha_nac,
          teléfono
        ),
        administrador (
          usuario (
            nombre_completo
          )
        )
      `)
      .neq('id_admin', 1)        // 👈 Excluye al admin principal (id = 1)
      .neq('id_admin', idAdmin); // 👈 Excluye al admin que hace la petición

    // 2. MANEJO DE ERRORES DE SUPABASE
    if (error) {
      console.error({
        fecha: new Date().toISOString(),
        metodo: req.method,
        ip: req.ip,
        resultado: 'FALLIDO',
        motivo: error.message,
        codigo_supabase: error.code
      });

      return res.status(status || 500).json({ error: 'Error al consultar los administradores visibles', code: 'DB_QUERY_ERROR' });
    }

    // 3. MANEJO DE LISTAS VACÍAS
    if (!data || data.length === 0) {
      console.log({
        fecha: new Date().toISOString(),
        metodo: req.method,
        resultado: 'EXITOSO',
        mensaje: 'Consulta ejecutada, pero no hay otros administradores visibles.'
      });
      // Devolver un arreglo vacío en lugar de 404 es una mejor práctica para listas
      return res.status(200).json([]); 
    }

    // --- Función auxiliar para formatear fechas ---
    // (Añadida para mantener consistencia con tus otros endpoints, 
    // aunque en tu SQL original no usaste to_char en esta ocasión)
    const formatearFecha = (fechaString) => {
      if (!fechaString) return null;
      const partes = fechaString.split('T')[0].split('-'); 
      if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
      return fechaString;
    };

    // 4. MAPEO DE DATOS
    const adminsFormateados = data.map(a => ({
      id: a.id_admin,
      nombre: a.usuario?.nombre_completo || 'Sin nombre',
      correo: a.usuario?.correo || 'Sin correo',
      fechaNac: formatearFecha(a.usuario?.fecha_nac),
      telefono: a.usuario?.teléfono || 'No registrado',
      cargo: a.cargo || 'N/A',
      fechaIn: formatearFecha(a.fecha_ingreso),
      admitidoPor: a.administrador?.usuario?.nombre_completo || 'No especificado'
    }));

    // 5. RESPUESTA EXITOSA
    console.log({
      fecha: new Date().toISOString(),
      metodo: req.method,
      ip: req.ip,
      resultado: 'EXITOSO',
      registros_obtenidos: adminsFormateados.length
    });

    return res.status(200).json(adminsFormateados);

  } catch (err) {
    // 6. MANEJO DE ERRORES CRÍTICOS
    console.error({
      fecha: new Date().toISOString(),
      metodo: req.method,
      ip: req.ip,
      resultado: 'CRÍTICO',
      motivo: err.message,
      stack: err.stack
    });

    return res.status(500).json({ error: 'Error interno del servidor', code: 'INTERNAL_SERVER_ERROR' });
  }
};





module.exports={medicosActivos,medicosSolicitantes,activarMedico,pacientesActivos,pacientesSolicitantes,activarPaciente,perfilAdmin,agregarAdmin,obtenerAdmins};