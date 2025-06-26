const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema({
  imageUrl: {
    type: String,
    required: true,
  },
  foodItems: {
    type: [String],
    required: true,
  },
  nutritionData: {
    type: Object,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Analysis', analysisSchema);