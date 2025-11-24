import React from 'react';
import { CameraIcon, LoadingSpinnerIcon } from './IconComponents';

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
            <LoadingSpinnerIcon className="animate-spin h-8 w-8 text-emerald-600" />
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