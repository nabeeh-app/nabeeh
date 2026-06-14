const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const Papa = require('papaparse');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/database').supabaseAdmin;
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { detectColumnType, validateImportData, HEADER_MAPPINGS } = require('../lib/importValidation');
const { seedDemoData, removeDemoData } = require('../scripts/seed_demo_data');
const { logAudit } = require('../lib/auditLog');
const logger = require('../lib/logger');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/tab-separated-values'
    ];
    const allowedExts = ['.csv', '.xls', '.xlsx', '.tsv'];
    const ext = require('path').extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Please upload CSV, XLS, or XLSX files.'));
    }
  }
});

function parseFile(buffer, originalname) {
  const ext = require('path').extname(originalname).toLowerCase();

  if (ext === '.csv' || ext === '.tsv') {
    const text = buffer.toString('utf-8');
    const delimiter = ext === '.tsv' ? '\t' : undefined;
    const result = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      delimiter
    });
    return { headers: result.meta.fields || [], rows: result.data, errors: result.errors };
  }

  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (jsonData.length === 0) {
    return { headers: [], rows: [], errors: [] };
  }

  const headers = Object.keys(jsonData[0]);
  return { headers, rows: jsonData, errors: [] };
}

function autoDetectMapping(headers) {
  const mapping = {};
  const unmapped = [];

  for (const header of headers) {
    const detected = detectColumnType(header);
    if (detected) {
      mapping[header] = detected;
    } else {
      unmapped.push(header);
    }
  }

  return { mapping, unmapped };
}

/**
 * @openapi
 * /api/import/preview:
 *   post:
 *     tags: [Import]
 *     summary: Preview file upload
 *     description: Upload a CSV/XLS/XLSX file and get a preview of the parsed data with auto-detected column mappings.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV, XLS, or XLSX file (max 10MB)
 *     responses:
 *       200:
 *         description: Preview data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     fileName:
 *                       type: string
 *                     totalRows:
 *                       type: integer
 *                     headers:
 *                       type: array
 *                       items:
 *                         type: string
 *                     autoMapping:
 *                       type: object
 *                     unmappedColumns:
 *                       type: array
 *                       items:
 *                         type: string
 *                     preview:
 *                       type: array
 *                       items:
 *                         type: object
 *       400:
 *         description: No file uploaded or file is empty
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
router.post('/preview', authenticateToken, requirePermission('manage_students'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { headers, rows, errors: parseErrors } = parseFile(req.file.buffer, req.file.originalname);

    if (parseErrors.length > 0) {
      logger.warn('File parse errors', { errors: parseErrors, teacherId: req.user.id });
    }

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'File is empty or has no data rows' });
    }

    const { mapping, unmapped } = autoDetectMapping(headers);

    const previewRows = rows.slice(0, 5).map(row => {
      const result = {};
      for (const [header, value] of Object.entries(row)) {
        result[header] = value;
      }
      return result;
    });

    res.json({
      success: true,
      data: {
        fileName: req.file.originalname,
        totalRows: rows.length,
        headers,
        autoMapping: mapping,
        unmappedColumns: unmapped,
        preview: previewRows
      }
    });
  } catch (error) {
    logger.error('Import preview error', { error: error.message, teacherId: req.user.id });
    res.status(500).json({ success: false, message: 'Failed to parse file' });
  }
});

/**
 * @openapi
 * /api/import/validate:
 *   post:
 *     tags: [Import]
 *     summary: Validate file
 *     description: Upload a CSV/XLS/XLSX file and validate rows against field mappings. Returns validated rows with status indicators.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV, XLS, or XLSX file (max 10MB)
 *               mapping:
 *                 type: string
 *                 description: JSON string of column-to-field mappings (e.g. '{"Name":"name","Phone":"phone"}')
 *               requiredFields:
 *                 type: string
 *                 description: JSON string of required fields array (e.g. '["name"]')
 *     responses:
 *       200:
 *         description: Validation results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     fieldMapping:
 *                       type: object
 *                     rows:
 *                       type: array
 *                       items:
 *                         type: object
 *                     stats:
 *                       type: object
 *       400:
 *         description: No file uploaded or file is empty
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
router.post('/validate', authenticateToken, requirePermission('manage_students'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    let fieldMapping;
    try {
      fieldMapping = JSON.parse(req.body.mapping || '{}');
    } catch {
      fieldMapping = {};
    }

    let requiredFields;
    try {
      requiredFields = JSON.parse(req.body.requiredFields || 'null');
    } catch {
      requiredFields = null;
    }

    const { headers, rows } = parseFile(req.file.buffer, req.file.originalname);

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'File is empty' });
    }

    if (Object.keys(fieldMapping).length === 0) {
      const auto = autoDetectMapping(headers);
      fieldMapping = auto.mapping;
    }

    const { rows: validatedRows, stats } = validateImportData(rows, fieldMapping, requiredFields);

    res.json({
      success: true,
      data: {
        fieldMapping,
        rows: validatedRows,
        stats
      }
    });
  } catch (error) {
    logger.error('Import validate error', { error: error.message, teacherId: req.user.id });
    res.status(500).json({ success: false, message: 'Validation failed' });
  }
});

/**
 * @openapi
 * /api/import/execute:
 *   post:
 *     tags: [Import]
 *     summary: Execute import
 *     description: Import validated student rows into a group. Creates students, enrollments, and optional parent records.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fieldMapping, rows, groupId]
 *             properties:
 *               fieldMapping:
 *                 type: object
 *                 description: Column-to-field mappings
 *               rows:
 *                 type: array
 *                 items:
 *                   type: object
 *                 description: Validated rows to import
 *               groupId:
 *                 type: string
 *                 format: uuid
 *                 description: Target group ID for enrollment
 *               skipErrors:
 *                 type: boolean
 *                 default: true
 *                 description: Skip rows with errors during import
 *     responses:
 *       200:
 *         description: Import completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     imported:
 *                       type: integer
 *                     skipped:
 *                       type: integer
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: object
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid import data or missing group
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       403:
 *         description: Unauthorized for this group
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
router.post('/execute', authenticateToken, requirePermission('manage_students'), async (req, res) => {
  try {
    const { fieldMapping, rows, groupId, skipErrors = true } = req.body;

    if (!fieldMapping || !rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid import data' });
    }

    if (!groupId) {
      return res.status(400).json({ success: false, message: 'Target group is required' });
    }

    const { data: groupCheck } = await supabase
      .from('groups')
      .select('id, offering:offerings(teacher_id, id)')
      .eq('id', groupId)
      .single();

    if (!groupCheck || groupCheck.offering.teacher_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized for this group' });
    }

    const { rows: validatedRows, stats } = validateImportData(
      rows.map(r => r.data || r),
      fieldMapping
    );

    const toImport = validatedRows.filter(r => r.status === 'ready' || r.status === 'warning');
    const skipped = validatedRows.filter(r => r.status === 'error' && !skipErrors);

    const results = { imported: 0, skipped: skipped.length, errors: [] };

    for (const row of toImport) {
      try {
        const studentData = {
          teacher_id: req.user.id,
          student_code: row.data.student_code || `ST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: row.data.name,
          phone: row.data.phone || null,
          is_demo: false
        };

        const { data: student, error: studentError } = await supabase
          .from('students')
          .insert([studentData])
          .select()
          .single();

        if (studentError) {
          results.errors.push({ row: row.data, error: studentError.message });
          continue;
        }

        const { error: enrollError } = await supabase
          .from('enrollments')
          .insert({
            student_id: student.id,
            group_id: groupId,
            teacher_id: req.user.id,
            status: 'active'
          });

        if (enrollError) {
          results.errors.push({ row: row.data, error: enrollError.message });
          continue;
        }

        if (row.data.parent_phone || row.data.parent_name) {
          await supabase.from('parents').insert([{
            student_id: student.id,
            name: row.data.parent_name || `Parent of ${row.data.name}`,
            phone: row.data.parent_phone,
            relationship: 'guardian',
            is_primary: true,
            preferred_language: 'ar'
          }]);
        }

        results.imported++;
      } catch (rowError) {
        results.errors.push({ row: row.data, error: rowError.message });
      }
    }

    await logAudit({
      actorId: req.user.id,
      actorType: req.user.role === 'teacher' ? 'teacher' : 'assistant',
      teacherId: req.user.teacherId || req.user.id,
      action: 'students_imported',
      entityType: 'student',
      metadata: { groupId, imported: results.imported, skipped: results.skipped, errorCount: results.errors.length },
      ipAddress: req.ip
    });

    res.json({
      success: true,
      data: results,
      message: `Import complete: ${results.imported} students added, ${results.skipped} skipped`
    });
  } catch (error) {
    logger.error('Import execute error', { error: error.message, teacherId: req.user.id });
    res.status(500).json({ success: false, message: 'Import failed' });
  }
});

/**
 * @openapi
 * /api/import/paste:
 *   post:
 *     tags: [Import]
 *     summary: Parse pasted text
 *     description: Parse tab-separated text pasted by the user and return auto-detected column mappings and preview data.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text:
 *                 type: string
 *                 description: Tab-separated text (with header row)
 *     responses:
 *       200:
 *         description: Parsed data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     headers:
 *                       type: array
 *                       items:
 *                         type: string
 *                     autoMapping:
 *                       type: object
 *                     unmappedColumns:
 *                       type: array
 *                       items:
 *                         type: string
 *                     totalRows:
 *                       type: integer
 *                     preview:
 *                       type: array
 *                       items:
 *                         type: object
 *                     allRows:
 *                       type: array
 *                       items:
 *                         type: object
 *       400:
 *         description: No text provided or no data rows found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
router.post('/paste', authenticateToken, requirePermission('manage_students'), async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, message: 'No text provided' });
    }

    const result = Papa.parse(text.trim(), {
      header: true,
      skipEmptyLines: true,
      delimiter: '\t'
    });

    if (result.data.length === 0) {
      return res.status(400).json({ success: false, message: 'No data rows found in pasted content' });
    }

    const headers = result.meta.fields || [];
    const { mapping, unmapped } = autoDetectMapping(headers);

    res.json({
      success: true,
      data: {
        headers,
        autoMapping: mapping,
        unmappedColumns: unmapped,
        totalRows: result.data.length,
        preview: result.data.slice(0, 5),
        allRows: result.data
      }
    });
  } catch (error) {
    logger.error('Paste parse error', { error: error.message, teacherId: req.user.id });
    res.status(500).json({ success: false, message: 'Failed to parse pasted data' });
  }
});

/**
 * @openapi
 * /api/import/demo/seed:
 *   post:
 *     tags: [Import]
 *     summary: Seed demo data
 *     description: Generate and insert demo student, attendance, and grade data for the authenticated teacher's account.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Demo data seeded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
router.post('/demo/seed', authenticateToken, requirePermission('manage_students'), async (req, res) => {
  try {
    const result = await seedDemoData(req.user.id);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Seed demo data error', { error: error.message, teacherId: req.user.id });
    res.status(500).json({ success: false, message: 'Failed to seed demo data' });
  }
});

/**
 * @openapi
 * /api/import/demo/remove:
 *   post:
 *     tags: [Import]
 *     summary: Remove demo data
 *     description: Remove all demo data (students, attendance, grades) created for the authenticated teacher's account.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Demo data removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
router.post('/demo/remove', authenticateToken, requirePermission('manage_students'), async (req, res) => {
  try {
    const result = await removeDemoData(req.user.id);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Remove demo data error', { error: error.message, teacherId: req.user.id });
    res.status(500).json({ success: false, message: 'Failed to remove demo data' });
  }
});

module.exports = router;
