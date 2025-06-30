const Analysis = require('../models/Analysis');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const vision = require('@google-cloud/vision');
const client = new vision.ImageAnnotatorClient();
require('dotenv').config();

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const FOOD_CATEGORIES = {
  'hyderabadi biryani': { type: 'asian', fallback: 'chicken biryani' },
  'biryani': { type: 'asian', fallback: 'chicken biryani' },
  'fried rice': { type: 'asian', fallback: 'special fried rice' },
  'spiced rice': { type: 'asian', fallback: 'spicy rice' },
  'baked beans': { type: 'starter', fallback: 'baked beans' },
  'white chocolate': { type: 'dessert', fallback: 'white chocolate bar' },
  'chocolate bar': { type: 'dessert', fallback: 'dark chocolate bar' },
  'chocolate': { type: 'dessert', fallback: 'dark chocolate' },
  'strawberry cake': { type: 'dessert', fallback: 'strawberry cake' },
  'pink cake': { type: 'dessert', fallback: 'strawberry cake' },
  'buttercream cake': { type: 'dessert', fallback: 'buttercream cake' },
  'birthday cake': { type: 'dessert', fallback: 'vanilla cake' },
  'doughnut': { type: 'bakery', fallback: 'glazed donut' },
  'donut': { type: 'bakery', fallback: 'glazed donut' },
  'cake': { type: 'dessert', fallback: 'chocolate cake' },
  'cookie': { type: 'bakery', fallback: 'chocolate chip cookie' },
  'kottu': { type: 'sri lankan', fallback: 'kottu roti' },
  'pizza': { type: 'italian', fallback: 'pepperoni pizza' },
  'burger': { type: 'fast food', fallback: 'cheeseburger' },
  'sushi': { type: 'japanese', fallback: 'salmon sushi roll' },
  'salad': { type: 'healthy', fallback: 'garden salad' },
  'pasta': { type: 'italian', fallback: 'spaghetti' },
  'rice': { type: 'asian', fallback: 'steamed rice' },
  'sandwich': { type: 'lunch', fallback: 'turkey sandwich' },
  'soup': { type: 'starter', fallback: 'chicken noodle soup' },
  'steak': { type: 'meat', fallback: 'grilled steak' },
  'chicken': { type: 'poultry', fallback: 'grilled chicken breast' },
  'bread': { type: 'bakery', fallback: 'white bread' },
  'bagel': { type: 'bakery', fallback: 'plain bagel' },
  'banana': { type: 'fruit', fallback: 'banana' },
  'biscuit': { type: 'bakery', fallback: 'biscuit' }
};

const FALLBACK_NUTRITION = {
  'chicken biryani': { calories: 420, protein: 20, carbs: 55, fat: 15 },
  'special fried rice': { calories: 380, protein: 15, carbs: 50, fat: 12 },
  'spicy rice': { calories: 350, protein: 12, carbs: 48, fat: 10 },
  'baked beans': { calories: 155, protein: 7, carbs: 27, fat: 1 },
  'pepperoni pizza': { calories: 285, protein: 12, carbs: 30, fat: 12 },
  'spaghetti': { calories: 220, protein: 8, carbs: 43, fat: 1 },
  'cheeseburger': { calories: 313, protein: 15, carbs: 31, fat: 14 },
  'salmon sushi roll': { calories: 184, protein: 7, carbs: 27, fat: 4 },
  'garden salad': { calories: 90, protein: 3, carbs: 10, fat: 5 },
  'glazed donut': { calories: 240, protein: 3, carbs: 31, fat: 12 },
  'white bread': { calories: 265, protein: 9, carbs: 49, fat: 3 },
  'plain bagel': { calories: 289, protein: 11, carbs: 56, fat: 2 },
  'dark chocolate': { calories: 170, protein: 2, carbs: 13, fat: 12 },
  'dark chocolate bar': { calories: 230, protein: 3, carbs: 18, fat: 15 },
  'white chocolate bar': { calories: 225, protein: 2, carbs: 15, fat: 17 },
  'kottu roti': { calories: 350, protein: 14, carbs: 40, fat: 18 },
  'steamed rice': { calories: 200, protein: 4, carbs: 45, fat: 0 },
  'chocolate cake': { calories: 350, protein: 5, carbs: 45, fat: 18 },
  'strawberry cake': { calories: 320, protein: 4, carbs: 42, fat: 15 },
  'buttercream cake': { calories: 360, protein: 5, carbs: 48, fat: 20 },
  'vanilla cake': { calories: 340, protein: 4, carbs: 44, fat: 16 },
  'banana': { calories: 105, protein: 1, carbs: 27, fat: 0 },
  'biscuit': { calories: 150, protein: 2, carbs: 20, fat: 7 },
  'chocolate chip cookie': { calories: 160, protein: 2, carbs: 22, fat: 8 },
  // Added alcoholic drink fallbacks:
  'beer': { calories: 153, protein: 1.6, carbs: 13, fat: 0 },
  'alcoholic drink': { calories: 153, protein: 1.6, carbs: 13, fat: 0 }
};

const IGNORE_LABELS = [
  'food', 'ingredient', 'dish', 'cuisine', 'junk food',
  'meal', 'superfood', 'fruit', 'produce', 'legume', 'bean',
  'finger food'
];

exports.analyzeMeal = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image uploaded' });
    }

    console.log(`Processing file: ${req.file.path}`);
    console.log(`File exists: ${fs.existsSync(req.file.path)}`);

    // Try text detection first
    let detections = [];
    try {
      const [textResult] = await client.textDetection(req.file.path);
      const textAnnotations = textResult.textAnnotations || [];
      const rawText = textAnnotations.length ? textAnnotations[0].description.toLowerCase() : '';
      console.log('Raw text detected:', rawText);

      const matchedFoodItems = [];
      const sortedFoodKeys = Object.keys(FOOD_CATEGORIES).sort((a, b) => b.length - a.length);

      for (const foodKey of sortedFoodKeys) {
        if (rawText.includes(foodKey)) {
          matchedFoodItems.push(FOOD_CATEGORIES[foodKey].fallback);
        }
      }

      if (matchedFoodItems.length > 0) {
        detections = matchedFoodItems;
      } else {
        detections = [];
      }
    } catch (textError) {
      console.log('Text detection failed, trying label detection:', textError);
      detections = [];
    }

    // If no matched food from text, try label detection
    if (detections.length === 0) {
      try {
        const [labelResult] = await client.labelDetection(req.file.path);
        const labels = labelResult.labelAnnotations.map(label => label.description.toLowerCase());
        console.log('Label detections:', labels);

        // Compose combined labels for better matching
        const combinedLabels = [];
        if (labels.includes('cake') && labels.includes('pink')) combinedLabels.push('pink cake');
        if (labels.includes('cake') && labels.includes('buttercream')) combinedLabels.push('buttercream cake');
        if (labels.includes('cake') && labels.includes('strawberry')) combinedLabels.push('strawberry cake');
        if (labels.includes('cake') && labels.includes('birthday')) combinedLabels.push('birthday cake');
        if (labels.includes('beans') && labels.includes('baked')) combinedLabels.push('baked beans');

        const sortedFoodKeys = Object.keys(FOOD_CATEGORIES).sort((a, b) => b.length - a.length);
        let foodItems = [];

        for (const combo of combinedLabels) {
          if (FOOD_CATEGORIES[combo]) {
            foodItems.push(FOOD_CATEGORIES[combo].fallback);
          }
        }

        for (const label of labels) {
          const matchedFood = sortedFoodKeys.find(food =>
            label.includes(food)
          );
          if (matchedFood) {
            foodItems.push(FOOD_CATEGORIES[matchedFood].fallback);
          }
        }

        foodItems = [...new Set(foodItems)].slice(0, 5);

        if (foodItems.length === 0 && labels.length > 0) {
          // Prioritize "beer" if detected over generic fallback
          let fallbackLabel = labels.find(l => l === 'beer');
          if (!fallbackLabel) {
            fallbackLabel = labels.find(l => !IGNORE_LABELS.includes(l));
          }
          if (fallbackLabel) {
            console.log('Using fallback food item from labels:', fallbackLabel);
            foodItems = [fallbackLabel];
          }
        }

        detections = foodItems;
      } catch (labelError) {
        console.error('Label detection failed:', labelError);
      }
    }

    // Fetch nutrition data for detected foods
    const nutritionData = await Promise.all(
      detections.map(async (item) => {
        try {
          if (process.env.NUTRITIONIX_APP_ID && process.env.NUTRITIONIX_APP_KEY) {
            const response = await axios.post(
              'https://trackapi.nutritionix.com/v2/natural/nutrients',
              { query: item },
              {
                headers: {
                  'x-app-id': process.env.NUTRITIONIX_APP_ID,
                  'x-app-key': process.env.NUTRITIONIX_APP_KEY,
                  'Content-Type': 'application/json',
                },
              }
            );

            if (response.data?.foods?.length > 0) {
              const food = response.data.foods[0];
              return {
                foodItem: item,
                nutrients: {
                  calories: food.nf_calories || 0,
                  protein: food.nf_protein || 0,
                  carbs: food.nf_total_carbohydrate || 0,
                  fat: food.nf_total_fat || 0,
                },
                source: 'api',
              };
            }
          }
        } catch (error) {
          console.log(`Nutritionix API failed for "${item}", using fallback.`);
        }

        // Use fallback nutrition data if API fails
        const fallbackKey = Object.keys(FALLBACK_NUTRITION).find(key =>
          key.toLowerCase() === item.toLowerCase() ||
          item.toLowerCase().startsWith(key.toLowerCase())
        );

        if (fallbackKey) {
          const fallback = FALLBACK_NUTRITION[fallbackKey];
          return {
            foodItem: item,
            nutrients: {
              calories: fallback.calories,
              protein: fallback.protein,
              carbs: fallback.carbs,
              fat: fallback.fat,
            },
            source: 'fallback',
          };
        }

        // No data available fallback
        return {
          foodItem: item,
          nutrients: {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
          },
          source: 'none',
        };
      })
    );

    console.log('Nutrition data:', nutritionData);

    // Compose image URL
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

    // Save analysis record
    const analysis = new Analysis({
      imageUrl,
      foodItems: detections,
      nutritionData
    });
    await analysis.save();

    // Calculate total nutrition summary
    const totalCalories = nutritionData.reduce((sum, n) => sum + (n.nutrients.calories || 0), 0);
    const totalProtein = nutritionData.reduce((sum, n) => sum + (n.nutrients.protein || 0), 0);
    const totalCarbs = nutritionData.reduce((sum, n) => sum + (n.nutrients.carbs || 0), 0);
    const totalFat = nutritionData.reduce((sum, n) => sum + (n.nutrients.fat || 0), 0);

    return res.json({
      success: true,
      imageUrl,
      foodItems: detections,
      nutritionData,
      nutritionSummary: {
        totalCalories,
        totalProtein,
        totalCarbs,
        totalFat,
      },
    });

  } catch (error) {
    console.error('Error analyzing meal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze meal',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
