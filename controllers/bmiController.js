const Bmi = require('../models/Bmi');

exports.calculateBmi = async (req, res) => {
  try {
    const { height, weight, unit = 'metric' } = req.body;
    
    if (!height || !weight) {
      return res.status(400).json({ error: 'Height and weight are required' });
    }

    let bmi;
    let heightInMeters;

    if (unit === 'metric') {
      heightInMeters = height / 100; // convert cm to meters
      bmi = weight / (heightInMeters * heightInMeters);
    } else {
      // imperial (inches and pounds)
      bmi = (weight / (height * height)) * 703;
    }

    bmi = parseFloat(bmi.toFixed(1));

    // Determine BMI category
    let category;
    if (bmi < 18.5) category = 'Underweight';
    else if (bmi >= 18.5 && bmi < 25) category = 'Normal weight';
    else if (bmi >= 25 && bmi < 30) category = 'Overweight';
    else category = 'Obese';

    // Generate meal plan based on BMI category
    const mealPlan = generateMealPlan(category);

    // Save to database
    const bmiRecord = new Bmi({
      height,
      weight,
      bmi,
      category,
      mealPlan
    });
    await bmiRecord.save();

    res.json({
      success: true,
      bmi,
      category,
      mealPlan
    });
  } catch (error) {
    console.error('Error calculating BMI:', error);
    res.status(500).json({ error: 'Failed to calculate BMI' });
  }
};

function generateMealPlan(category) {
  // Simplified meal plans - in a real app you'd want more comprehensive plans
  const plans = {
    'Underweight': {
      description: 'High-calorie nutrient-dense meals to support healthy weight gain',
      breakfast: 'Whole grain toast with avocado and eggs, whole milk',
      lunch: 'Grilled chicken with quinoa and roasted vegetables, olive oil dressing',
      dinner: 'Salmon with sweet potatoes and steamed broccoli, nuts for snack',
      snacks: 'Greek yogurt with honey and nuts, cheese and crackers'
    },
    'Normal weight': {
      description: 'Balanced meals to maintain healthy weight',
      breakfast: 'Oatmeal with berries and nuts',
      lunch: 'Grilled fish with brown rice and mixed vegetables',
      dinner: 'Lean protein with whole grains and salad',
      snacks: 'Fruits, vegetables with hummus'
    },
    'Overweight': {
      description: 'Lower-calorie meals with portion control for healthy weight loss',
      breakfast: 'Greek yogurt with fresh fruit',
      lunch: 'Grilled chicken salad with vinaigrette',
      dinner: 'Vegetable stir-fry with lean protein',
      snacks: 'Vegetable sticks, small handful of nuts'
    },
    'Obese': {
      description: 'Structured meal plan for significant weight loss',
      breakfast: 'Protein shake with spinach and berries',
      lunch: 'Lean protein with non-starchy vegetables',
      dinner: 'Broth-based soup with lean protein and vegetables',
      snacks: 'Celery sticks, small portions of low-fat cheese'
    }
  };

  return plans[category] || plans['Normal weight'];
}