import { Router } from 'express';
import { buildRecordsExportWorkbook } from '../services/exportWorkbook.js';
import { nowUTC8 } from '../utils/datetime.js';
import { exportLimiter } from '../middleware/security.js';

const router = Router();

router.get('/records', exportLimiter, async (_req, res) => {
  try {
    const buffer = await buildRecordsExportWorkbook();
    const datePart = nowUTC8().slice(0, 10);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="financial-tracker-export-${datePart}.xlsx"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('GET /api/export/records error:', err);
    res.status(500).json({ error: 'Failed to export records' });
  }
});

export default router;
