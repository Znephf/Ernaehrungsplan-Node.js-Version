

import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import type { Recipes, Recipe } from '../types';
import { FireIcon, PrintIcon, LoadingSpinnerIcon, ProteinIcon, CarbsIcon, FatIcon } from './IconComponents';
import GeneratedRecipeImage from './GeneratedRecipeImage';

interface RecipesComponentProps {
  recipes: Recipes;
  imageUrls: { [key: string]: string };
  loadingImages: Set<string>;
  imageErrors: { [key: string]: string | null };
  generateImage: (recipe: Recipe) => Promise<void>;
  // FIX: The return type of `generateMissingImages` is updated to reflect that it returns a promise resolving to a dictionary of image URLs, aligning it with the `useImageGenerator` hook's implementation.
  generateMissingImages: (recipes: Recipe[], onProgress?: (status: string) => void) => Promise<{ [key: string]: string }>;
}

const RecipesComponent: React.FC<RecipesComponentProps> = ({ recipes, imageUrls, loadingImages, imageErrors, generateImage, generateMissingImages }) => {
  const [isCreatingPdf, setIsCreatingPdf] = useState(false);
  const [pdfStatus, setPdfStatus] = useState('');
  const [isPdfGenerationQueued, setIsPdfGenerationQueued] = useState(false);

  const handleCreatePdf = async () => {
    setIsCreatingPdf(true);
    setPdfStatus('Prüfe Bilder...');
    
    await generateMissingImages(recipes, setPdfStatus);
    
    setIsPdfGenerationQueued(true);
  };

  useEffect(() => {
    if (!isPdfGenerationQueued) return;

    const createPdfFromElements = async () => {
      setPdfStatus('Erstelle PDF-Seiten...');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const recipeElements = Array.from(document.querySelectorAll('.recipe-card-for-pdf'));
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentW = pageW - margin * 2;
      const contentH = pageH - margin * 2;
      
      for (let i = 0; i < recipeElements.length; i++) {
        if (i > 0) {
          pdf.addPage();
        }
        
        const element = recipeElements[i] as HTMLElement;
        const originalWidth = element.style.width;
        element.style.width = '700px';

        const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        
        element.style.width = originalWidth;
        
        const imgData = canvas.toDataURL('image/png');
        const imgProps = pdf.getImageProperties(imgData);

        const finalW = contentW * (2 / 3);
        const finalH = (imgProps.height * finalW) / imgProps.width;
        const x = (pageW - finalW) / 2;

        if (finalH <= contentH) {
            const y = (pageH - finalH) / 2;
            pdf.addImage(imgData, 'PNG', x, y, finalW, finalH);
        } else {
            let y = margin;
            pdf.addImage(imgData, 'PNG', x, y, finalW, finalH);

            let heightLeft = finalH;
            heightLeft -= contentH;

            while (heightLeft > 0) {
                y -= contentH;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', x, y, finalW, finalH);
                heightLeft -= contentH;
            }
        }
      }
      
      pdf.save('rezepte.pdf');
      setIsCreatingPdf(false);
      setPdfStatus('');
      setIsPdfGenerationQueued(false);
    };

    const timer = setTimeout(createPdfFromElements, 500);
    return () => clearTimeout(timer);

  }, [isPdfGenerationQueued, recipes, imageUrls]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="text-center sm:text-left">
          <h2 className="text-2xl font-bold text-slate-700">Kochanleitungen für das Abendessen</h2>
          <p className="text-slate-500">Alle Rezepte sind für 2 Personen ausgelegt.</p>
        </div>
        <button
          onClick={handleCreatePdf}
          disabled={isCreatingPdf}
          className="flex items-center justify-center gap-2 w-48 px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg shadow-md hover:bg-slate-700 disabled:bg-slate-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors"
        >
          {isCreatingPdf ? <LoadingSpinnerIcon /> : <PrintIcon />}
          <span>{isCreatingPdf ? pdfStatus : 'PDF erstellen'}</span>
        </button>
      </div>

      <div className="space-y-12">
        {recipes.map((recipe) => (
          <div key={recipe.day} id={`recipe-${recipe.day}`} className="bg-white rounded-lg shadow-lg hover:shadow-xl overflow-hidden recipe-card-for-pdf">
            <div>
              <GeneratedRecipeImage 
                recipeTitle={recipe.title}
                imageUrl={imageUrls[recipe.day] || null}
                isLoading={loadingImages.has(recipe.day)}
                error={imageErrors[recipe.day] || null}
                onGenerate={() => generateImage(recipe)}
              />
            </div>
            <div className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">{recipe.day}</span>
                <div className="flex items-center gap-1 text-sm text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                  <FireIcon />
                  <span>ca. {recipe.totalCalories} kcal pro Portion</span>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mt-3">{recipe.title}</h3>

              {recipe.protein !== undefined && recipe.carbs !== undefined && recipe.fat !== undefined && (
                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-slate-600 p-3 bg-slate-50 rounded-lg">
                    <span className="flex items-center gap-1.5 text-sm">
                        <ProteinIcon /> 
                        <div>
                            <span className="font-bold">{recipe.protein}g</span>
                            <span className="text-slate-500 text-xs block">Protein</span>
                        </div>
                    </span>
                     <span className="flex items-center gap-1.5 text-sm">
                        <CarbsIcon /> 
                        <div>
                            <span className="font-bold">{recipe.carbs}g</span>
                            <span className="text-slate-500 text-xs block">Kohlenh.</span>
                        </div>
                    </span>
                     <span className="flex items-center gap-1.5 text-sm">
                        <FatIcon /> 
                        <div>
                            <span className="font-bold">{recipe.fat}g</span>
                            <span className="text-slate-500 text-xs block">Fett</span>
                        </div>
                    </span>
                </div>
              )}
              
              <div className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-x-8 gap-y-6">
                <div className="md:col-span-2">
                  <h4 className="text-lg font-semibold text-slate-700 border-b-2 border-slate-200 pb-2 mb-3">Zutaten:</h4>
                  <ul className="space-y-2 list-disc list-inside text-slate-600">
                    {recipe.ingredients.map((ingredient, index) => (
                      <li key={index}>{ingredient}</li>
                    ))}
                  </ul>
                </div>
                <div className="md:col-span-3 md:border-l md:border-slate-200 md:pl-8">
                  <h4 className="text-lg font-semibold text-slate-700 border-b-2 border-slate-200 pb-2 mb-3">Anleitung:</h4>
                  <ol className="space-y-3 list-decimal list-inside text-slate-600">
                    {recipe.instructions.map((step, index) => (
                      <li key={index}>{step}</li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecipesComponent;
