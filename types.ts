export type MealCategory = 'breakfast' | 'lunch' | 'coffee' | 'dinner' | 'snack';

export const MealCategoryLabels: Record<MealCategory, string> = {
    breakfast: 'Frühstück',
    lunch: 'Mittagessen',
    coffee: 'Kaffee & Kuchen',
    dinner: 'Abendessen',
    snack: 'Snack'
};

export interface ShoppingListCategory {
  category: string;
  items: string[];
}

export type ShoppingList = ShoppingListCategory[];

// Ein einzelnes Gericht innerhalb eines Tagesplans
export interface Meal {
  mealType: MealCategory;
  recipe: Recipe;
}

// Repräsentiert alle Mahlzeiten für einen einzelnen Tag
export interface DailyPlan {
  day: string;
  meals: Meal[];
  totalCalories: number;
}

export type WeeklyPlan = DailyPlan[];

export interface Recipe {
  id: number;
  title: string;
  ingredients: string[];
  instructions: string[];
  totalCalories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  category: MealCategory;
  image_url?: string | null;
}

export type Recipes = Recipe[];

export type Diet = 'vegetarian' | 'vegan' | 'omnivore';
export type DietType = 'balanced' | 'low-carb' | 'keto' | 'high-protein' | 'mediterranean';
export type DishComplexity = 'simple' | 'advanced' | 'fancy';
export type View = 'shopping' | 'plan' | 'recipes' | 'archive' | 'planner';

export interface PlanSettings {
    persons: number;
    kcal: number;
    dietaryPreference: Diet;
    dietType: DietType;
    dishComplexity: DishComplexity;
    excludedIngredients: string;
    desiredIngredients: string;
    isGlutenFree: boolean;
    isLactoseFree: boolean;
    includedMeals: MealCategory[];
    // Fix: Added optional properties for backward compatibility with older archived data.
    breakfastOption?: string;
    customBreakfast?: string;
}

// Das Hauptobjekt, das einen vollständigen, zusammengestellten Plan darstellt
export interface PlanData {
    id: number;
    name: string;
    createdAt: string;
    shareId?: string | null;
    settings: PlanSettings;
    shoppingList: ShoppingList;
    weeklyPlan: WeeklyPlan; // Der neu strukturierte Wochenplan
    recipes: Recipes; // Eine flache Liste aller im Plan verwendeten Rezepte
}

// Alias für die Abwärtskompatibilität, da die App jetzt nur noch mit PlanData arbeitet
export type ArchiveEntry = PlanData;