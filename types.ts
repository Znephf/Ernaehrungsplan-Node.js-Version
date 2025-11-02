// Basic types for plan settings
export type Diet = 'omnivore' | 'vegetarian' | 'vegan';
export type DietType = 'balanced' | 'low-carb' | 'keto' | 'high-protein' | 'mediterranean';
export type DishComplexity = 'simple' | 'advanced' | 'fancy';
export type MealCategory = 'breakfast' | 'lunch' | 'coffee' | 'dinner' | 'snack';

export const MealCategoryLabels: Record<MealCategory, string> = {
    breakfast: 'Frühstück',
    lunch: 'Mittagessen',
    coffee: 'Kaffee & Kuchen',
    dinner: 'Abendessen',
    snack: 'Snack'
};

export const MEAL_ORDER: MealCategory[] = ['breakfast', 'lunch', 'coffee', 'dinner', 'snack'];


// Main data structures
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
    dietaryPreference?: Diet;
    dietType?: DietType;
    dishComplexity?: DishComplexity;
    isGlutenFree?: boolean;
    isLactoseFree?: boolean;
    image_url?: string | null;
}

export type Recipes = Recipe[];

export interface Meal {
    mealType: MealCategory;
    recipe: Recipe;
}

export interface DayPlan {
    day: string;
    meals: Meal[];
    totalCalories: number;
}

export type WeeklyPlan = DayPlan[];

export interface ShoppingListItem {
    category: string;
    items: string[];
}

export type ShoppingList = ShoppingListItem[];

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
    mainMealFocus?: 'lunch' | 'dinner' | 'none';
    
    // New fields for recurring meals
    useSameBreakfast?: boolean;
    customBreakfastText?: string;
    useSameSnack?: boolean;
    customSnackText?: string;

    // Deprecated fields, kept for backward compatibility with old archive data
    breakfastOption?: 'beeren' | 'walnuss' | 'mandel' | 'custom';
    customBreakfast?: string;
}

export interface ArchiveEntry {
    id: number;
    name: string;
    createdAt: string;
    settings: PlanSettings;
    shareId: string | null;
    weeklyPlan: WeeklyPlan;
    recipes: Recipes;
    shoppingList: ShoppingList;
    imageUrls?: { [key: string]: string }; // Deprecated, but might exist on old data
}

export type PlanData = ArchiveEntry;

// UI-related types
export type View = 'plan' | 'shopping' | 'recipes' | 'archive' | 'planner' | 'recipe-archive';