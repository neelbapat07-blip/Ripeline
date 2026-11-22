/*
  Ripeline data
  -------------
  This file holds the LISTS the app uses (recipes are in js/recipes.js):
    FOOD_CATALOG – foods you can pick from on the Add Food screen

  These are only CHOICES. Your actual food is saved separately in your own
  browser (see js/storage.js), and every new user starts with an empty fridge.

  To add a new food choice, copy one line in FOOD_CATALOG and change it.
    name     – what it's called
    emoji    – the little picture shown for this food
    category – which group it belongs to (must be one of CATEGORIES)
    storage  – where it usually goes (must be one of STORAGE_PLACES)
    days     – roughly how many days it stays good there (used to suggest an expiration date)
*/

const CATEGORIES = [
  "Meats", "Seafood", "Dairy", "Fruits", "Vegetables",
  "Grains & Bread", "Drinks", "Sauces & Condiments", "Leftovers", "Other",
];

const STORAGE_PLACES = ["Fridge", "Freezer", "Pantry", "Counter"];

const UNITS = ["pcs", "lb", "oz", "g", "kg", "cup", "pack", "bottle", "carton", "can", "jar", "bag", "gallon", "dozen"];

const FOOD_CATALOG = [
  // ---- Meats ----
  { name: "Chicken breast",   emoji: "🍗", category: "Meats", storage: "Fridge",  days: 2 },
  { name: "Chicken thighs",   emoji: "🍗", category: "Meats", storage: "Fridge",  days: 2 },
  { name: "Whole chicken",    emoji: "🐔", category: "Meats", storage: "Fridge",  days: 2 },
  { name: "Ground beef",      emoji: "🥩", category: "Meats", storage: "Fridge",  days: 2 },
  { name: "Steak",            emoji: "🥩", category: "Meats", storage: "Fridge",  days: 4 },
  { name: "Pork chops",       emoji: "🥩", category: "Meats", storage: "Fridge",  days: 4 },
  { name: "Ground turkey",    emoji: "🦃", category: "Meats", storage: "Fridge",  days: 2 },
  { name: "Turkey slices",    emoji: "🥪", category: "Meats", storage: "Fridge",  days: 5 },
  { name: "Ham",              emoji: "🍖", category: "Meats", storage: "Fridge",  days: 5 },
  { name: "Bacon",            emoji: "🥓", category: "Meats", storage: "Fridge",  days: 7 },
  { name: "Sausages",         emoji: "🌭", category: "Meats", storage: "Fridge",  days: 3 },
  { name: "Hot dogs",         emoji: "🌭", category: "Meats", storage: "Fridge",  days: 14 },
  { name: "Lamb",             emoji: "🍖", category: "Meats", storage: "Fridge",  days: 4 },
  { name: "Frozen chicken nuggets", emoji: "🍗", category: "Meats", storage: "Freezer", days: 120 },

  // ---- Seafood ----
  { name: "Salmon",           emoji: "🐟", category: "Seafood", storage: "Fridge",  days: 2 },
  { name: "Tuna steak",       emoji: "🐟", category: "Seafood", storage: "Fridge",  days: 2 },
  { name: "Shrimp",           emoji: "🦐", category: "Seafood", storage: "Fridge",  days: 2 },
  { name: "Cod",              emoji: "🐟", category: "Seafood", storage: "Fridge",  days: 2 },
  { name: "Frozen shrimp",    emoji: "🦐", category: "Seafood", storage: "Freezer", days: 180 },
  { name: "Frozen fish fillets", emoji: "🐟", category: "Seafood", storage: "Freezer", days: 180 },
  { name: "Canned tuna",      emoji: "🥫", category: "Seafood", storage: "Pantry",  days: 730 },

  // ---- Dairy & eggs ----
  { name: "Milk",             emoji: "🥛", category: "Dairy", storage: "Fridge", days: 7 },
  { name: "Cheese",           emoji: "🧀", category: "Dairy", storage: "Fridge", days: 21 },
  { name: "Cheddar cheese",   emoji: "🧀", category: "Dairy", storage: "Fridge", days: 21 },
  { name: "Mozzarella",       emoji: "🧀", category: "Dairy", storage: "Fridge", days: 7 },
  { name: "Parmesan",         emoji: "🧀", category: "Dairy", storage: "Fridge", days: 30 },
  { name: "Cream cheese",     emoji: "🧀", category: "Dairy", storage: "Fridge", days: 14 },
  { name: "Yogurt",           emoji: "🥣", category: "Dairy", storage: "Fridge", days: 10 },
  { name: "Greek yogurt",     emoji: "🥣", category: "Dairy", storage: "Fridge", days: 10 },
  { name: "Butter",           emoji: "🧈", category: "Dairy", storage: "Fridge", days: 30 },
  { name: "Eggs",             emoji: "🥚", category: "Dairy", storage: "Fridge", days: 21 },
  { name: "Heavy cream",      emoji: "🥛", category: "Dairy", storage: "Fridge", days: 10 },
  { name: "Sour cream",       emoji: "🥣", category: "Dairy", storage: "Fridge", days: 14 },
  { name: "Cottage cheese",   emoji: "🥣", category: "Dairy", storage: "Fridge", days: 7 },
  { name: "Almond milk",      emoji: "🥛", category: "Dairy", storage: "Fridge", days: 7 },
  { name: "Oat milk",         emoji: "🥛", category: "Dairy", storage: "Fridge", days: 7 },
  { name: "Ice cream",        emoji: "🍨", category: "Dairy", storage: "Freezer", days: 60 },

  // ---- Fruits ----
  { name: "Apples",           emoji: "🍎", category: "Fruits", storage: "Fridge",  days: 30 },
  { name: "Bananas",          emoji: "🍌", category: "Fruits", storage: "Counter", days: 5 },
  { name: "Oranges",          emoji: "🍊", category: "Fruits", storage: "Fridge",  days: 21 },
  { name: "Lemons",           emoji: "🍋", category: "Fruits", storage: "Fridge",  days: 21 },
  { name: "Limes",            emoji: "🍋", category: "Fruits", storage: "Fridge",  days: 21 },
  { name: "Strawberries",     emoji: "🍓", category: "Fruits", storage: "Fridge",  days: 4 },
  { name: "Blueberries",      emoji: "🫐", category: "Fruits", storage: "Fridge",  days: 7 },
  { name: "Raspberries",      emoji: "🫐", category: "Fruits", storage: "Fridge",  days: 3 },
  { name: "Grapes",           emoji: "🍇", category: "Fruits", storage: "Fridge",  days: 10 },
  { name: "Watermelon",       emoji: "🍉", category: "Fruits", storage: "Fridge",  days: 5 },
  { name: "Pineapple",        emoji: "🍍", category: "Fruits", storage: "Counter", days: 3 },
  { name: "Mango",            emoji: "🥭", category: "Fruits", storage: "Counter", days: 5 },
  { name: "Peaches",          emoji: "🍑", category: "Fruits", storage: "Counter", days: 4 },
  { name: "Pears",            emoji: "🍐", category: "Fruits", storage: "Counter", days: 5 },
  { name: "Cherries",         emoji: "🍒", category: "Fruits", storage: "Fridge",  days: 7 },
  { name: "Kiwi",             emoji: "🥝", category: "Fruits", storage: "Fridge",  days: 14 },
  { name: "Avocado",          emoji: "🥑", category: "Fruits", storage: "Counter", days: 4 },
  { name: "Frozen berries",   emoji: "🫐", category: "Fruits", storage: "Freezer", days: 240 },

  // ---- Vegetables ----
  { name: "Broccoli",         emoji: "🥦", category: "Vegetables", storage: "Fridge",  days: 5 },
  { name: "Carrots",          emoji: "🥕", category: "Vegetables", storage: "Fridge",  days: 21 },
  { name: "Lettuce",          emoji: "🥬", category: "Vegetables", storage: "Fridge",  days: 7 },
  { name: "Spinach",          emoji: "🥬", category: "Vegetables", storage: "Fridge",  days: 5 },
  { name: "Kale",             emoji: "🥬", category: "Vegetables", storage: "Fridge",  days: 7 },
  { name: "Tomatoes",         emoji: "🍅", category: "Vegetables", storage: "Counter", days: 5 },
  { name: "Cucumber",         emoji: "🥒", category: "Vegetables", storage: "Fridge",  days: 7 },
  { name: "Bell peppers",     emoji: "🫑", category: "Vegetables", storage: "Fridge",  days: 10 },
  { name: "Onions",           emoji: "🧅", category: "Vegetables", storage: "Pantry",  days: 30 },
  { name: "Garlic",           emoji: "🧄", category: "Vegetables", storage: "Pantry",  days: 60 },
  { name: "Potatoes",         emoji: "🥔", category: "Vegetables", storage: "Pantry",  days: 30 },
  { name: "Sweet potatoes",   emoji: "🍠", category: "Vegetables", storage: "Pantry",  days: 21 },
  { name: "Mushrooms",        emoji: "🍄", category: "Vegetables", storage: "Fridge",  days: 5 },
  { name: "Zucchini",         emoji: "🥒", category: "Vegetables", storage: "Fridge",  days: 7 },
  { name: "Cauliflower",      emoji: "🥦", category: "Vegetables", storage: "Fridge",  days: 7 },
  { name: "Celery",           emoji: "🥬", category: "Vegetables", storage: "Fridge",  days: 14 },
  { name: "Corn",             emoji: "🌽", category: "Vegetables", storage: "Fridge",  days: 3 },
  { name: "Green beans",      emoji: "🫛", category: "Vegetables", storage: "Fridge",  days: 7 },
  { name: "Peas",             emoji: "🫛", category: "Vegetables", storage: "Fridge",  days: 5 },
  { name: "Cabbage",          emoji: "🥬", category: "Vegetables", storage: "Fridge",  days: 30 },
  { name: "Asparagus",        emoji: "🥦", category: "Vegetables", storage: "Fridge",  days: 4 },
  { name: "Eggplant",         emoji: "🍆", category: "Vegetables", storage: "Fridge",  days: 7 },
  { name: "Fresh herbs",      emoji: "🌿", category: "Vegetables", storage: "Fridge",  days: 7 },
  { name: "Frozen vegetables", emoji: "🥦", category: "Vegetables", storage: "Freezer", days: 240 },

  // ---- Grains & bread ----
  { name: "Bread",            emoji: "🍞", category: "Grains & Bread", storage: "Counter", days: 5 },
  { name: "Bagels",           emoji: "🥯", category: "Grains & Bread", storage: "Counter", days: 5 },
  { name: "Tortillas",        emoji: "🫓", category: "Grains & Bread", storage: "Fridge",  days: 21 },
  { name: "Pasta",            emoji: "🍝", category: "Grains & Bread", storage: "Pantry",  days: 365 },
  { name: "Rice",             emoji: "🍚", category: "Grains & Bread", storage: "Pantry",  days: 365 },
  { name: "Cooked rice",      emoji: "🍚", category: "Grains & Bread", storage: "Fridge",  days: 4 },
  { name: "Oats",             emoji: "🥣", category: "Grains & Bread", storage: "Pantry",  days: 365 },
  { name: "Cereal",           emoji: "🥣", category: "Grains & Bread", storage: "Pantry",  days: 180 },
  { name: "Flour",            emoji: "🌾", category: "Grains & Bread", storage: "Pantry",  days: 240 },
  { name: "Croissants",       emoji: "🥐", category: "Grains & Bread", storage: "Counter", days: 2 },

  // ---- Drinks ----
  { name: "Orange juice",     emoji: "🧃", category: "Drinks", storage: "Fridge", days: 7 },
  { name: "Apple juice",      emoji: "🧃", category: "Drinks", storage: "Fridge", days: 7 },
  { name: "Soda",             emoji: "🥤", category: "Drinks", storage: "Fridge", days: 180 },
  { name: "Sparkling water",  emoji: "🫧", category: "Drinks", storage: "Fridge", days: 365 },
  { name: "Iced tea",         emoji: "🧋", category: "Drinks", storage: "Fridge", days: 7 },
  { name: "Cold brew coffee", emoji: "☕", category: "Drinks", storage: "Fridge", days: 10 },
  { name: "Smoothie",         emoji: "🥤", category: "Drinks", storage: "Fridge", days: 2 },

  // ---- Sauces & condiments ----
  { name: "Ketchup",          emoji: "🍅", category: "Sauces & Condiments", storage: "Fridge", days: 180 },
  { name: "Mustard",          emoji: "🌭", category: "Sauces & Condiments", storage: "Fridge", days: 365 },
  { name: "Mayonnaise",       emoji: "🥚", category: "Sauces & Condiments", storage: "Fridge", days: 60 },
  { name: "Salsa",            emoji: "🌶️", category: "Sauces & Condiments", storage: "Fridge", days: 14 },
  { name: "Hummus",           emoji: "🫘", category: "Sauces & Condiments", storage: "Fridge", days: 7 },
  { name: "Pasta sauce",      emoji: "🍅", category: "Sauces & Condiments", storage: "Fridge", days: 5 },
  { name: "Soy sauce",        emoji: "🍶", category: "Sauces & Condiments", storage: "Pantry", days: 730 },
  { name: "Salad dressing",   emoji: "🥗", category: "Sauces & Condiments", storage: "Fridge", days: 60 },
  { name: "Peanut butter",    emoji: "🥜", category: "Sauces & Condiments", storage: "Pantry", days: 90 },
  { name: "Jam",              emoji: "🍓", category: "Sauces & Condiments", storage: "Fridge", days: 180 },
  { name: "Hot sauce",        emoji: "🌶️", category: "Sauces & Condiments", storage: "Pantry", days: 365 },
  { name: "Pesto",            emoji: "🌿", category: "Sauces & Condiments", storage: "Fridge", days: 7 },

  // ---- Leftovers ----
  { name: "Leftover pizza",   emoji: "🍕", category: "Leftovers", storage: "Fridge", days: 4 },
  { name: "Leftover pasta",   emoji: "🍝", category: "Leftovers", storage: "Fridge", days: 4 },
  { name: "Leftover soup",    emoji: "🍲", category: "Leftovers", storage: "Fridge", days: 4 },
  { name: "Leftover curry",   emoji: "🍛", category: "Leftovers", storage: "Fridge", days: 4 },
  { name: "Takeout",          emoji: "🥡", category: "Leftovers", storage: "Fridge", days: 3 },
  { name: "Meal prep",        emoji: "🍱", category: "Leftovers", storage: "Fridge", days: 4 },

  // ---- Other ----
  { name: "Tofu",             emoji: "🧊", category: "Other", storage: "Fridge",  days: 5 },
  { name: "Chocolate",        emoji: "🍫", category: "Other", storage: "Pantry",  days: 180 },
  { name: "Cookies",          emoji: "🍪", category: "Other", storage: "Pantry",  days: 30 },
  { name: "Chips",            emoji: "🥔", category: "Other", storage: "Pantry",  days: 60 },
  { name: "Nuts",             emoji: "🥜", category: "Other", storage: "Pantry",  days: 180 },
  { name: "Honey",            emoji: "🍯", category: "Other", storage: "Pantry",  days: 730 },
  { name: "Frozen pizza",     emoji: "🍕", category: "Other", storage: "Freezer", days: 180 },
  { name: "Frozen waffles",   emoji: "🧇", category: "Other", storage: "Freezer", days: 180 },
  { name: "Granola",          emoji: "🥣", category: "Grains & Bread", storage: "Pantry", days: 90 },
  { name: "Black beans",      emoji: "🫘", category: "Other", storage: "Pantry", days: 730 },
  { name: "Chickpeas",        emoji: "🫘", category: "Other", storage: "Pantry", days: 730 },
  { name: "Coconut milk",     emoji: "🥥", category: "Other", storage: "Pantry", days: 365 },
  { name: "Chicken broth",    emoji: "🍲", category: "Other", storage: "Pantry", days: 365 },
  { name: "Canned tomatoes",  emoji: "🥫", category: "Vegetables", storage: "Pantry", days: 730 },
  { name: "Curry powder",     emoji: "🍛", category: "Sauces & Condiments", storage: "Pantry", days: 365 },
  { name: "Taco seasoning",   emoji: "🌮", category: "Sauces & Condiments", storage: "Pantry", days: 365 },
  { name: "Cinnamon",         emoji: "🟤", category: "Sauces & Condiments", storage: "Pantry", days: 730 },
  { name: "Feta",             emoji: "🧀", category: "Dairy", storage: "Fridge", days: 14 },
  { name: "Sugar",            emoji: "🍬", category: "Other", storage: "Pantry", days: 730 },
  { name: "Baking powder",    emoji: "🧂", category: "Other", storage: "Pantry", days: 365 },
  { name: "Cocoa powder",     emoji: "🍫", category: "Other", storage: "Pantry", days: 730 },
  { name: "Breadcrumbs",      emoji: "🍞", category: "Grains & Bread", storage: "Pantry", days: 180 },
  { name: "Burger buns",      emoji: "🍔", category: "Grains & Bread", storage: "Counter", days: 5 },
  { name: "Pita bread",       emoji: "🫓", category: "Grains & Bread", storage: "Counter", days: 5 },
  { name: "Instant noodles",  emoji: "🍜", category: "Grains & Bread", storage: "Pantry", days: 365 },
  { name: "Rice noodles",     emoji: "🍜", category: "Grains & Bread", storage: "Pantry", days: 365 },
  { name: "Tortilla chips",   emoji: "🌽", category: "Other", storage: "Pantry", days: 60 },
  { name: "Lentils",          emoji: "🫘", category: "Other", storage: "Pantry", days: 730 },
  { name: "Kidney beans",     emoji: "🫘", category: "Other", storage: "Pantry", days: 730 },
  { name: "Vegetable broth",  emoji: "🍲", category: "Other", storage: "Pantry", days: 365 },
  { name: "Green onions",     emoji: "🧅", category: "Vegetables", storage: "Fridge", days: 7 },
  { name: "Ginger",           emoji: "🫚", category: "Vegetables", storage: "Fridge", days: 21 },
  { name: "Chili powder",     emoji: "🌶️", category: "Sauces & Condiments", storage: "Pantry", days: 365 },
  { name: "Cajun seasoning",  emoji: "🌶️", category: "Sauces & Condiments", storage: "Pantry", days: 365 },
  { name: "BBQ sauce",        emoji: "🍖", category: "Sauces & Condiments", storage: "Fridge", days: 120 },
  { name: "Teriyaki sauce",   emoji: "🍶", category: "Sauces & Condiments", storage: "Fridge", days: 180 },
  { name: "Enchilada sauce",  emoji: "🌶️", category: "Sauces & Condiments", storage: "Pantry", days: 365 },
];
