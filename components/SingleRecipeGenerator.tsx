
import React, { useState } from 'react';
import { CloseIcon, LoadingSpinnerIcon, PlusIcon } from './IconComponents';
import * as apiService from '../services/apiService';
import type { Recipe } from '../types';

interface SingleRecipeGeneratorProps {
    onClose: () => void;
    onRecipeGenerated: (recipe: Recipe) => void;
}

const SingleRecipeGenerator: React.FC<SingleRecipeGeneratorProps> = ({ onClose, onRecipeGenerated }) => {
    const [prompt, setPrompt] = useState('');
    const [includedIngredients, setIncludedIngredients] = useState('');
    const [excludedIngredients, setExcludedIngredients] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim()) return;

        setIsLoading(true);
        setError(null);

        try {
            const recipe = await apiService.generateSingleRecipe({
                prompt,
                includedIngredients,
                excludedIngredients
            });
            onRecipeGenerated(recipe);
            onClose();
        } catch (err) {
            console.error(err);
            setError("Fehler bei der Generierung: " + (err as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col border dark:border-slate-700" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 rounded-t-lg">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">Neues Rezept generieren</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400">
                        <CloseIcon />
                    </button>
                </header>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded text-sm">
                            {error}
                        </div>
                    )}

                    <div>
                        <label htmlFor="prompt" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Worauf hast du Lust? <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            id="prompt"
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                            placeholder="z.B. Ein scharfes Thai-Curry mit Tofu..."
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-md focus:ring-emerald-500 focus:border-emerald-500 min-h-[80px]"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="included" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Muss enthalten (Optional)
                        </label>
                        <input
                            type="text"
                            id="included"
                            value={includedIngredients}
                            onChange={e => setIncludedIngredients(e.target.value)}
                            placeholder="z.B. Kichererbsen, Spinat"
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                        />
                    </div>

                    <div>
                        <label htmlFor="excluded" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Darf NICHT enthalten (Optional)
                        </label>
                        <input
                            type="text"
                            id="excluded"
                            value={excludedIngredients}
                            onChange={e => setExcludedIngredients(e.target.value)}
                            placeholder="z.B. Nüsse, Pilze"
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                        />
                    </div>

                    <div className="pt-4 flex justify-end">
                        <button
                            type="submit"
                            disabled={isLoading || !prompt.trim()}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
                        >
                            {isLoading ? <LoadingSpinnerIcon /> : <PlusIcon />}
                            {isLoading ? 'Generiere...' : 'Rezept erstellen'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SingleRecipeGenerator;
