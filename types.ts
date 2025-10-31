export interface ShoppingListCategory {
  category: string;
  items: string[];
}

export type ShoppingList = ShoppingListCategory[];

export interface DailyPlan {
  day: string;
  breakfast: string;
  breakfastCalories: number;
  dinner: string;
  dinnerCalories: number;
}

export type WeeklyPlan = DailyPlan[];

export interface Recipe {
  day: string;
  title: string;
  ingredients: string[];
  instructions: string[];
  totalCalories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

export type Recipes = Recipe[];

export type Diet = 'vegetarian' | 'vegan' | 'omnivore';
export type BreakfastOption = 'quark' | 'muesli' | 'custom';
export type DietType = 'balanced' | 'low-carb' | 'keto' | 'high-protein' | 'mediterranean';
export type View = 'shopping' | 'plan' | 'recipes' | 'archive';

export interface PlanSettings {
    persons: number;
    kcal: number;
    dietaryPreference: Diet;
    dietType: DietType;
    excludedIngredients: string;
    desiredIngredients: string;
    breakfastOption: BreakfastOption;
    customBreakfast: string;
}

export interface PlanData {
    name: string;
    shoppingList: ShoppingList;
    weeklyPlan: WeeklyPlan;
    recipes: Recipes;
    imageUrls?: { [key: string]: string };
}

export interface ArchiveEntry extends PlanSettings, PlanData {
  id: string;
  createdAt: string;
}