import express from 'express';
import PdfService from '../pdf/makePatientPDF.js';

const router = express.Router();

router.post('/paciente/pdf', async (req, res) => {
  try {
    const paciente = req.body;

    if (!paciente) {
      return res.status(400).json({ error: 'Debes enviar el objeto paciente' });
    }

    const pdfBuffer = await PdfService.generatePatientPDF(paciente);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=paciente_${paciente.id}.pdf`,
      'Content-Length': pdfBuffer.length,
    });

    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generando PDF:', error);
    return res.status(500).json({ error: 'Error generando PDF' });
  }
});

export default router;
