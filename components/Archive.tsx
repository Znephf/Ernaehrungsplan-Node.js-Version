import React, { useState, useMemo } from 'react';
import type { ArchiveEntry, DietType } from '../types';
import { TrashIcon } from './IconComponents';

interface ArchiveComponentProps {
  archive: ArchiveEntry[];
  onLoadPlan: (id: string) => void;
  onDeletePlan: (id: string) => void;
}

const dietTypeLabels: Record<DietType, string> = {
    balanced: 'Ausgewogen',
    'low-carb': 'Low-Carb',
    keto: 'Ketogen',
    'high-protein': 'High-Protein',
    mediterranean: 'Mediterran'
};


const ArchiveComponent: React.FC<ArchiveComponentProps> = ({ archive, onLoadPlan, onDeletePlan }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredArchive = useMemo(() => {
    if (!searchTerm.trim()) {
      return archive;
    }
    const lowercasedTerm = searchTerm.toLowerCase();
    return archive.filter(entry => 
      entry.recipes.some(recipe => 
        recipe.title.toLowerCase().includes(lowercasedTerm)
      )
    );
  }, [archive, searchTerm]);


  if (archive.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-slate-700 mb-2">Dein Archiv ist leer</h2>
        <p className="text-slate-500">Generiere einen neuen Ernährungsplan, um ihn hier zu speichern.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-700">Archivierte Ernährungspläne</h2>
        <div className="w-full md:w-auto md:max-w-xs">
          <input
            type="text"
            placeholder="Suche nach Gerichten..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 bg-white text-slate-900 rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
          />
        </div>
      </div>
      
      {filteredArchive.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredArchive.map((entry) => (
            <div key={entry.id} className="bg-white rounded-lg shadow-lg flex flex-col justify-between p-6 transition-shadow hover:shadow-xl">
              <div>
                <p className="text-xs text-slate-400">
                  {entry.createdAt} Uhr
                </p>
                <h3 className="text-xl font-bold text-slate-800 mt-2">
                  {entry.name}
                </h3>
                <div className="text-sm text-slate-500 mt-2 flex flex-wrap gap-x-3 items-center">
                      <span>{entry.persons} Pers.</span>
                      <span className="text-slate-300">&bull;</span>
                      <span>{entry.kcal} kcal</span>
                      <span className="text-slate-300">&bull;</span>
                      <span className="capitalize">{entry.dietaryPreference === 'omnivore' ? 'Alles' : entry.dietaryPreference}</span>
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-slate-600">
                      <p>
                          <span className="font-semibold">Diät-Typ:</span> {dietTypeLabels[entry.dietType] || 'Standard'}
                      </p>
                      <p>
                          <span className="font-semibold">Frühstück:</span> <span className="capitalize">{entry.breakfastOption === 'custom' ? 'Eigene Angabe' : entry.breakfastOption}</span>
                      </p>
                  </div>
                  {entry.breakfastOption === 'custom' && entry.customBreakfast && (
                      <p className="text-xs text-slate-400 mt-1 italic" title={entry.customBreakfast}>
                          "{entry.customBreakfast.length > 40 ? `${entry.customBreakfast.substring(0, 40)}...` : entry.customBreakfast}"
                      </p>
                  )}
                  {entry.desiredIngredients && (
                      <p className="text-xs text-slate-400 mt-2" title={entry.desiredIngredients}>
                          <span className="font-semibold">Mit:</span> {entry.desiredIngredients.length > 40 ? `${entry.desiredIngredients.substring(0, 40)}...` : entry.desiredIngredients}
                      </p>
                  )}
                  {entry.excludedIngredients && (
                      <p className="text-xs text-slate-400 mt-2" title={entry.excludedIngredients}>
                          <span className="font-semibold">Ohne:</span> {entry.excludedIngredients.length > 40 ? `${entry.excludedIngredients.substring(0, 40)}...` : entry.excludedIngredients}
                      </p>
                  )}
              </div>
              <div className="flex items-center justify-end gap-2 mt-6">
                <button
                  onClick={() => onDeletePlan(entry.id)}
                  aria-label={`Plan vom ${entry.createdAt} löschen`}
                  className="p-2 text-slate-500 hover:bg-red-100 hover:text-red-600 rounded-full transition-colors"
                >
                  <TrashIcon />
                </button>
                <button
                  onClick={() => onLoadPlan(entry.id)}
                  className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg shadow-md hover:bg-emerald-700 transition-colors"
                >
                  Laden
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-lg shadow-md col-span-1 md:col-span-2 lg:col-span-3">
          <h2 className="text-xl font-bold text-slate-600 mb-2">Keine Treffer</h2>
          <p className="text-slate-500">Für den Suchbegriff "{searchTerm}" wurden keine Pläne gefunden.</p>
        </div>
      )}
    </div>
  );
};

export default ArchiveComponent;
