const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const analysisController = require('../controllers/analysisController');

console.log('[ROUTES] Initializing analysis routes...');

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
    const filename = uniqueSuffix + path.extname(file.originalname);
    console.log(`[MULTER] Generated filename: ${filename}`);
    cb(null, filename);
  },
  fileFilter: (req, file, cb) => {
    console.log(`[MULTER] Filtering file: ${file.originalname}`);
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    
    if (mimetype && extname) {
      console.log('[MULTER] File accepted');
      return cb(null, true);
    } else {
      console.log('[MULTER] File rejected - invalid type');
      cb('Error: Images only (JPEG, JPG, PNG)!');
    }
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// POST endpoint for image analysis
router.post('/analyze', upload.single('image'), (req, res, next) => {
  console.log('[ROUTE] POST /api/analysis/analyze received');
  console.log(`[ROUTE] File info: ${req.file ? req.file.originalname : 'No file uploaded'}`);
  next();
}, analysisController.analyzeMeal);

// GET endpoint for testing (optional)
router.get('/test', (req, res) => {
  console.log('[ROUTE] GET /api/analysis/test received');
  res.json({ message: 'Analysis route working!' });
});

console.log('[ROUTES] Analysis routes initialized');
module.exports = router;