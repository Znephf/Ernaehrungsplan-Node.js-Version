import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import type { Recipes, Recipe } from '../types';
import { FireIcon, PrintIcon, LoadingSpinnerIcon, ProteinIcon, CarbsIcon, FatIcon } from './IconComponents';
import GeneratedRecipeImage from './GeneratedRecipeImage';

interface RecipesComponentProps {
  recipes: Recipes;
  persons: number;
  imageUrls: { [key: string]: string };
  loadingImages: Set<string>;
  imageErrors: { [key: string]: string | null };
  generateImage: (recipe: Recipe) => Promise<void>;
  generateMissingImages: (recipes: Recipe[], planId: number | null, onProgress?: (status: string) => void) => Promise<{ [key: string]: string }>;
}

const RecipesComponent: React.FC<RecipesComponentProps> = ({ recipes, persons, imageUrls, loadingImages, imageErrors, generateImage, generateMissingImages }) => {
  const [isCreatingPdf, setIsCreatingPdf] = useState(false);
  const [pdfStatus, setPdfStatus] = useState('');
  const [isPdfGenerationQueued, setIsPdfGenerationQueued] = useState(false);

  const handleCreatePdf = async () => {
    setIsCreatingPdf(true);
    setPdfStatus('Prüfe Bilder...');
    
    // planId is currently required by generateMissingImages for PDF generation, may need refactor later.
    // For now, we'll pass null if no plan context is available, though it shouldn't be called without a plan.
    await generateMissingImages(recipes || [], null, setPdfStatus);
    
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
      
      const style = document.createElement('style');
      style.id = 'pdf-recipe-styles';
      style.innerHTML = `
        .recipe-card-for-pdf.pdf-export-mode { box-shadow: none !important; border: 1px solid #e2e8f0; --tw-text-opacity: 1; color: rgb(15 23 42 / var(--tw-text-opacity)); }
        
        /* START: Fix for distorted images */
        .recipe-card-for-pdf.pdf-export-mode .aspect-video {
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
            height: 500px !important;
            padding-bottom: 0 !important;
            overflow: hidden !important;
            background-color: #f8fafc !important;
        }
        .recipe-card-for-pdf.pdf-export-mode img { 
            position: static !important;
            width: auto !important;
            height: auto !important;
            max-width: 100% !important;
            max-height: 100% !important;
        }
        /* END: Fix for distorted images */

        .recipe-card-for-pdf.pdf-export-mode .p-6 { padding: 1rem !important; }
        .recipe-card-for-pdf.pdf-export-mode h3 { font-size: 1.25rem !important; }
        .recipe-card-for-pdf.pdf-export-mode h4 { font-size: 1rem !important; }
        .recipe-card-for-pdf.pdf-export-mode li, .recipe-card-for-pdf.pdf-export-mode p { font-size: 0.8rem !important; line-height: 1.3 !important; }
        .recipe-card-for-pdf.pdf-export-mode span { font-size: 0.75rem !important; }
        .recipe-card-for-pdf.pdf-export-mode .mt-3 { margin-top: 0.5rem !important; }
        .recipe-card-for-pdf.pdf-export-mode .mt-4 { margin-top: 0.75rem !important; }
        .recipe-card-for-pdf.pdf-export-mode .mt-6 { margin-top: 1rem !important; }
      `;
      document.head.appendChild(style);

      for (let i = 0; i < recipeElements.length; i++) {
        if (i > 0) {
          pdf.addPage();
        }
        
        const element = recipeElements[i] as HTMLElement;
        const originalWidth = element.style.width;
        element.style.width = '680px';
        element.classList.add('pdf-export-mode');

        // Allow browser time to apply new styles
        await new Promise(resolve => setTimeout(resolve, 50));

        const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        
        element.style.width = originalWidth;
        element.classList.remove('pdf-export-mode');
        
        const imgData = canvas.toDataURL('image/png');
        const imgProps = pdf.getImageProperties(imgData);

        const finalW = contentW * (2/3); // Make the card smaller on the page
        const finalH = (imgProps.height * finalW) / imgProps.width;
        const x = (pageW - finalW) / 2;

        if (finalH <= contentH) {
            const y = (pageH - finalH) / 2; // Center vertically if it fits
            pdf.addImage(imgData, 'PNG', x, y, finalW, finalH);
        } else {
            // If it's too tall, align to top and let it flow onto next pages
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
      
      const tempStyle = document.getElementById('pdf-recipe-styles');
      if (tempStyle) tempStyle.remove();

      pdf.save('rezepte.pdf');
      setIsCreatingPdf(false);
      setPdfStatus('');
      setIsPdfGenerationQueued(false);
    };

    const timer = setTimeout(createPdfFromElements, 500);
    return () => clearTimeout(timer);

  }, [isPdfGenerationQueued, recipes, imageUrls, generateMissingImages]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="text-center sm:text-left">
          <h2 className="text-2xl font-bold text-slate-700">Kochanleitungen für das Abendessen</h2>
          <p className="text-slate-500">Alle Rezepte sind für {persons} Personen ausgelegt.</p>
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
        {(recipes || []).map((recipe) => (
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
                    {(recipe.ingredients || []).map((ingredient, index) => (
                      <li key={index}>{ingredient}</li>
                    ))}
                  </ul>
                </div>
                <div className="md:col-span-3 md:border-l md:border-slate-200 md:pl-8">
                  <h4 className="text-lg font-semibold text-slate-700 border-b-2 border-slate-200 pb-2 mb-3">Anleitung:</h4>
                  <ol className="space-y-3 list-decimal list-inside text-slate-600">
                    {(recipe.instructions || []).map((step, index) => (
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