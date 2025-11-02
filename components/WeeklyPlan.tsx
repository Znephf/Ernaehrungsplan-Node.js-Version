import React from 'react';
import type { WeeklyPlan } from '../types';
import { MealCategoryLabels, MEAL_ORDER } from '../types';
import { FireIcon } from './IconComponents';

interface WeeklyPlanComponentProps {
  weeklyPlan: WeeklyPlan;
  planName: string;
  onSelectRecipe: (day: string) => void;
  isGlutenFree?: boolean;
  isLactoseFree?: boolean;
}

const WeeklyPlanComponent: React.FC<WeeklyPlanComponentProps> = ({ weeklyPlan, planName, onSelectRecipe, isGlutenFree, isLactoseFree }) => {
  return (
    <div className="space-y-8">
        <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold text-slate-700">{planName}</h2>
            {(isGlutenFree || isLactoseFree) && (
                <div className="flex justify-center flex-wrap gap-2">
                    {isGlutenFree && <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-3 py-1 rounded-full">Glutenfrei</span>}
                    {isLactoseFree && <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-3 py-1 rounded-full">Laktosefrei</span>}
                </div>
            )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(weeklyPlan || []).map((dayPlan) => {
                const sortedMeals = [...dayPlan.meals].sort((a, b) => MEAL_ORDER.indexOf(a.mealType) - MEAL_ORDER.indexOf(b.mealType));
                
                return (
                    <div key={dayPlan.day} className="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col transition-transform transform hover:scale-105">
                        <div className="bg-emerald-600 text-white p-4 flex justify-between items-center">
                            <h3 className="text-xl font-bold">{dayPlan.day}</h3>
                            <div className="flex items-center gap-1 text-sm bg-emerald-700 px-2 py-1 rounded-full">
                                <FireIcon />
                                <span>{dayPlan.totalCalories} kcal</span>
                            </div>
                        </div>
                        <div className="p-6 space-y-4 flex-grow">
                            {sortedMeals.length > 0 ? (
                                sortedMeals.map((meal, index) => (
                                    <div key={index}>
                                        <p className="font-semibold text-emerald-800 flex justify-between">
                                            <span>{MealCategoryLabels[meal.mealType]}:</span>
                                            <span className="font-normal text-slate-500">{meal.recipe.totalCalories} kcal</span>
                                        </p>
                                        <button onClick={() => onSelectRecipe(dayPlan.day)} className="text-left text-slate-600 hover:text-emerald-600 font-semibold transition-colors w-full">
                                            {meal.recipe.title}
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <p className="text-slate-500 text-center italic">Keine Mahlzeiten für diesen Tag geplant.</p>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    </div>
  );
};

export default WeeklyPlanComponent;
