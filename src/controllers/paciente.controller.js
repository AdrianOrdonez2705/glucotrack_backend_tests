import supabase from '../config/database.js';
import bcrypt from 'bcrypt';

class PacienteController {
  static async registrarPaciente(req, res) {
    try {
      console.log('FILES LLEGAN:', req.files);
      console.log('BODY LLEGA:', req.body);

      const {
        nombre_completo,
        correo,
        contrasena,
        rol,
        fecha_nac,
        id_medico,
        id_actividad,
        genero,
        peso,
        altura,
        enfermedad_id,
        tratamiento_id,
        dosis_,
        nombre_emergencia,
        numero_emergencia,
        embarazada,
        semanas,
      } = req.body;

      const teléfono = req.body['teléfono'] || req.body['telÃ©fono'];
      const imgFiles = req.files?.foto_perfil;

      if (!imgFiles || imgFiles.length === 0) {
        return res.status(400).json({ error: 'Archivo de perfil faltante' });
      }

      const img = imgFiles[0];
      const imgUpload = await supabase.storage
        .from('perfiles_pacientes')
        .upload(`imgs/${Date.now()}_${img.originalname}`, img.buffer, { contentType: img.mimetype });

      if (imgUpload.error) throw imgUpload.error;
      const imgUrl = supabase.storage.from('perfiles_pacientes').getPublicUrl(imgUpload.data.path)
        .data.publicUrl;

      // Validación de campos obligatorios
      if (
        !nombre_completo ||
        !correo ||
        !contrasena ||
        !rol ||
        !fecha_nac ||
        !teléfono ||
        !id_medico ||
        !id_actividad ||
        !genero ||
        !peso ||
        !altura ||
        !enfermedad_id ||
        !tratamiento_id ||
        !dosis_ ||
        !nombre_emergencia ||
        !numero_emergencia ||
        !imgUrl
      ) {
        return res.status(400).json({ error: 'Todos los campos obligatorios deben ser llenados' });
      }

      // Conversión de tipos
      const id_medicoInt = parseInt(id_medico);
      const id_actividadInt = parseInt(id_actividad);
      const enfermedad_idInt = parseInt(enfermedad_id);
      const tratamiento_idInt = parseInt(tratamiento_id);
      const pesoNum = parseFloat(peso);
      const alturaNum = parseFloat(altura);
      const embarazadaBool = embarazada === 'true' || embarazada === true;
      const semanasInt = semanas ? parseInt(semanas) : null;

      // Hash de contraseña
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(contrasena, saltRounds);

      // Insert usuario
      const { data: usuarioInsertadoData, error: usuarioInsertadoError } = await supabase
        .from('usuario')
        .insert([
          {
            nombre_completo,
            correo,
            contrasena: hashedPassword,
            rol,
            fecha_nac,
            teléfono,
          },
        ])
        .select();

      if (usuarioInsertadoError) throw usuarioInsertadoError;

      const usuario_insertado = usuarioInsertadoData[0];

      // Insert paciente
      const { data: pacienteData, error: pacienteError } = await supabase
        .from('paciente')
        .insert([
          {
            id_usuario: usuario_insertado.id_usuario,
            id_medico: id_medicoInt,
            id_nivel_actividad: id_actividadInt,
            genero,
            peso: pesoNum,
            altura: alturaNum,
            embarazo: embarazadaBool,
            nombre_emergencia,
            numero_emergencia,
            foto_perfil: imgUrl,
          },
        ])
        .select();

      if (pacienteError) throw pacienteError;

      const paciente = pacienteData[0];

      // Seguimiento embarazo solo si aplica
      if (embarazadaBool && semanasInt !== null) {
        await supabase.from('seguimiento_embarazo').insert({
          id_paciente: paciente.id_paciente,
          fecha_registro: usuario_insertado.fecha_registro,
          semanas_embarazo: semanasInt,
        });
      }

      // Insert tratamiento
      const { data: dataTratamiento, error: errorTratamiento } = await supabase
        .from('tratamiento_enfermedad')
        .insert({
          id_paciente: paciente.id_paciente,
          id_tratamiento: tratamiento_idInt,
          dosis: dosis_,
        });

      if (errorTratamiento) throw errorTratamiento;

      // Insert enfermedad
      const { data: dataEnfermedad, error: errorEnfermedad } = await supabase
        .from('paciente_enfermedad')
        .insert({
          id_paciente: paciente.id_paciente,
          id_enfermedad: enfermedad_idInt,
        });

      if (errorEnfermedad) throw errorEnfermedad;

      res.status(200).json({
        message: 'Usuario y paciente registrados correctamente',
        usuario_insertado,
        paciente,
      });
    } catch (error) {
      console.error('Error al insertar datos: ', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async perfilPaciente(req, res) {
    try {
      // 1. Validar el parámetro
      const idPaciente = parseInt(req.params.idPaciente);
      if (isNaN(idPaciente)) {
        return res.status(400).json({ error: 'El ID del paciente debe ser un número válido' });
      }

      // 2. Consulta a Supabase
      const { data, error, status } = await supabase
        .from('paciente')
        .select(
          `
          id_paciente,
          genero,
          altura,
          peso,
          embarazo,
          nombre_emergencia,
          numero_emergencia,
          foto_perfil,
          usuario!inner (
            id_usuario,
            nombre_completo,
            fecha_nac,
            teléfono,
            correo,
            fecha_registro
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
          ),
          seguimiento_embarazo (
            semanas_embarazo,
            fecha_registro,
            fecha_terminacion
          )
        `,
        )
        .eq('id_paciente', idPaciente)
        .maybeSingle();

      // 3. MANEJO DE ERRORES DE SUPABASE
      if (error) {
        console.error({
          fecha: new Date().toISOString(),
          metodo: req.method,
          ip: req.ip,
          resultado: 'FALLIDO',
          motivo: error.message,
          codigo_supabase: error.code,
        });
        return res
          .status(status || 500)
          .json({ error: 'Error al consultar el perfil del paciente', code: 'DB_QUERY_ERROR' });
      }

      // 4. MANEJO DE REGISTRO NO ENCONTRADO (404)
      if (!data) {
        return res.status(404).json({ message: 'No se encontró el paciente solicitado' });
      }

      // --- Función auxiliar para formatear fechas ---
      const formatearFecha = (fechaString) => {
        if (!fechaString) return null;
        const partes = fechaString.split('T')[0].split('-');
        if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
        return fechaString;
      };

      // 5. PROCESAMIENTO DE DATOS COMPLEJOS
      const afeccionesList = data.paciente_enfermedad
        ? data.paciente_enfermedad.map((pe) => pe.enfermedades_base?.nombre_enfermedad)
        : [];

      const tratamientosList = data.tratamiento_enfermedad
        ? data.tratamiento_enfermedad.map((te) => ({
            titulo: te.tratamientos?.nombre_tratamiento || '',
            descripcion: te.tratamientos?.descripcion || '',
            dosis: te.dosis ? String(te.dosis) : null,
          }))
        : [];

      let semanasEmbarazoActual = null;
      let fechaRegistroEmbarazo = null;

      if (data.embarazo && data.seguimiento_embarazo && data.seguimiento_embarazo.length > 0) {
        const embarazosOrdenados = [...data.seguimiento_embarazo].sort((a, b) => {
          const aActivo = a.fecha_terminacion === null ? 0 : 1;
          const bActivo = b.fecha_terminacion === null ? 0 : 1;

          if (aActivo !== bActivo) return aActivo - bActivo;

          return new Date(b.fecha_registro) - new Date(a.fecha_registro);
        });

        const embarazoPrincipal = embarazosOrdenados[0];
        semanasEmbarazoActual = embarazoPrincipal.semanas_embarazo;
        fechaRegistroEmbarazo = embarazoPrincipal.fecha_registro;
      }

      // 6. ESTRUCTURACIÓN FINAL DEL OBJETO
      const pacienteFormateado = {
        nombre: data.usuario?.nombre_completo || 'Sin nombre',
        id: data.usuario?.id_usuario ? String(data.usuario.id_usuario) : null,
        fechaNac: formatearFecha(data.usuario?.fecha_nac),
        genero: data.genero || null,
        altura: data.altura || null,
        peso: data.peso || null,
        telefono: data.usuario?.teléfono || null,
        correo: data.usuario?.correo || null,

        nombre_emergencia: data.nombre_emergencia || null,
        numero_emergencia: data.numero_emergencia || null,
        foto_perfil: data.foto_perfil || null,

        nombre_medico: data.medico?.usuario?.nombre_completo || null,
        fecha_registro: data.usuario?.fecha_registro || null,
        admitidoPor: data.administrador?.usuario?.nombre_completo || null,

        actividadFisica: {
          nivel: data.nivel_actividad_fisica?.descripcion || null,
          descripcion: data.nivel_actividad_fisica?.descripcion || null,
        },

        afecciones: afeccionesList,
        tratamientos: tratamientosList,
        embarazo: data.embarazo || false,
        semanas_embarazo: semanasEmbarazoActual,
        registro_embarazo: fechaRegistroEmbarazo,
      };

      // 7. RESPUESTA EXITOSA
      console.log({
        fecha: new Date().toISOString(),
        metodo: req.method,
        ip: req.ip,
        resultado: 'EXITOSO',
        paciente_id: idPaciente,
      });

      return res.status(200).json(pacienteFormateado);
    } catch (err) {
      console.error({
        fecha: new Date().toISOString(),
        metodo: req.method,
        ip: req.ip,
        resultado: 'CRÍTICO',
        motivo: err.message,
        stack: err.stack,
      });
      return res
        .status(500)
        .json({ error: 'Error interno del servidor', code: 'INTERNAL_SERVER_ERROR' });
    }
  }

  static async registrosPaciente(req, res) {
    try {
      const idPaciente = parseInt(req.params.idPaciente);
      if (isNaN(idPaciente)) {
        return res.status(400).json({ error: 'El ID del paciente debe ser un número válido' });
      }

      const { data, error, status } = await supabase
        .from('registro_glucosa')
        .select(
          `
          id_registro,
          fecha,
          hora,
          nivel_glucosa,
          observaciones,
          momento_dia (
            momento
          ),
          medico (
            usuario (
              nombre_completo
            )
          ),
          alertas (
            id_alerta,
            tipo_alerta (
              tipo
            ),
            retroalimentacion (
              mensaje
            )
          )
        `,
        )
        .eq('id_paciente', idPaciente)
        .order('fecha', { ascending: false })
        .order('hora', { ascending: false });

      if (error) {
        console.error({
          fecha: new Date().toISOString(),
          metodo: req.method,
          ip: req.ip,
          resultado: 'FALLIDO',
          motivo: error.message,
          codigo_supabase: error.code,
        });
        return res
          .status(status || 500)
          .json({ error: 'Error al consultar los registros del paciente', code: 'DB_QUERY_ERROR' });
      }

      if (!data || data.length === 0) {
        console.log({
          fecha: new Date().toISOString(),
          metodo: req.method,
          resultado: 'EXITOSO',
          mensaje: 'No hay registros de glucosa para este paciente.',
        });
        return res.status(200).json([]);
      }

      const formatearHora = (horaString) => {
        if (!horaString) return null;
        return horaString.substring(0, 5);
      };

      const registrosFormateados = data.map((r) => {
        const alerta = Array.isArray(r.alertas) ? r.alertas[0] : r.alertas;
        const tipoAlerta = alerta
          ? Array.isArray(alerta.tipo_alerta)
            ? alerta.tipo_alerta[0]
            : alerta.tipo_alerta
          : null;
        const retro = alerta
          ? Array.isArray(alerta.retroalimentacion)
            ? alerta.retroalimentacion[0]
            : alerta.retroalimentacion
          : null;

        return {
          id: r.id_registro,
          fecha: r.fecha,
          hora: formatearHora(r.hora),
          nivelGlucosa: r.nivel_glucosa ? Number(r.nivel_glucosa) : null,
          momentoDia: r.momento_dia?.momento || null,
          quienTomoMuestra: r.medico?.usuario?.nombre_completo || null,
          observaciones: r.observaciones || null,
          idAlerta: alerta?.id_alerta || null,
          tipo_alerta: tipoAlerta?.tipo || null,
          placeholderRetro: null,
          respuesta: retro?.mensaje || null,
        };
      });

      console.log({
        fecha: new Date().toISOString(),
        metodo: req.method,
        ip: req.ip,
        resultado: 'EXITOSO',
        paciente_id: idPaciente,
        registros_obtenidos: registrosFormateados.length,
      });

      return res.status(200).json(registrosFormateados);
    } catch (err) {
      console.error({
        fecha: new Date().toISOString(),
        metodo: req.method,
        ip: req.ip,
        resultado: 'CRÍTICO',
        motivo: err.message,
        stack: err.stack,
      });
      return res
        .status(500)
        .json({ error: 'Error interno del servidor', code: 'INTERNAL_SERVER_ERROR' });
    }
  }

  static async registrarGlucosa(req, res) {
    const {
      fecha,
      hora,
      id_momento,
      id_paciente,
      nivel_glucosa,
      observaciones,
    } = req.body;

    if (!fecha || !hora || !id_momento || !id_paciente || !nivel_glucosa) {
      return res
        .status(400)
        .json({ error: 'Todos los campos (menos observaciones) deben estar llenados' });
    }

    try {
      const { data: glucosaData, error: glucosaError } = await supabase
        .from('registro_glucosa')
        .insert([
          {
            id_paciente,
            id_momento,
            fecha,
            hora,
            nivel_glucosa,
            observaciones,
          },
        ])
        .select();

      if (glucosaError) throw glucosaError;

      const registro_glucosa = glucosaData[0];

      res.status(200).json({
        message: 'Registro insertado correctamente',
        id_registro: registro_glucosa.id,
        registro_glucosa,
      });
    } catch (error) {
      console.error('Error al insertar los datos: ', error.message);
      res.status(500).json({ error: error.message });
    }
  }

  static async actualizarPaciente(req, res) {
    const id_usuario = parseInt(req.params.id_usuario);
    const {
      nombre,
      altura,
      peso,
      telefono,
      correo,
      embarazo,
      fecha_terminacion,
      semanas_embarazo,
      nombre_emergencia,
      numero_emergencia,
    } = req.body;

    if (
      !nombre ||
      altura == null ||
      !peso ||
      !telefono ||
      !correo ||
      !nombre_emergencia ||
      !numero_emergencia
    ) {
      return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }

    try {
      const { data: pacienteData, error: pacienteError } = await supabase
        .from('paciente')
        .select('id_paciente')
        .eq('id_usuario', id_usuario)
        .single();

      if (pacienteError) throw pacienteError;
      if (!pacienteData) return res.status(404).json({ error: 'Paciente no encontrado' });

      const id_paciente = pacienteData.id_paciente;

      const { data: usuarioActualizado, error: errorUsuario } = await supabase
        .from('usuario')
        .update({
          nombre_completo: nombre,
          correo,
          teléfono: telefono,
        })
        .eq('id_usuario', id_usuario)
        .select()
        .single();

      if (errorUsuario) throw errorUsuario;

      const { data: pacienteActualizado, error: errorPaciente } = await supabase
        .from('paciente')
        .update({
          altura,
          peso: parseFloat(peso),
          embarazo: embarazo !== undefined ? embarazo : undefined,
          nombre_emergencia,
          numero_emergencia,
        })
        .eq('id_usuario', id_usuario)
        .select()
        .single();

      if (errorPaciente) throw errorPaciente;

      if (embarazo === true && semanas_embarazo > 0) {
        const { error: errorSeguimiento } = await supabase.from('seguimiento_embarazo').insert({
          id_paciente,
          fecha_registro: new Date().toISOString().split('T')[0],
          semanas_embarazo,
          fecha_terminacion: null,
        });
        if (errorSeguimiento) throw errorSeguimiento;
      } else if (embarazo === false && fecha_terminacion) {
        const { data: seguimientosActivos, error: errorFetch } = await supabase
          .from('seguimiento_embarazo')
          .select('id_seguimiento')
          .eq('id_paciente', id_paciente)
          .is('fecha_terminacion', null)
          .order('fecha_registro', { ascending: false })
          .limit(1);

        if (errorFetch) throw errorFetch;

        if (seguimientosActivos && seguimientosActivos.length > 0) {
          const id_seguimiento = seguimientosActivos[0].id_seguimiento;
          const { error: errorUpdate } = await supabase
            .from('seguimiento_embarazo')
            .update({ fecha_terminacion })
            .eq('id_seguimiento', id_seguimiento);

          if (errorUpdate) throw errorUpdate;
        }
      }

      res.json({
        usuario: usuarioActualizado,
        paciente: pacienteActualizado,
      });
    } catch (error) {
      console.error('Error al actualizar paciente:', error);
      res.status(500).json({ error: 'Error al actualizar paciente', details: error });
    }
  }

  static async obtenerSemanasEmbarazoActual(req, res) {
    const id_paciente = req.params.id_paciente;

    try {
      const { data: dataPaciente, error: errorPaciente } = await supabase
        .from('paciente')
        .select('embarazo')
        .eq('id_paciente', id_paciente)
        .single();

      if (errorPaciente) throw errorPaciente;

      const embarazo = dataPaciente.embarazo;

      if (embarazo === true) {
        const { data: dataEmbarazo, error: errorEmbarazo } = await supabase
          .from('seguimiento_embarazo')
          .select('fecha_registro, semanas_embarazo')
          .eq('id_paciente', id_paciente)
          .is('fecha_terminacion', null)
          .order('fecha_registro', { ascending: false })
          .limit(1);

        if (errorEmbarazo) throw errorEmbarazo;

        if (!dataEmbarazo || dataEmbarazo.length === 0) {
          return res.json({ semanas_actuales: null });
        }

        const registro = dataEmbarazo[0];
        const fechaRegistro = new Date(registro.fecha_registro);
        const semanasIniciales = registro.semanas_embarazo;

        const hoy = new Date();
        const diferenciaDias = Math.floor((hoy - fechaRegistro) / (1000 * 60 * 60 * 24));
        const semanasActuales = semanasIniciales + Math.floor(diferenciaDias / 7);

        return res.json({ semanas_actuales: semanasActuales });
      } else {
        return res.json({ semanas_actuales: null });
      }
    } catch (error) {
      console.error('Error al obtener semanas de embarazo:', error);
      return res.status(500).json({ error: 'Error al obtener semanas de embarazo' });
    }
  }
}

export default PacienteController;
