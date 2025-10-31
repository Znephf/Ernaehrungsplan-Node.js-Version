import React from 'react';
import { CameraIcon } from './IconComponents';

interface GeneratedRecipeImageProps {
  recipeTitle: string;
  imageUrl: string | null;
  isLoading: boolean;
  error: string | null;
  onGenerate: () => void;
}

const GeneratedRecipeImage: React.FC<GeneratedRecipeImageProps> = ({ recipeTitle, imageUrl, isLoading, error, onGenerate }) => {
  // If an image URL is present, render the image within a consistent aspect-ratio container.
  if (imageUrl) {
    return (
      <div className="relative aspect-video bg-slate-200">
        <img 
          src={imageUrl} 
          alt={`Ein Bild von ${recipeTitle}`} 
          className="w-full h-full object-cover" 
        />
      </div>
    );
  }

  // The placeholder also uses a fixed aspect ratio for a consistent layout.
  return (
    <div className="relative aspect-video bg-slate-200">
      <div className="flex flex-col items-center justify-center h-full p-4">
        {isLoading ? (
          <>
            <svg className="animate-spin h-8 w-8 text-emerald-600" xmlns="http://www.w.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="mt-2 text-slate-600 font-semibold text-center">Bild wird erstellt...</p>
          </>
        ) : (
          <>
           <p className="text-slate-500 mb-2 text-center">Wie würde dieses Gericht aussehen?</p>
            <button
              onClick={onGenerate}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg shadow-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all"
            >
              <CameraIcon />
              Bild generieren
            </button>
            {error && <p className="text-red-500 text-sm mt-2 text-center">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
};

export default GeneratedRecipeImage;