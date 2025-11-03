import React, { useState, useMemo, useEffect } from 'react';
import type { ArchiveEntry, DietType, Diet, DishComplexity, PlanSettings } from '../types';
import { HideIcon, TrashIcon } from './IconComponents';

interface ArchiveComponentProps {
  archive: ArchiveEntry[];
  onLoadPlan: (id: number) => void;
  onDeletePlan: (id: number) => void;
}

const dietPreferenceLabels: Record<Diet, string> = {
    omnivore: 'Alles',
    vegetarian: 'Vegetarisch',
    vegan: 'Vegan'
};

const dietTypeLabels: Record<DietType, string> = {
    balanced: 'Ausgewogen',
    'low-carb': 'Low-Carb',
    keto: 'Ketogen',
    'high-protein': 'High-Protein',
    mediterranean: 'Mediterran'
};

const dishComplexityLabels: Record<DishComplexity, string> = {
    simple: 'Einfach',
    advanced: 'Fortgeschritten',
    fancy: 'Pfiffig'
};


const ArchiveComponent: React.FC<ArchiveComponentProps> = ({ archive, onLoadPlan, onDeletePlan }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPreferences, setSelectedPreferences] = useState<Set<Diet>>(new Set());
  const [selectedDietTypes, setSelectedDietTypes] = useState<Set<DietType>>(new Set());
  const [selectedComplexities, setSelectedComplexities] = useState<Set<DishComplexity>>(new Set());
  const [filterGlutenFree, setFilterGlutenFree] = useState(false);
  const [filterLactoseFree, setFilterLactoseFree] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    const cookieValue = document.cookie
      .split('; ')
      .find(row => row.startsWith('hidden_plans='))
      ?.split('=')[1];
    if (cookieValue && cookieValue !== '') {
      const ids = cookieValue.split(',').map(Number).filter(id => !isNaN(id));
      setHiddenIds(new Set(ids));
    }
  }, []);

  const handleHidePlan = (id: number) => {
    const newHiddenIds = new Set(hiddenIds);
    newHiddenIds.add(id);
    setHiddenIds(newHiddenIds);

    const newCookieValue = Array.from(newHiddenIds).join(',');
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1); // Cookie für 1 Jahr
    document.cookie = `hidden_plans=${newCookieValue};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
  };
  
  const handleShowAll = () => {
    if (window.confirm("Möchten Sie wirklich alle ausgeblendeten Pläne wieder anzeigen?")) {
      setHiddenIds(new Set());
      document.cookie = 'hidden_plans=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax';
    }
  };


  const handleFilterToggle = <T extends string>(
    value: T,
    currentFilters: Set<T>,
    setFilters: React.Dispatch<React.SetStateAction<Set<T>>>
  ) => {
    const newFilters = new Set(currentFilters);
    if (newFilters.has(value)) {
      newFilters.delete(value);
    } else {
      newFilters.add(value);
    }
    setFilters(newFilters);
  };

  const filteredArchive = useMemo(() => {
    return archive.filter(entry => {
      if (hiddenIds.has(entry.id)) {
        return false;
      }
      const lowercasedTerm = searchTerm.toLowerCase().trim();
      const matchesSearch = !lowercasedTerm ||
        (entry.name && entry.name.toLowerCase().includes(lowercasedTerm)) ||
        (entry.recipes || []).some(recipe =>
          recipe.title.toLowerCase().includes(lowercasedTerm)
        );
      
      // FIX: Cast settings to Partial<PlanSettings> and add checks to handle potentially missing properties on older archive entries.
      const settings: Partial<PlanSettings> = entry.settings || {};
      const matchesPreference = selectedPreferences.size === 0 || (settings.dietaryPreference && selectedPreferences.has(settings.dietaryPreference));
      const matchesDietType = selectedDietTypes.size === 0 || (settings.dietType && selectedDietTypes.has(settings.dietType));
      const matchesComplexity = selectedComplexities.size === 0 || (settings.dishComplexity && selectedComplexities.has(settings.dishComplexity));
      const matchesGlutenFree = !filterGlutenFree || !!settings.isGlutenFree;
      const matchesLactoseFree = !filterLactoseFree || !!settings.isLactoseFree;

      return matchesSearch && matchesPreference && matchesDietType && matchesComplexity && matchesGlutenFree && matchesLactoseFree;
    });
  }, [archive, searchTerm, selectedPreferences, selectedDietTypes, selectedComplexities, filterGlutenFree, filterLactoseFree, hiddenIds]);


  if (archive.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-slate-700 mb-2">Dein Plan-Archiv ist leer</h2>
        <p className="text-slate-500">Generiere einen neuen Ernährungsplan, um ihn hier zu speichern.</p>
      </div>
    );
  }

  const FilterToggleButton: React.FC<{
    label: string;
    isSelected: boolean;
    onClick: () => void;
  }> = ({ label, isSelected, onClick }) => {
    return (
      <button
        onClick={onClick}
        className={`px-3 py-1 text-sm rounded-full transition-colors font-medium whitespace-nowrap ${
          isSelected
            ? 'bg-emerald-600 text-white shadow-sm'
            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="space-y-8">
      <div className="space-y-6 bg-white/50 p-6 rounded-lg shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <h2 className="text-2xl font-bold text-slate-700">Plan Archiv</h2>
          <div className="flex items-center gap-2">
            {hiddenIds.size > 0 && (
                <button
                    onClick={handleShowAll}
                    className="px-3 py-2 text-sm rounded-md transition-colors font-medium whitespace-nowrap bg-slate-200 text-slate-700 hover:bg-slate-300"
                    title={`${hiddenIds.size} ausgeblendete(n) Plan/Pläne wieder anzeigen`}
                >
                    Alle anzeigen
                </button>
            )}
            <div className="w-full md:w-auto md:max-w-xs">
                <input
                  type="text"
                  placeholder="Suche in Name & Gerichten..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 bg-white text-slate-900 rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                />
            </div>
          </div>
        </div>

        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-slate-600 mr-2 shrink-0">Ernährungsweise:</span>
                {/* FIX: Use Object.keys for type-safe iteration over string literal types. */}
                {(Object.keys(dietPreferenceLabels) as Diet[]).map(key => (
                    <FilterToggleButton 
                        key={key} 
                        label={dietPreferenceLabels[key]} 
                        isSelected={selectedPreferences.has(key)}
                        onClick={() => handleFilterToggle(key, selectedPreferences, setSelectedPreferences)} 
                    />
                ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-slate-600 mr-2 shrink-0">Diät-Typ:</span>
                {/* FIX: Use Object.keys for type-safe iteration over string literal types. */}
                {(Object.keys(dietTypeLabels) as DietType[]).map(key => (
                     <FilterToggleButton 
                        key={key} 
                        label={dietTypeLabels[key]} 
                        isSelected={selectedDietTypes.has(key)}
                        onClick={() => handleFilterToggle(key, selectedDietTypes, setSelectedDietTypes)} 
                    />
                ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-slate-600 mr-2 shrink-0">Koch-Niveau:</span>
                {/* FIX: Use Object.keys for type-safe iteration over string literal types. */}
                {(Object.keys(dishComplexityLabels) as DishComplexity[]).map(key => (
                     <FilterToggleButton 
                        key={key} 
                        label={dishComplexityLabels[key]} 
                        isSelected={selectedComplexities.has(key)}
                        onClick={() => handleFilterToggle(key, selectedComplexities, setSelectedComplexities)} 
                    />
                ))}
            </div>
             <div className="flex flex-wrap items-center gap-2 pt-2">
                <span className="text-sm font-medium text-slate-600 mr-2 shrink-0">Optionen:</span>
                <label className="flex items-center space-x-2 cursor-pointer text-sm font-medium text-slate-700 bg-slate-200 hover:bg-slate-300 px-3 py-1 rounded-full transition-colors has-[:checked]:bg-emerald-600 has-[:checked]:text-white has-[:checked]:shadow-sm">
                    <input
                        type="checkbox"
                        checked={filterGlutenFree}
                        onChange={(e) => setFilterGlutenFree(e.target.checked)}
                        className="h-0 w-0 absolute opacity-0"
                    />
                    <span>Nur Glutenfrei</span>
                </label>
                 <label className="flex items-center space-x-2 cursor-pointer text-sm font-medium text-slate-700 bg-slate-200 hover:bg-slate-300 px-3 py-1 rounded-full transition-colors has-[:checked]:bg-emerald-600 has-[:checked]:text-white has-[:checked]:shadow-sm">
                    <input
                        type="checkbox"
                        checked={filterLactoseFree}
                        onChange={(e) => setFilterLactoseFree(e.target.checked)}
                        className="h-0 w-0 absolute opacity-0"
                    />
                    <span>Nur Laktosefrei</span>
                </label>
            </div>
        </div>
      </div>
      
      {filteredArchive.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredArchive.map((entry) => {
            // FIX: Cast settings to Partial<PlanSettings> to handle potentially missing properties on older archive entries.
            const settings: Partial<PlanSettings> = entry.settings || {};
            return (
              <div key={entry.id} className="bg-white rounded-lg shadow-lg flex flex-col justify-between p-6 transition-shadow hover:shadow-xl">
                <div>
                  <p className="text-xs text-slate-400">
                    {entry.createdAt} Uhr
                  </p>
                  <h3 className="text-xl font-bold text-slate-800 mt-2">
                    {entry.name}
                  </h3>
                  <div className="text-sm text-slate-500 mt-2 flex flex-wrap gap-x-3 items-center">
                        {/* FIX: Use nullish coalescing to provide defaults for optional settings properties. */}
                        <span>{settings.persons ?? '?'} Pers.</span>
                        <span className="text-slate-300">&bull;</span>
                        <span>{settings.kcal ?? '?'} kcal</span>
                        <span className="text-slate-300">&bull;</span>
                        <span className="capitalize">{settings.dietaryPreference === 'omnivore' ? 'Alles' : (settings.dietaryPreference ?? 'Unbekannt')}</span>
                    </div>
                    <div className="text-xs text-emerald-700 font-semibold mt-2 flex flex-wrap gap-x-2">
                      {/* FIX: Check for truthiness is sufficient for optional booleans. */}
                      {settings.isGlutenFree && <span className="bg-emerald-50 px-2 py-0.5 rounded-full">Glutenfrei</span>}
                      {settings.isLactoseFree && <span className="bg-emerald-50 px-2 py-0.5 rounded-full">Laktosefrei</span>}
                    </div>
                    <div className="mt-3 space-y-1 text-sm text-slate-600">
                        <p>
                            {/* FIX: Check for property existence before indexing into label maps. */}
                            <span className="font-semibold">Diät-Typ:</span> {settings.dietType ? dietTypeLabels[settings.dietType] : 'Standard'}
                        </p>
                         <p>
                            <span className="font-semibold">Niveau:</span> {settings.dishComplexity ? dishComplexityLabels[settings.dishComplexity] : 'Einfach'}
                        </p>
                        {/* FIX: Check for truthiness is sufficient for optional properties. */}
                        {settings.breakfastOption && <p>
                            <span className="font-semibold">Frühstück:</span> <span className="capitalize">{settings.breakfastOption === 'custom' ? 'Eigene Angabe' : settings.breakfastOption}</span>
                        </p>}
                    </div>
                    {/* FIX: Check for truthiness is sufficient for optional properties. */}
                    {settings.breakfastOption === 'custom' && settings.customBreakfast && (
                        <p className="text-xs text-slate-400 mt-1 italic" title={settings.customBreakfast}>
                            "{settings.customBreakfast.length > 40 ? `${settings.customBreakfast.substring(0, 40)}...` : settings.customBreakfast}"
                        </p>
                    )}
                    {settings.desiredIngredients && (
                        <p className="text-xs text-slate-400 mt-2" title={settings.desiredIngredients}>
                            <span className="font-semibold">Mit:</span> {settings.desiredIngredients.length > 40 ? `${settings.desiredIngredients.substring(0, 40)}...` : settings.desiredIngredients}
                        </p>
                    )}
                    {settings.excludedIngredients && (
                        <p className="text-xs text-slate-400 mt-2" title={settings.excludedIngredients}>
                            <span className="font-semibold">Ohne:</span> {settings.excludedIngredients.length > 40 ? `${settings.excludedIngredients.substring(0, 40)}...` : settings.excludedIngredients}
                        </p>
                    )}
                </div>
                <div className="flex items-center justify-end gap-2 mt-6">
                  <button
                    onClick={() => handleHidePlan(entry.id)}
                    aria-label={`Plan vom ${entry.createdAt} ausblenden`}
                    className="p-2 text-slate-500 hover:bg-amber-100 hover:text-amber-600 rounded-full transition-colors"
                  >
                    <HideIcon />
                  </button>
                  <button
                    onClick={() => onDeletePlan(entry.id)}
                    aria-label={`Plan ${entry.name} löschen`}
                    className="p-2 text-slate-500 hover:bg-red-100 hover:text-red-600 rounded-full transition-colors"
                    title="Diesen Plan löschen"
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
            )
          })}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-lg shadow-md col-span-1 md:col-span-2 lg:col-span-3">
          <h2 className="text-xl font-bold text-slate-600 mb-2">Keine Treffer</h2>
          <p className="text-slate-500">Für die aktuellen Filter wurden keine Pläne gefunden.</p>
        </div>
      )}
    </div>
  );
};

export default ArchiveComponent;