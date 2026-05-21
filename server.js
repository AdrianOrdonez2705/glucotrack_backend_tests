import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

// Import ESM Routers (relative imports must have explicit .js extension)
import authRoutes from './src/routes/auth.routes.js';
import medicoRoutes from './src/routes/medico.routes.js';
import pacienteRoutes from './src/routes/pacientes.routes.js';
import adminRoutes from './src/routes/admin.routes.js';
import registroRoutes from './src/routes/registro.routes.js';
import generalRoutes from './src/routes/general.routes.js';
import pdfRoute from './src/routes/patientPDF.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use(
  cors({
    origin: ['http://localhost:4200', '*'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// Register Routes
app.use('/', authRoutes);
app.use('/api/medicos', medicoRoutes);
app.use('/api/pacientes', pacienteRoutes);
app.use('/api/administradores', adminRoutes);
app.use('/api/registro', registroRoutes);
app.use('/api/general', generalRoutes);
app.use('/api', pdfRoute);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
