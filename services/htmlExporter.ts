import type { PlanData, ShoppingList, WeeklyPlan, Recipes, Recipe, ArchiveEntry } from '../types';

// Helper function to escape HTML special characters
const escapeHtml = (unsafe: string) => {
    if (!unsafe) return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
};

// Helper function to compress images to a smaller JPEG format
async function compressImage(base64Url: string, maxWidth = 600, quality = 0.7): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ratio = img.width / img.height;
            const width = Math.min(img.width, maxWidth);
            const height = width / ratio;
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Konnte Canvas-Kontext nicht abrufen'));

            // Fill background with white for JPG
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = (err) => reject(err);
        img.src = base64Url;
    });
}

// SVG Icons as strings
const Icons = {
    fire: `<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14.5 5 16.5 8 16.5 10c0 1-1.5 3-1.5 3s.625 2.375 2.625 4.375c2 2 4.375 2.625 4.375 2.625s-2.5-1.5-3-1.5c-1 0-3 .5-5 2.986C9 19.5 7 17.5 7 15.5c0-1.5 3-1.5 3-1.5s-2.375.625-4.375 2.625c-2 2-2.625 4.375-2.625 4.375A8 8 0 0117.657 18.657z" /></svg>`,
    protein: `<svg class="h-6 w-6 text-emerald-600" stroke-width="1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" /></svg>`,
    carbs: `<svg class="h-6 w-6 text-emerald-600" stroke-width="1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>`,
    fat: `<svg class="h-6 w-6 text-emerald-600" stroke-width="1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.002 9.002 0 008.485-6.132l-1.39-1.39a2.25 2.25 0 00-3.182 0l-1.09 1.09a2.25 2.25 0 01-3.182 0l-1.09-1.09a2.25 2.25 0 00-3.182 0L2.514 14.868A9.002 9.002 0 0012 21zM5.334 12.793a9.002 9.002 0 0113.332 0" /></svg>`,
};

// Functions to render components as HTML strings
function renderShoppingList(shoppingList: ShoppingList): string {
  return `
    <div class="space-y-8">
      <h2 class="text-3xl font-bold text-slate-700">Wöchentliche Einkaufsliste</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-1">
        ${shoppingList.map(({ category, items }) => `
          <div class="bg-white rounded-lg shadow-lg p-6 break-inside-avoid">
            <h3 class="text-xl font-semibold text-emerald-700 border-b-2 border-emerald-200 pb-2 mb-4">${escapeHtml(category)}</h3>
            <ul class="space-y-2">
              ${(items || []).map(item => `
                <li>
                  <label class="flex items-center cursor-pointer select-none">
                    <input type="checkbox" class="shopping-item-checkbox h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500">
                    <span class="ml-3 text-slate-600">${escapeHtml(item)}</span>
                  </label>
                </li>
              `).join('')}
            </ul>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Fix: Updated function to work with the normalized WeeklyPlan structure (using `meals` array).
function renderWeeklyPlan(weeklyPlan: WeeklyPlan, planName: string): string {
  return `
    <div class="space-y-8">
        <h2 class="text-3xl font-bold text-center text-slate-700">${escapeHtml(planName)}</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${weeklyPlan.map(dayPlan => {
                const breakfast = dayPlan.meals.find(m => m.mealType === 'breakfast');
                const dinner = dayPlan.meals.find(m => m.mealType === 'dinner');
                
                return `
                    <div class="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col">
                        <div class="bg-emerald-600 text-white p-4 flex justify-between items-center">
                            <h3 class="text-xl font-bold">${escapeHtml(dayPlan.day)}</h3>
                            <div class="flex items-center gap-1 text-sm bg-emerald-700 px-2 py-1 rounded-full">
                                ${Icons.fire}
                                <span>${dayPlan.totalCalories} kcal</span>
                            </div>
                        </div>
                        <div class="p-6 space-y-4 flex-grow">
                            ${breakfast ? `
                            <div>
                                <p class="font-semibold text-emerald-800 flex justify-between">
                                    <span>Frühstück:</span>
                                    <span class="font-normal text-slate-500">${breakfast.recipe.totalCalories} kcal</span>
                                </p>
                                <p class="text-slate-600">${escapeHtml(breakfast.recipe.title)}</p>
                            </div>
                            ` : ''}
                             ${dinner ? `
                            <div>
                                <p class="font-semibold text-emerald-800 flex justify-between">
                                    <span>Abendessen:</span>
                                     <span class="font-normal text-slate-500">${dinner.recipe.totalCalories} kcal</span>
                                </p>
                                <a href="#recipe-${escapeHtml(dayPlan.day)}" class="recipe-link text-left text-slate-600 hover:text-emerald-600 font-semibold transition-colors w-full">
                                    ${escapeHtml(dinner.recipe.title)}
                                </a>
                            </div>
                             ` : ''}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    </div>
  `;
}

// Fix: Updated function to get recipe and day from weeklyPlan structure.
function renderRecipes(weeklyPlan: WeeklyPlan, recipes: Recipes, imageUrls: { [key: string]: string }): string {
  return `
    <div class="space-y-8">
      <div class="text-center sm:text-left">
          <h2 class="text-3xl font-bold text-slate-700">Kochanleitungen für das Abendessen</h2>
          <p class="text-slate-500">Alle Rezepte sind für 2 Personen ausgelegt.</p>
      </div>
      <div class="space-y-12">
        ${weeklyPlan.map(dayPlan => {
          const dinnerMeal = dayPlan.meals.find(m => m.mealType === 'dinner');
          if (!dinnerMeal) return '';
          const recipe = dinnerMeal.recipe;
          const day = dayPlan.day;
          
          return `
          <div id="recipe-${escapeHtml(day)}" class="bg-white rounded-lg shadow-lg overflow-hidden">
            ${imageUrls[day] 
              ? `<div class="bg-slate-200"><img src="${imageUrls[day]}" alt="${escapeHtml(recipe.title)}" class="w-full h-auto"/></div>` 
              : `<div class="aspect-video bg-slate-200 flex items-center justify-center"><p class="text-slate-500">Kein Bild generiert</p></div>`
            }
            <div class="p-6">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-sm font-semibold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">${escapeHtml(day)}</span>
                <div class="flex items-center gap-1 text-sm text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                  ${Icons.fire}
                  <span>ca. ${recipe.totalCalories} kcal pro Portion</span>
                </div>
              </div>
              <h3 class="text-2xl font-bold text-slate-800 mt-3">${escapeHtml(recipe.title)}</h3>
              ${recipe.protein !== undefined ? `
                <div class="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-slate-600 p-3 bg-slate-50 rounded-lg">
                    <span class="flex items-center gap-1.5 text-sm">${Icons.protein}<div><span class="font-bold">${recipe.protein}g</span><span class="text-slate-500 text-xs block">Protein</span></div></span>
                    <span class="flex items-center gap-1.5 text-sm">${Icons.carbs}<div><span class="font-bold">${recipe.carbs}g</span><span class="text-slate-500 text-xs block">Kohlenh.</span></div></span>
                    <span class="flex items-center gap-1.5 text-sm">${Icons.fat}<div><span class="font-bold">${recipe.fat}g</span><span class="text-slate-500 text-xs block">Fett</span></div></span>
                </div>
              ` : ''}
              <div class="mt-6 grid grid-cols-1 md:grid-cols-5 gap-x-8 gap-y-6">
                <div class="md:col-span-2">
                  <h4 class="text-lg font-semibold text-slate-700 border-b-2 border-slate-200 pb-2 mb-3">Zutaten:</h4>
                  <ul class="space-y-2 list-disc list-inside text-slate-600">
                    ${(recipe.ingredients || []).map(ing => `<li>${escapeHtml(ing)}</li>`).join('')}
                  </ul>
                </div>
                <div class="md:col-span-3 md:border-l md:border-slate-200 md:pl-8">
                  <h4 class="text-lg font-semibold text-slate-700 border-b-2 border-slate-200 pb-2 mb-3">Anleitung:</h4>
                  <ol class="space-y-3 list-decimal list-inside text-slate-600">
                     ${(recipe.instructions || []).map(step => `<li>${escapeHtml(step)}</li>`).join('')}
                  </ol>
                </div>
              </div>
            </div>
          </div>
        `}).join('')}
      </div>
    </div>
  `;
}

// Main function to generate and trigger download
export const generateAndDownloadHtml = async (plan: PlanData | ArchiveEntry, imageUrls: { [key: string]: string }) => {
    
    const compressedImageUrls: { [key: string]: string } = {};
    const imagePromises = Object.keys(imageUrls).map(async day => {
        if (imageUrls[day]) {
            try {
                compressedImageUrls[day] = await compressImage(imageUrls[day]);
            } catch (e) {
                console.error(`Konnte Bild für ${day} nicht komprimieren:`, e);
                compressedImageUrls[day] = imageUrls[day]; // Fallback auf Original
            }
        }
    });

    await Promise.all(imagePromises);

    const weeklyPlanHtml = renderWeeklyPlan(plan.weeklyPlan, plan.name);
    const shoppingListHtml = renderShoppingList(plan.shoppingList);
    const recipesHtml = renderRecipes(plan.weeklyPlan, plan.recipes, compressedImageUrls);

    const fullHtml = `
      <!DOCTYPE html>
      <html lang="de" style="scroll-behavior: smooth;">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${escapeHtml(plan.name)}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
              body { font-family: sans-serif; background-color: #f1f5f9; }
              .view { display: none; }
              .view.active { display: block; }
              .nav-button.active { background-color: #047857; color: white; box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05); }
          </style>
      </head>
      <body class="bg-slate-100">
          <header class="bg-white shadow-md sticky top-0 z-10">
              <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <h1 class="text-2xl font-bold text-slate-800">KI Ernährungsplaner</h1>
                  <nav class="flex items-center justify-center gap-2 sm:gap-4 p-1 bg-slate-100 rounded-lg">
                      <button data-view="plan" class="nav-button active px-4 py-2 text-sm sm:text-base font-medium rounded-md text-slate-600 hover:bg-slate-200">Wochenplan</button>
                      <button data-view="shopping" class="nav-button px-4 py-2 text-sm sm:text-base font-medium rounded-md text-slate-600 hover:bg-slate-200">Einkaufsliste</button>
                      <button data-view="recipes" class="nav-button px-4 py-2 text-sm sm:text-base font-medium rounded-md text-slate-600 hover:bg-slate-200">Rezepte</button>
                  </nav>
              </div>
          </header>
          <main class="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div id="view-plan" class="view active">${weeklyPlanHtml}</div>
              <div id="view-shopping" class="view">${shoppingListHtml}</div>
              <div id="view-recipes" class="view">${recipesHtml}</div>
          </main>
          <script>
            document.addEventListener('DOMContentLoaded', () => {
                const views = {
                    plan: document.getElementById('view-plan'),
                    shopping: document.getElementById('view-shopping'),
                    recipes: document.getElementById('view-recipes'),
                };
                const buttons = document.querySelectorAll('.nav-button');

                buttons.forEach(button => {
                    button.addEventListener('click', () => {
                        const viewName = button.getAttribute('data-view');
                        
                        buttons.forEach(btn => btn.classList.remove('active'));
                        button.classList.add('active');
                        
                        Object.values(views).forEach(v => v.classList.remove('active'));
                        if (views[viewName]) {
                            views[viewName].classList.add('active');
                        }
                    });
                });

                document.querySelectorAll('.shopping-item-checkbox').forEach(checkbox => {
                    checkbox.addEventListener('change', (e) => {
                        const span = e.target.closest('label').querySelector('span');
                        if (e.target.checked) {
                            span.style.textDecoration = 'line-through';
                            span.style.color = '#94a3b8';
                        } else {
                            span.style.textDecoration = 'none';
                            span.style.color = '#475569';
                        }
                    });
                });

                document.querySelectorAll('a.recipe-link').forEach(link => {
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        const recipeId = link.getAttribute('href');
                        document.querySelector('.nav-button[data-view="recipes"]').click();
                        setTimeout(() => {
                            const recipeElement = document.querySelector(recipeId);
                            if (recipeElement) {
                                recipeElement.scrollIntoView({ behavior: 'smooth' });
                            }
                        }, 50);
                    });
                });
            });
          </script>
      </body>
      </html>
    `;

    const blob = new Blob([fullHtml], { type: 'text/html' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    const safeName = plan.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    a.download = `${safeName || 'ernaehrungsplan'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(href);
};