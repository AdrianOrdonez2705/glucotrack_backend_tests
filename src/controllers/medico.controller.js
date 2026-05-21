import supabase from '../config/database.js';
import bcrypt from 'bcrypt';

class MedicoController {
  static async registrarMedico(req, res) {
    try {
      const {
        nombre_completo,
        correo,
        contrasena,
        telefono,
        fecha_nac,
        id_especialidad,
        departamento,
      } = req.body;

      const pdfFiles = req.files?.matriculaProfesional;
      const imgFiles = req.files?.carnetProfesional;

      if (!pdfFiles || pdfFiles.length === 0) {
        return res.status(400).json({ error: 'Archivo de matrícula faltante' });
      }
      if (!imgFiles || imgFiles.length === 0) {
        return res.status(400).json({ error: 'Archivo de carnet faltante' });
      }

      const pdf = pdfFiles[0];
      const img = imgFiles[0];

      const pdfUpload = await supabase.storage
        .from('Matriculas_PDF')
        .upload(`pdfs/${Date.now()}_${pdf.originalname}`, pdf.buffer, { contentType: pdf.mimetype });

      const imgUpload = await supabase.storage
        .from('Carnets_IMG')
        .upload(`imgs/${Date.now()}_${img.originalname}`, img.buffer, { contentType: img.mimetype });

      if (pdfUpload.error) throw pdfUpload.error;
      if (imgUpload.error) throw imgUpload.error;

      const pdfUrl = supabase.storage.from('Matriculas_PDF').getPublicUrl(pdfUpload.data.path)
        .data.publicUrl;
      const imgUrl = supabase.storage.from('Carnets_IMG').getPublicUrl(imgUpload.data.path)
        .data.publicUrl;

      const hashed_contrasena = await bcrypt.hash(contrasena, 10);
      const rol = 'medico';

      const { data: usuarioData, error: usuarioError } = await supabase
        .from('usuario')
        .insert([
          {
            nombre_completo,
            correo,
            contrasena: hashed_contrasena,
            rol,
            teléfono: telefono,
            fecha_nac,
          },
        ])
        .select();

      if (usuarioError) throw usuarioError;
      const usuario = usuarioData[0];

      const { data: medicoData, error: medicoError } = await supabase
        .from('medico')
        .insert([
          {
            id_usuario: usuario.id_usuario,
            id_especialidad,
            matricula_profesional: pdfUrl,
            departamento,
            carnet_profesional: imgUrl,
            administrador_id_admin: 1,
          },
        ])
        .select();

      if (medicoError) throw medicoError;

      res
        .status(200)
        .json({ mensaje: 'Médico registrado correctamente', usuario, medico: medicoData[0] });
    } catch (error) {
      console.error('❌ Error en registrarMedico:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async verMedicos(req, res) {
    try {
      const { data, error } = await supabase.from('medico').select(`
          id_medico,
          usuario ( nombre_completo )
        `);

      if (error) throw error;

      res.status(200).json(data);
    } catch (error) {
      console.error('Error al obtener médicos:', error.message);
      res.status(500).json({ error: 'Error al obtener médicos' });
    }
  }

  static async perfilMedico(req, res) {
    try {
      const idUsuario = parseInt(req.params.idUsuario);
      if (isNaN(idUsuario)) {
        return res.status(400).json({ error: 'El ID de usuario debe ser un número válido' });
      }

      const { data, error, status } = await supabase
        .from('medico')
        .select(
          `
          id_medico,
          matricula_profesional,
          departamento,
          carnet_profesional,
          usuario!inner (
            nombre_completo,
            fecha_nac,
            teléfono,
            correo
          ),
          administrador (
            usuario (
              nombre_completo
            )
          )
        `,
        )
        .eq('id_usuario', idUsuario)
        .maybeSingle();

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
          .json({ error: 'Error al consultar el perfil del médico', code: 'DB_QUERY_ERROR' });
      }

      if (!data) {
        console.log({
          fecha: new Date().toISOString(),
          resultado: 'NO ENCONTRADO',
          mensaje: `No se encontró un médico con el id_usuario: ${idUsuario}`,
        });
        return res.status(404).json({ message: 'No se encontró el médico' });
      }

      const formatearFecha = (fechaString) => {
        if (!fechaString) return null;
        const partes = fechaString.split('T')[0].split('-');
        if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
        return fechaString;
      };

      const medicoFormateado = {
        id: data.id_medico,
        nombre: data.usuario?.nombre_completo || 'Sin nombre',
        fechaNac: formatearFecha(data.usuario?.fecha_nac),
        telefono: data.usuario?.teléfono || 'No registrado',
        correo: data.usuario?.correo || 'Sin correo',
        matricula: data.matricula_profesional || 'N/A',
        departamento: data.departamento || 'N/A',
        carnet: data.carnet_profesional || 'N/A',
        admin: data.administrador?.usuario?.nombre_completo || 'No',
      };

      console.log({
        fecha: new Date().toISOString(),
        metodo: req.method,
        ip: req.ip,
        resultado: 'EXITOSO',
        medico_id: medicoFormateado.id,
      });

      return res.status(200).json(medicoFormateado);
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

  static async verPacientes(req, res) {
    try {
      const idMedico = parseInt(req.params.idMedico);
      if (isNaN(idMedico)) {
        return res.status(400).json({ error: 'El ID del médico debe ser un número válido' });
      }

      const { data, error, status } = await supabase
        .from('paciente')
        .select(
          `
          id_paciente,
          genero,
          peso,
          altura,
          numero_emergencia,
          nombre_emergencia,
          foto_perfil,
          usuario!inner (
            id_usuario,
            nombre_completo,
            fecha_nac,
            teléfono,
            correo,
            estado
          ),
          nivel_actividad_fisica (
            descripcion
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
          registro_glucosa (
            fecha,
            hora,
            nivel_glucosa,
            observaciones,
            momento_dia (
              momento
            ),
            alertas (
              tipo_alerta (
                tipo
              ),
              retroalimentacion (
                mensaje
              )
            )
          )
        `,
        )
        .eq('id_medico', idMedico)
        .eq('usuario.estado', true);

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
          .json({ error: 'Error al consultar pacientes', code: 'DB_QUERY_ERROR' });
      }

      if (!data || data.length === 0) {
        return res.status(200).json([]);
      }

      const formatearFecha = (fechaString) => {
        if (!fechaString) return null;
        const partes = fechaString.split('T')[0].split('-');
        if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
        return fechaString;
      };

      const formatearHora = (horaString) => {
        if (!horaString) return null;
        return horaString.substring(0, 5);
      };

      const pacientesFormateados = data.map((p) => {
        const afeccionesList = p.paciente_enfermedad
          ? p.paciente_enfermedad.map((pe) => ({
              afeccion: pe.enfermedades_base?.nombre_enfermedad || 'Desconocida',
            }))
          : [];

        const tratamientosList = p.tratamiento_enfermedad
          ? p.tratamiento_enfermedad.map((te) => ({
              titulo: te.tratamientos?.nombre_tratamiento || 'Sin título',
              desc: te.tratamientos?.descripcion || '',
              dosis: te.dosis ? String(te.dosis) : null,
            }))
          : [];

        const rawRegistros = p.registro_glucosa || [];
        const historialMap = {};

        rawRegistros.forEach((reg) => {
          const fechaFormateada = formatearFecha(reg.fecha);

          if (!historialMap[reg.fecha]) {
            historialMap[reg.fecha] = {
              fechaFormateada: fechaFormateada,
              fechaRaw: reg.fecha,
              registros: [],
            };
          }

          const alertaData = Array.isArray(reg.alertas) ? reg.alertas[0] : reg.alertas;
          let alertaFormat = null;

          if (alertaData) {
            const tipoAlerta = Array.isArray(alertaData.tipo_alerta)
              ? alertaData.tipo_alerta[0]
              : alertaData.tipo_alerta;
            const retro = Array.isArray(alertaData.retroalimentacion)
              ? alertaData.retroalimentacion[0]
              : alertaData.retroalimentacion;

            alertaFormat = {
              nivel: tipoAlerta?.tipo || null,
              observacion: reg.observaciones || null,
              mensaje: retro?.mensaje || null,
            };
          }

          historialMap[reg.fecha].registros.push({
            fecha: fechaFormateada,
            hora: formatearHora(reg.hora),
            momento: reg.momento_dia?.momento || null,
            glucosa: reg.nivel_glucosa ? String(reg.nivel_glucosa) : null,
            alerta: alertaFormat,
          });
        });

        const historialAgrupado = Object.values(historialMap)
          .sort((a, b) => new Date(b.fechaRaw) - new Date(a.fechaRaw))
          .map((grupo) => {
            grupo.registros.sort((a, b) => a.hora.localeCompare(b.hora));
            return {
              fecha: grupo.fechaFormateada,
              registros: grupo.registros,
            };
          });

        return {
          id: p.id_paciente,
          nombre: p.usuario?.nombre_completo || 'Sin nombre',
          ci: p.usuario?.id_usuario ? String(p.usuario.id_usuario) : null,
          fechaNac: formatearFecha(p.usuario?.fecha_nac),
          genero: p.genero || null,
          peso: p.peso ? String(p.peso) : null,
          altura: p.altura ? String(p.altura) : null,
          actividadFisica: p.nivel_actividad_fisica?.descripcion || null,
          telefono: p.usuario?.teléfono || 'No registrado',
          correo: p.usuario?.correo || 'No registrado',
          numero_emergencia: p.numero_emergencia || null,
          nombre_emergencia: p.nombre_emergencia || null,
          foto_perfil: p.foto_perfil || null,
          afecciones: afeccionesList,
          tratamientos: tratamientosList,
          historial: historialAgrupado,
        };
      });

      console.log({
        fecha: new Date().toISOString(),
        metodo: req.method,
        ip: req.ip,
        resultado: 'EXITOSO',
        medico_id: idMedico,
        pacientes_encontrados: pacientesFormateados.length,
      });

      return res.status(200).json(pacientesFormateados);
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

  static async alertasActivas(req, res) {
    try {
      const idMedico = parseInt(req.params.idMedico);
      if (isNaN(idMedico)) {
        return res.status(400).json({ error: 'El ID del médico debe ser un número válido' });
      }

      const { data, error, status } = await supabase
        .from('alertas')
        .select(
          `
          id_alerta,
          estado,
          tipo_alerta!inner (
            tipo
          ),
          registro_glucosa!inner (
            fecha,
            hora,
            nivel_glucosa,
            observaciones,
            id_medico,
            paciente!inner (
              id_paciente,
              usuario!inner (
                nombre_completo
              )
            ),
            momento_dia (
              momento
            )
          )
        `,
        )
        .eq('estado', true)
        .eq('registro_glucosa.id_medico', idMedico);

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
          .json({ error: 'Error al consultar las alertas', code: 'DB_QUERY_ERROR' });
      }

      if (!data || data.length === 0) {
        console.log({
          fecha: new Date().toISOString(),
          metodo: req.method,
          resultado: 'EXITOSO',
          mensaje: 'No hay alertas activas para este médico.',
        });
        return res.status(200).json([]);
      }

      const formatearHora = (horaString) => {
        if (!horaString) return null;
        return horaString.substring(0, 5);
      };

      const alertasFormateadas = data.map((a) => ({
        id: a.id_alerta,
        nivel: a.tipo_alerta?.tipo || 'Desconocido',
        idpaciente: a.registro_glucosa?.paciente?.id_paciente,
        paciente: a.registro_glucosa?.paciente?.usuario?.nombre_completo || 'Sin nombre',
        fecha: a.registro_glucosa?.fecha,
        hora: formatearHora(a.registro_glucosa?.hora),
        glucosa: a.registro_glucosa?.nivel_glucosa ? Number(a.registro_glucosa.nivel_glucosa) : null,
        momento: a.registro_glucosa?.momento_dia?.momento || '',
        observaciones: a.registro_glucosa?.observaciones || '',
      }));

      console.log({
        fecha: new Date().toISOString(),
        metodo: req.method,
        ip: req.ip,
        resultado: 'EXITOSO',
        medico_id: idMedico,
        alertas_encontradas: alertasFormateadas.length,
      });

      return res.status(200).json(alertasFormateadas);
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

  static async alertasResueltas(req, res) {
    try {
      const idMedico = parseInt(req.params.idMedico);
      if (isNaN(idMedico)) {
        return res.status(400).json({ error: 'El ID del médico debe ser un número válido' });
      }

      const { data, error, status } = await supabase
        .from('alertas')
        .select(
          `
          id_alerta,
          estado,
          tipo_alerta!inner (
            tipo
          ),
          retroalimentacion (
            mensaje
          ),
          registro_glucosa!inner (
            fecha,
            hora,
            nivel_glucosa,
            observaciones,
            id_paciente,
            id_medico,
            paciente (
              id_paciente,
              usuario (
                nombre_completo
              )
            ),
            momento_dia (
              momento
            )
          )
        `,
        )
        .eq('estado', false)
        .eq('registro_glucosa.id_medico', idMedico);

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
          .json({ error: 'Error al consultar las alertas resueltas', code: 'DB_QUERY_ERROR' });
      }

      if (!data || data.length === 0) {
        console.log({
          fecha: new Date().toISOString(),
          metodo: req.method,
          resultado: 'EXITOSO',
          mensaje: 'No hay alertas resueltas para este médico.',
        });
        return res.status(200).json([]);
      }

      const formatearHora = (horaString) => {
        if (!horaString) return null;
        return horaString.substring(0, 5);
      };

      const alertasFormateadas = data.map((a) => {
        const retro = Array.isArray(a.retroalimentacion)
          ? a.retroalimentacion[0]
          : a.retroalimentacion;

        return {
          id: a.id_alerta,
          nivel: a.tipo_alerta?.tipo || 'Desconocido',
          idpaciente: a.registro_glucosa?.paciente?.id_paciente || a.registro_glucosa?.id_paciente,
          paciente: a.registro_glucosa?.paciente?.usuario?.nombre_completo || '',
          fecha: a.registro_glucosa?.fecha,
          hora: formatearHora(a.registro_glucosa?.hora),
          glucosa: a.registro_glucosa?.nivel_glucosa
            ? Number(a.registro_glucosa.nivel_glucosa)
            : null,
          momento: a.registro_glucosa?.momento_dia?.momento || '',
          observaciones: a.registro_glucosa?.observaciones || '',
          mensaje: retro?.mensaje || '',
        };
      });

      console.log({
        fecha: new Date().toISOString(),
        metodo: req.method,
        ip: req.ip,
        resultado: 'EXITOSO',
        medico_id: idMedico,
        alertas_encontradas: alertasFormateadas.length,
      });

      return res.status(200).json(alertasFormateadas);
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

  static async retroalimentacionAlerta(req, res) {
    const { id_medico, fecha_registro, mensaje, alertas_id_alerta } = req.body;

    if (!id_medico || !fecha_registro || !mensaje || !alertas_id_alerta) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    try {
      const { data: retroData, error: retroError } = await supabase
        .from('retroalimentacion')
        .insert([
          {
            id_medico,
            fecha_registro,
            mensaje,
            alertas_id_alerta,
          },
        ])
        .select();

      if (retroError) throw retroError;

      const { data: alertaUpdate, error: alertaError } = await supabase
        .from('alertas')
        .update({ estado: false })
        .eq('id_alerta', alertas_id_alerta)
        .select();

      if (alertaError) throw alertaError;

      return res.status(200).json({
        message: 'Alerta respondida y actualizada correctamente',
        retroalimentacion: retroData,
        alerta_actualizada: alertaUpdate,
      });
    } catch (err) {
      console.error('Error al responder alerta:', err.message);
      res.status(500).json({ error: err.message });
    }
  }

  static async registrarGlucosaMedico(req, res) {
    const { fecha, hora, id_medico, id_momento, id_paciente, nivel_glucosa, observaciones } =
      req.body;

    if (!fecha || !hora || !id_medico || !id_momento || !id_paciente || !nivel_glucosa) {
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
            id_medico,
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

  static async actualizarMedico(req, res) {
    const { id_medico } = req.params;
    const { telefono, correo, departamento } = req.body;
    const carnetFile = req.file;

    try {
      const { data: medico, error: medicoFetchError } = await supabase
        .from('medico')
        .select('id_usuario')
        .eq('id_medico', id_medico)
        .single();

      if (medicoFetchError || !medico) {
        return res.status(404).json({ message: 'Médico no encontrado' });
      }

      const { id_usuario } = medico;

      const usuarioUpdates = {};
      if (telefono !== undefined) usuarioUpdates['teléfono'] = telefono;
      if (correo !== undefined) usuarioUpdates.correo = correo;

      const medicoUpdates = {};
      if (departamento !== undefined) medicoUpdates.departamento = departamento;

      if (carnetFile) {
        const fileName = `carnet-${id_usuario}-${Date.now()}.${carnetFile.originalname.split('.').pop()}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('Carnets_IMG')
          .upload(fileName, carnetFile.buffer, {
            contentType: carnetFile.mimetype,
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('Carnets_IMG').getPublicUrl(uploadData.path);
        medicoUpdates.carnet_profesional = urlData.publicUrl;
      }

      if (Object.keys(usuarioUpdates).length > 0) {
        const { error } = await supabase
          .from('usuario')
          .update(usuarioUpdates)
          .eq('id_usuario', id_usuario);
        if (error) throw error;
      }

      if (Object.keys(medicoUpdates).length > 0) {
        const { error } = await supabase
          .from('medico')
          .update(medicoUpdates)
          .eq('id_medico', id_medico);
        if (error) throw error;
      }

      return res.status(200).json({
        message: 'Datos actualizados correctamente',
        carnet_url: medicoUpdates.carnet_profesional || 'No se actualizó el carnet',
      });
    } catch (error) {
      console.error('Error al actualizar:', error);
      return res.status(500).json({
        message: 'Error al actualizar los datos',
        error: error.message,
      });
    }
  }
}

export default MedicoController;
