const mongoose = require('mongoose');

const bmiSchema = new mongoose.Schema({
  height: {
    type: Number,
    required: true,
  },
  weight: {
    type: Number,
    required: true,
  },
  bmi: {
    type: Number,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  mealPlan: {
    type: Object,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Bmi', bmiSchema);