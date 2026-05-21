import supabase from '../config/database.js';

class GeneralController {
  static async verMomentos(req, res) {
    try {
      const { data, error } = await supabase.from('momento_dia').select(`
                  id_momento, momento 
              `);

      if (error) throw error;

      res.status(200).json(data);
    } catch (error) {
      console.error('Error al obtener momentos: ', error.message);
      res.status(500).json({ error: 'Error al obtener momentos' });
    }
  }

  static async verNiveles(req, res) {
    try {
      const { data, error } = await supabase
        .from('nivel_actividad_fisica')
        .select('id_nivel_actividad,descripcion');
      if (error) throw error;

      res.status(200).json(data);
    } catch (error) {
      console.error('Error al obtener niveles de actividad: ', error.message);
      res.status(500).json({ error: 'Error al obtener actividades' });
    }
  }

  static async verEnfermedades(req, res) {
    try {
      const { data, error } = await supabase
        .from('enfermedades_base')
        .select('id_enfermedad,nombre_enfermedad');
      if (error) throw error;

      res.status(200).json(data);
    } catch (error) {
      console.error('Error al obtener enfermedades: ', error.message);
      res.status(500).json({ error: 'Error al obtener enfermedades' });
    }
  }

  static async verTratamientos(req, res) {
    try {
      const { data, error } = await supabase
        .from('tratamientos')
        .select('id_tratamiento,nombre_tratamiento,descripcion');
      if (error) throw error;

      res.status(200).json(data);
    } catch (error) {
      console.error('Error al obtener tratamientos: ', error.message);
      res.status(500).json({ error: 'Error al obtener tratamientos' });
    }
  }

  static async verEspecialidades(req, res) {
    try {
      const { data, error } = await supabase.from('especialidad').select('id_especialidad,nombre');
      if (error) throw error;

      res.status(200).json(data);
    } catch (error) {
      console.error('Error al obtener tratamientos: ', error.message);
      res.status(500).json({ error: 'Error al obtener tratamientos' });
    }
  }

  static async verAuditoria(req, res) {
    try {
      const { data: auditoria, error: auditoriaError } = await supabase.from('auditoria_endpoints')
        .select(`
              *,
              usuario(nombre_completo)
          `);

      if (auditoriaError) throw auditoriaError;

      return res.status(200).json(auditoria);
    } catch (error) {
      console.error('Error obteniendo auditoría:', error);
      return res.status(500).json({
        message: 'Error obteniendo auditoría',
        error: error.message,
      });
    }
  }
}

export default GeneralController;
