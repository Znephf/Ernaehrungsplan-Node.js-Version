import React from 'react';
import type { Recipe } from '../types';
import { MealCategoryLabels } from '../types';
import { PrintIcon, CloseIcon, ProteinIcon, CarbsIcon, FatIcon, FireIcon } from './IconComponents';
import GeneratedRecipeImage from './GeneratedRecipeImage';

interface RecipeDetailModalProps {
    recipe: Recipe;
    onClose: () => void;
    imageUrl: string | null;
    isLoading: boolean;
    error: string | null;
    onGenerate: (recipe: Recipe) => void;
}

const RecipeDetailModal: React.FC<RecipeDetailModalProps> = ({ recipe, onClose, imageUrl, isLoading, error, onGenerate }) => {
    
    const handlePrint = () => {
        const printContent = document.getElementById('printable-recipe-area');
        if (printContent) {
            const printWindow = window.open('', '_blank', 'height=800,width=800');
            if (printWindow) {
                printWindow.document.write('<html><head><title>Rezept drucken</title>');
                printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>');
                printWindow.document.write('<style>body { -webkit-print-color-adjust: exact; color-adjust: exact; } @page { size: auto; margin: 20mm; }</style>');
                printWindow.document.write('</head><body class="font-sans">');
                printWindow.document.write(printContent.innerHTML);
                printWindow.document.write('</body></html>');
                printWindow.document.close();
                printWindow.focus();
                setTimeout(() => {
                    printWindow.print();
                    printWindow.close();
                }, 250);
            }
        }
    };
    
    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" 
            onClick={onClose}
            role="dialog" 
            aria-modal="true" 
            aria-labelledby="recipe-modal-title"
        >
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b flex justify-between items-center flex-shrink-0">
                    <h2 className="text-xl font-bold text-slate-800" id="recipe-modal-title">{recipe.title}</h2>
                    <div className="flex items-center gap-2">
                        <button onClick={handlePrint} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-md transition-colors"><PrintIcon /> Drucken</button>
                        <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Schließen"><CloseIcon /></button>
                    </div>
                </header>
                <main className="overflow-y-auto">
                    <div id="printable-recipe-area">
                        <GeneratedRecipeImage
                            recipeTitle={recipe.title}
                            imageUrl={imageUrl || recipe.image_url || null}
                            isLoading={isLoading}
                            error={error}
                            onGenerate={() => onGenerate(recipe)}
                        />
                        <div className="p-6">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">{MealCategoryLabels[recipe.category]}</span>
                                <div className="flex items-center gap-1 text-sm text-slate-600 bg-slate-100 px-3 py-1 rounded-full"><FireIcon /><span>ca. {recipe.totalCalories} kcal</span></div>
                            </div>

                            {recipe.protein !== undefined && (
                                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-slate-600 p-3 bg-slate-50 rounded-lg">
                                    <span className="flex items-center gap-1.5 text-sm"><ProteinIcon /><div><span className="font-bold">{recipe.protein}g</span><span className="text-slate-500 text-xs block">Protein</span></div></span>
                                    <span className="flex items-center gap-1.5 text-sm"><CarbsIcon /><div><span className="font-bold">{recipe.carbs}g</span><span className="text-slate-500 text-xs block">Kohlenh.</span></div></span>
                                    <span className="flex items-center gap-1.5 text-sm"><FatIcon /><div><span className="font-bold">{recipe.fat}g</span><span className="text-slate-500 text-xs block">Fett</span></div></span>
                                </div>
                            )}

                            <div className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-x-8 gap-y-6">
                                <div className="md:col-span-2">
                                    <h4 className="text-lg font-semibold text-slate-700 border-b-2 border-slate-200 pb-2 mb-3">Zutaten:</h4>
                                    <ul className="space-y-2 list-disc list-inside text-slate-600">{(recipe.ingredients || []).map((ingredient, index) => <li key={index}>{ingredient}</li>)}</ul>
                                </div>
                                <div className="md:col-span-3">
                                    <h4 className="text-lg font-semibold text-slate-700 border-b-2 border-slate-200 pb-2 mb-3">Anleitung:</h4>
                                    <ol className="space-y-3 list-decimal list-inside text-slate-600">{(recipe.instructions || []).map((step, index) => <li key={index}>{step}</li>)}</ol>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default RecipeDetailModal;
