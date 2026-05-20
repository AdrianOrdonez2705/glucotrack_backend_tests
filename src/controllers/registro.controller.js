const supabase = require('../../database');

const datosParaGlucosa = async (req, res) => {
  try {
    // 1. Validar parámetro (Ojo: Asegúrate de que el frontend envíe el ID del paciente)
    const idPaciente = parseInt(req.params.idUsuario);
    if (isNaN(idPaciente)) {
      return res.status(400).json({ error: 'El ID del paciente debe ser un número válido' });
    }

    // 2. Consulta a Supabase
    const { data, error, status } = await supabase
      .from('paciente')
      .select(
        `
        id_paciente,
        embarazo,
        id_medico,
        usuario!inner (
          fecha_nac
        ),
        paciente_enfermedad (
          enfermedades_base (
            nombre_enfermedad
          )
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
        .json({ error: 'Error al consultar los datos del paciente', code: 'DB_QUERY_ERROR' });
    }

    // 4. MANEJO DE REGISTRO NO ENCONTRADO (404)
    if (!data) {
      console.log({
        fecha: new Date().toISOString(),
        resultado: 'NO ENCONTRADO',
        mensaje: `No se encontró un paciente con el id: ${idPaciente}`,
      });
      return res.status(404).json({ message: 'No se encontraron datos para este paciente' });
    }

    // --- Función matemática para calcular la edad en JS (Equivalente a date_part(age())) ---
    const calcularEdad = (fechaNacimiento) => {
      if (!fechaNacimiento) return null;
      const hoy = new Date();
      const fechaNac = new Date(fechaNacimiento);
      let edad = hoy.getFullYear() - fechaNac.getFullYear();
      const mes = hoy.getMonth() - fechaNac.getMonth();

      // Si aún no ha pasado su mes de cumpleaños, o si es el mes pero no ha llegado el día, restamos 1 año
      if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) {
        edad--;
      }
      return edad;
    };

    // 5. MAPEO Y CONSTRUCCIÓN DEL OBJETO FINAL

    // Extracción de las enfermedades (tu SQL devolvía un array de strings)
    const enfermedadesList = data.paciente_enfermedad
      ? data.paciente_enfermedad
          .map((pe) => pe.enfermedades_base?.nombre_enfermedad)
          .filter(Boolean)
      : [];

    const datosGlucosa = {
      edad: calcularEdad(data.usuario?.fecha_nac),
      embarazo: data.embarazo || false,
      id_medico: data.id_medico || null,
      id_paciente: data.id_paciente,
      enfermedades: enfermedadesList,
    };

    // 6. RESPUESTA EXITOSA
    console.log({
      fecha: new Date().toISOString(),
      metodo: req.method,
      ip: req.ip,
      resultado: 'EXITOSO',
      paciente_id: datosGlucosa.id_paciente,
    });

    return res.status(200).json(datosGlucosa);
  } catch (err) {
    // 7. MANEJO DE ERRORES CRÍTICOS
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
};

const nodemailer = require('nodemailer');
const { getHipoTemplate, getHiperTemplate } = require('../email/templates');

const registrarAlerta = async (req, res) => {
  const { id_tipo_alerta, id_registro, id_medico, fecha_alerta } = req.body;

  // Validación básica
  if (!id_tipo_alerta || !id_registro || !id_medico || !fecha_alerta) {
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  }

  try {
    // 1️⃣ Insertar alerta (TUS DATOS ORIGINALES)
    const { data, error } = await supabase
      .from('alertas')
      .insert([
        {
          id_tipo_alerta,
          id_registro,
          id_medico,
          fecha_alerta,
        },
      ])
      .select();

    if (error) throw error;

    const alertaInsertada = data[0];

    // ----------------------------------------------------------
    // 2️⃣ OBTENER DATOS PARA EL CORREO SEGÚN TU BASE REAL
    // ----------------------------------------------------------

    // Obtener registro de glucosa
    const { data: registro } = await supabase
      .from('registro_glucosa')
      .select('id_paciente, nivel_glucosa, fecha, hora,observaciones')
      .eq('id_registro', id_registro)
      .single();

    if (!registro) throw new Error('Registro de glucosa no encontrado');

    // Obtener paciente
    const { data: paciente } = await supabase
      .from('paciente')
      .select('id_usuario, id_medico')
      .eq('id_paciente', registro.id_paciente)
      .single();

    if (!paciente) throw new Error('Paciente no encontrado');

    // Obtener médico asignado
    const { data: medico } = await supabase
      .from('medico')
      .select('id_usuario')
      .eq('id_medico', paciente.id_medico)
      .single();

    if (!medico) throw new Error('Médico asignado no encontrado');

    // Obtener correo del usuario del médico
    const { data: usuarioMedico } = await supabase
      .from('usuario')
      .select('correo, nombre_completo')
      .eq('id_usuario', medico.id_usuario)
      .single();

    if (!usuarioMedico) throw new Error('Usuario del médico no encontrado');

    // Obtener nombre del PACIENTE (usuario del paciente)
    const { data: usuarioPaciente } = await supabase
      .from('usuario')
      .select('nombre_completo')
      .eq('id_usuario', paciente.id_usuario)
      .single();

    if (!usuarioPaciente) throw new Error('Usuario del paciente no encontrado');

    // ----------------------------------------------------------
    // 3️⃣ PREPARAR PLANTILLA DEL CORREO
    // ----------------------------------------------------------

    const datosCorreo = {
      nombrePaciente: usuarioPaciente.nombre_completo,
      // podrías mostrar también el nombre del paciente
      valor: registro.nivel_glucosa,
      fecha: registro.fecha,
      hora: registro.hora,
      nombreMedico: usuarioMedico.nombre_completo,
      observaciones: registro.observaciones,
    };

    const template =
      id_tipo_alerta === 1 ? getHipoTemplate(datosCorreo) : getHiperTemplate(datosCorreo);

    // ----------------------------------------------------------
    // 4️⃣ ENVIAR CORREO
    // ----------------------------------------------------------

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    await transporter.sendMail({
      from: `"GlucoTracker" <${process.env.EMAIL_USER}>`,
      to: usuarioMedico.correo,
      subject: template.subject,
      html: template.html,
    });

    // ----------------------------------------------------------
    // 5️⃣ RESPUESTA (tu código)
    // ----------------------------------------------------------

    res.status(200).json({
      message: 'Alerta registrada y correo enviado correctamente',
      alerta: alertaInsertada,
    });
  } catch (err) {
    console.error('Error al insertar alerta:', err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { registrarAlerta };
module.exports = { datosParaGlucosa, registrarAlerta };
