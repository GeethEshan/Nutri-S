require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const analysisRoutes = require('./routes/analysisRoutes');
const bmiRoutes = require('./routes/bmiRoutes');
const path = require('path');
const fs = require('fs');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Serve static files from uploads directory
app.use('/uploads', express.static(uploadDir));

// Routes
app.use('/api/analysis', analysisRoutes);
app.use('/api/bmi', bmiRoutes);

// Simple route for testing
app.get('/', (req, res) => {
  res.send('NutriScan API is running...');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Uploads directory: ${uploadDir}`);
});