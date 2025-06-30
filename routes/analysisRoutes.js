const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { ImageAnnotatorClient } = require('@google-cloud/vision');
const analysisController = require('../controllers/analysisController');

console.log('[ROUTES] Initializing analysis routes...');

// Load credentials from environment variable
let visionClient;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  visionClient = new ImageAnnotatorClient({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key
    },
    projectId: credentials.project_id
  });
} else {
  // Fallback to file if no env provided (useful for local dev)
  visionClient = new ImageAnnotatorClient({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, '../service-account.json'),
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
  });
}

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  console.log(`[ROUTES] Creating uploads directory at ${uploadDir}`);
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage
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
  const filetypes = /jpeg|jpg|png/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    console.log('[MULTER] File accepted');
    return cb(null, true);
  } else {
    console.log('[MULTER] File rejected - invalid type');
    cb(new Error('Error: Only JPEG, JPG, or PNG images are allowed!'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1
  }
});

// Error handling middleware for multer
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

// POST endpoint for image analysis
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

      // Validate the image file
      const imagePath = req.file.path;
      try {
        await sharp(imagePath).metadata();
      } catch (err) {
        console.error('Image validation error:', err);
        await fs.promises.unlink(imagePath).catch(console.error);
        return res.status(400).json({
          success: false,
          message: 'Invalid or corrupted image file'
        });
      }

      // Inject visionClient into controller if needed
      analysisController.analyzeMeal(req, res, next, visionClient);

    } catch (error) {
      console.error('Server error:', error);
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

// GET endpoint for testing
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
