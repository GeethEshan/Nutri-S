const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { ImageAnnotatorClient } = require('@google-cloud/vision');
const analysisController = require('../controllers/analysisController');

console.log('[ROUTES] Initializing analysis routes...');

// Paths
const serviceAccountPath = path.join(__dirname, '../service-account.json');
const uploadDir = path.join(__dirname, '../uploads');

// Ensure service account file exists (for cloud environments)
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  try {
    const parsed = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON); 
    fs.writeFileSync(serviceAccountPath, JSON.stringify(parsed, null, 2));
    console.log('[CONFIG] Service account JSON written to file.');
  } catch (err) {
    console.error('[CONFIG] Failed to write service account file:', err);
  }
}

// Initialize Google Vision Client
const visionClient = new ImageAnnotatorClient({
  keyFilename: serviceAccountPath,
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'nutriscan01'
});

// Ensure uploads directory exists
if (!fs.existsSync(uploadDir)) {
  console.log(`[ROUTES] Creating uploads directory at ${uploadDir}`);
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log(`[MULTER] Destination set to ${uploadDir}`);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = uniqueSuffix + ext;
    console.log(`[MULTER] Generated filename: ${filename}`);
    cb(null, filename);
  }
});

const fileFilter = (req, file, cb) => {
  console.log(`[MULTER] Filtering file: ${file.originalname}`);
  const allowedTypes = /jpeg|jpg|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    console.log('[MULTER] File accepted');
    cb(null, true);
  } else {
    console.log('[MULTER] File rejected - invalid type');
    cb(new Error('Error: Only JPEG, JPG, or PNG images are allowed!'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1
  }
});

// Multer error handling
const handleMulterErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, message: 'File size exceeds 5MB limit' });
    }
    return res.status(400).json({ success: false, message: err.message });
  } else if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
};

// Image Analysis Route
router.post('/analyze',
  upload.single('image'),
  handleMulterErrors,
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No image file provided' });
      }

      console.log('[ROUTE] POST /api/analysis/analyze received');
      console.log(`[ROUTE] Processing file: ${req.file.path}`);

      // Basic image validation
      try {
        await sharp(req.file.path).metadata();
      } catch (err) {
        console.error('[VALIDATION] Invalid or corrupted image:', err);
        await fs.promises.unlink(req.file.path).catch(console.error);
        return res.status(400).json({ success: false, message: 'Invalid or corrupted image file' });
      }

      // Pass visionClient to controller
      analysisController.analyzeMeal(req, res, next, visionClient);

    } catch (error) {
      console.error('[SERVER ERROR]', error);
      if (req.file) {
        await fs.promises.unlink(req.file.path).catch(console.error);
      }
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// Test Route
router.get('/test', (req, res) => {
  console.log('[ROUTE] GET /api/analysis/test received');
  res.json({
    success: true,
    message: 'Analysis route working!',
    timestamp: new Date().toISOString()
  });
});

console.log('[ROUTES] Analysis routes initialized');
module.exports = router;
