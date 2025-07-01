const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { ImageAnnotatorClient } = require('@google-cloud/vision');
const analysisController = require('../controllers/analysisController');

console.log('[ROUTES] Initializing analysis routes...');

const uploadDir = path.join(__dirname, '../uploads');

// Initialize Google Vision Client
let visionClient;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    visionClient = new ImageAnnotatorClient({
      credentials,
      projectId: credentials.project_id || 'nutriscan01'
    });
    console.log('[CONFIG] Vision client initialized with in-memory credentials');
  } catch (err) {
    console.error('[CONFIG] Failed to parse credentials:', err);
  }
} else {
  console.error('[CONFIG] GOOGLE_APPLICATION_CREDENTIALS_JSON not set');
}

// Ensure uploads directory exists
if (!fs.existsSync(uploadDir)) {
  console.log(`[ROUTES] Creating uploads directory at ${uploadDir}`);
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname).toLowerCase());
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png/;
  const isValid = allowedTypes.test(file.mimetype) && allowedTypes.test(path.extname(file.originalname).toLowerCase());
  cb(isValid ? null : new Error('Only JPEG, JPG, PNG allowed!'), isValid);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }
});

const handleMulterErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError || err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
};

// Routes
router.post('/analyze', upload.single('image'), handleMulterErrors, async (req, res, next) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No image provided' });

  try {
    await sharp(req.file.path).metadata();
  } catch (err) {
    await fs.promises.unlink(req.file.path).catch(() => {});
    return res.status(400).json({ success: false, message: 'Invalid or corrupted image' });
  }

  try {
    analysisController.analyzeMeal(req, res, next, visionClient);
  } catch (error) {
    await fs.promises.unlink(req.file.path).catch(() => {});
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Analysis route working', timestamp: new Date().toISOString() });
});

console.log('[ROUTES] Analysis routes initialized');
module.exports = router;
