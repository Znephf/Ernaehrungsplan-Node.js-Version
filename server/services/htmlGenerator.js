
const fs = require('fs');
const path = require('path');

const escapeHtml = (unsafe) => {
    if (typeof unsafe !== 'string') return '';
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/, "&quot;").replace(/'/g, "&#039;");
};

// SVG Icons as Lucide data tags
// These will be transformed by the Lucide script in the browser
const Icons = {
    fire: '<i data-lucide="flame" class="h-5 w-5 inline-block align-text-bottom"></i>',
    protein: '<i data-lucide="beef" class="h-6 w-6 text-emerald-600 inline-block"></i>',
    carbs: '<i data-lucide="wheat" class="h-6 w-6 text-emerald-600 inline-block"></i>',
    fat: '<i data-lucide="droplet" class="h-6 w-6 text-emerald-600 inline-block"></i>',
};

async function generateShareableHtml(plan) {
    const planName = plan.name || 'Ernährungsplan';
    const backLink = plan.shareId ? `/?shareId=${plan.shareId}` : '/';
    
    // We use a function to build the script string.
    // CRITICAL FIX: Using concatenation instead of template literals for the client-side script
    // to strictly avoid Node.js trying to interpolate client-side variables like ${response.status}.
    const buildClientScript = () => {
        return `
        document.addEventListener('DOMContentLoaded', () => {
            // Initialize icons for static content immediately
            if (window.lucide) window.lucide.createIcons();

            const MealCategoryLabels = { breakfast: 'Frühstück', lunch: 'Mittagessen', coffee: 'Kaffee & Kuchen', dinner: 'Abendessen', snack: 'Snack' };
            const Icons = {
                fire: '<i data-lucide="flame" class="h-5 w-5 inline-block align-text-bottom"></i>',
                protein: '<i data-lucide="beef" class="h-6 w-6 text-emerald-600 inline-block"></i>',
                carbs: '<i data-lucide="wheat" class="h-6 w-6 text-emerald-600 inline-block"></i>',
                fat: '<i data-lucide="droplet" class="h-6 w-6 text-emerald-600 inline-block"></i>',
            };
            const escape = (str) => String(str).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
            
            function formatIngredient(ing, basePersons, targetPersons) {
                if (typeof ing === 'string') return escape(ing);
                if (!ing || typeof ing.quantity === 'undefined' || ing.ingredient === null) return null;
                
                let scaledQuantity = (ing.quantity / (basePersons || 1)) * targetPersons;
                const simpleUnits = ['Stück', 'Prise', 'Bund', 'Zehe', 'Stangen', 'Dose', 'El'];
                if (ing.unit && simpleUnits.some(u => ing.unit.toLowerCase().includes(u.toLowerCase()))) {
                    scaledQuantity = Math.round(scaledQuantity * 10) / 10;
                } else {
                    scaledQuantity = Math.round(scaledQuantity);
                }
                if (scaledQuantity === 0) return null;

                let unit = ing.unit;
                if (ing.unit && ing.unit.toLowerCase() === 'stück') {
                    if (scaledQuantity === 1) return escape(ing.ingredient);
                    unit = 'Stücke';
                }
                
                return escape(scaledQuantity + ' ' + unit + ' ' + ing.ingredient);
            }

            function renderWeeklyPlan(plan) {
                if (!plan || !plan.weeklyPlan) return '<p class="text-center text-slate-500">Keine Wochendaten vorhanden.</p>';
                
                return '<div class="space-y-8">' +
                    '<h2 class="text-3xl font-bold text-center text-slate-700">' + escape(plan.name) + '</h2>' +
                    '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">' +
                        plan.weeklyPlan.map(dayPlan => '<div class="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col">' +
                            '<div class="bg-emerald-600 text-white p-4 flex justify-between items-center">' +
                                '<h3 class="text-xl font-bold">' + escape(dayPlan.day) + '</h3>' +
                                '<div class="flex items-center gap-1 text-sm bg-emerald-700 px-2 py-1 rounded-full">' + Icons.fire + '<span>' + dayPlan.totalCalories + ' kcal</span></div>' +
                            '</div>' +
                            '<div class="p-6 space-y-4 flex-grow">' +
                                dayPlan.meals.map(meal => '<div>' +
                                    '<p class="font-semibold text-emerald-800 flex justify-between"><span>' + (MealCategoryLabels[meal.mealType] || meal.mealType) + ':</span><span class="font-normal text-slate-500">' + meal.recipe.totalCalories + ' kcal</span></p>' +
                                    '<a href="#recipe-day-' + escape(dayPlan.day) + '-' + escape(meal.mealType) + '" class="recipe-link text-left text-slate-600 hover:text-emerald-600 font-semibold transition-colors w-full">' + escape(meal.recipe.title) + '</a>' +
                                '</div>').join('') +
                            '</div>' +
                        '</div>').join('') +
                    '</div>' +
                '</div>';
            }

            function renderShoppingList(plan) {
                 if (!plan.shoppingList || plan.shoppingList.length === 0) return '<p class="text-center text-slate-500">Keine Einkaufsliste verfügbar.</p>';
                 return '<div class="space-y-8">' +
                    '<div class="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">' +
                        '<h2 class="text-3xl font-bold text-slate-700">Wöchentliche Einkaufsliste</h2>' +
                        '<button id="reset-shopping-list" class="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-md shadow-sm">Einkaufsliste zurücksetzen</button>' +
                    '</div>' +
                    '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-1">' +
                        plan.shoppingList.map(({ category, items }) => '<div class="bg-white rounded-lg shadow-lg p-6 break-inside-avoid">' +
                            '<h3 class="text-xl font-semibold text-emerald-700 border-b-2 border-emerald-200 pb-2 mb-4">' + escape(category) + '</h3>' +
                            '<ul class="space-y-2">' +
                                (items || []).map(item => '<li><label class="flex items-center cursor-pointer select-none"><input type="checkbox" class="shopping-item-checkbox h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"><span class="ml-3 text-slate-600">' + escape(item) + '</span></label></li>').join('') +
                            '</ul>' +
                        '</div>').join('') +
                    '</div>' +
                '</div>';
            }

            function renderRecipes(plan) {
                const personsText = '<p class="text-slate-500">Alle Rezepte sind für ' + (plan.settings.persons || 2) + ' Personen ausgelegt.</p>';
                const mainTitle = '<div class="text-center sm:text-left"><h2 class="text-3xl font-bold text-slate-700">Kochanleitungen</h2>' + personsText + '</div>';

                const weeklyPlanHtml = plan.weeklyPlan.map(dayPlan => {
                    if (dayPlan.meals.length === 0) return '';
                    const mealsHtml = dayPlan.meals.map(meal => {
                        const recipe = meal.recipe;
                        if (!recipe) return '';

                        const imageUrlHtml = recipe.image_url ?
                            '<div class="bg-slate-200"><img src="' + escape(recipe.image_url) + '" alt="' + escape(recipe.title) + '" class="w-full h-auto object-cover aspect-video"/></div>' :
                            '<div class="aspect-video bg-slate-200 flex items-center justify-center"><p class="text-slate-500">Kein Bild vorhanden</p></div>';

                        const macrosHtml = (recipe.protein !== undefined && recipe.protein !== null) ?
                            '<div class="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-slate-600 p-3 bg-slate-50 rounded-lg">' +
                            '<span class="flex items-center gap-1.5 text-sm">' + Icons.protein + '<div><span class="font-bold">' + recipe.protein + 'g</span><span class="text-slate-500 text-xs block">Protein</span></div></span>' +
                            '<span class="flex items-center gap-1.5 text-sm">' + Icons.carbs + '<div><span class="font-bold">' + recipe.carbs + 'g</span><span class="text-slate-500 text-xs block">Kohlenh.</span></div></span>' +
                            '<span class="flex items-center gap-1.5 text-sm">' + Icons.fat + '<div><span class="font-bold">' + recipe.fat + 'g</span><span class="text-slate-500 text-xs block">Fett</span></div></span>' +
                            '</div>' : '';
                        
                        const ingredientItems = [];
                        (recipe.ingredients || []).forEach(ing => {
                            const formatted = formatIngredient(ing, recipe.base_persons, plan.settings.persons);
                            if (formatted) {
                                ingredientItems.push('<li>' + formatted + '</li>');
                            }
                        });
                        const ingredientsHtml = '<ul class="space-y-2 list-disc list-inside text-slate-600">' + ingredientItems.join('') + '</ul>';
                        
                        const instructionsHtml = '<ol class="space-y-3 list-decimal list-inside text-slate-600 instruction-list">' + (recipe.instructions || []).map(step => '<li>' + escape(step) + '</li>').join('') + '</ol>';
                        
                        const stepsJson = JSON.stringify(recipe.instructions || []);
                        const stepsAttr = stepsJson.replace(/"/g, "&quot;");

                        return '<div id="recipe-day-' + escape(dayPlan.day) + '-' + escape(meal.mealType) + '" class="bg-white rounded-lg shadow-lg overflow-hidden recipe-card" data-title="' + escape(recipe.title) + '" data-steps="' + stepsAttr + '">' +
                            imageUrlHtml +
                            '<div class="p-6">' +
                            '<div class="flex flex-wrap items-center justify-between gap-2">' +
                            '<span class="text-sm font-semibold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">' + (MealCategoryLabels[meal.mealType] || meal.mealType) + '</span>' +
                            '<div class="flex items-center gap-1 text-sm text-slate-600 bg-slate-100 px-3 py-1 rounded-full">' + Icons.fire + '<span>ca. ' + recipe.totalCalories + ' kcal</span></div>' +
                            '</div>' +
                            '<h3 class="text-2xl font-bold text-slate-800 mt-3">' + escape(recipe.title) + '</h3>' +
                            macrosHtml +
                            '<div class="mt-6"><button class="start-cooking-btn w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded shadow-md flex items-center justify-center gap-2 transition-colors"><i data-lucide="play" class="w-5 h-5"></i> Koch-Modus starten</button></div>' +
                            '<div class="mt-6 grid grid-cols-1 md:grid-cols-5 gap-x-8 gap-y-6">' +
                            '<div class="md:col-span-2"><h4 class="text-lg font-semibold text-slate-700 border-b-2 border-slate-200 pb-2 mb-3">Zutaten:</h4>' + ingredientsHtml + '</div>' +
                            '<div class="md:col-span-3 md:border-l md:border-slate-200 md:pl-8"><h4 class="text-lg font-semibold text-slate-700 border-b-2 border-slate-200 pb-2 mb-3">Anleitung:</h4>' + instructionsHtml + '</div>' +
                            '</div>' +
                            '</div>' +
                            '</div>';
                    }).join('');
                    
                    if (mealsHtml.trim() === '') return '';

                    return '<div>' +
                        '<h2 class="text-3xl font-bold text-slate-700 border-b-2 border-slate-200 pb-3 mb-6 sm:sticky top-20 z-20 bg-slate-100/80 backdrop-blur-sm py-2">' + escape(dayPlan.day) + '</h2>' +
                        '<div class="space-y-8">' + mealsHtml + '</div>' +
                        '</div>';
                }).join('');

                return '<div class="space-y-8">' + mainTitle + '<div class="space-y-12">' + weeklyPlanHtml + '</div></div>';
            }
            
            let wakeLock = null;
            async function requestWakeLock() {
                try {
                    if ('wakeLock' in navigator) {
                        wakeLock = await navigator.wakeLock.request('screen');
                        wakeLock.addEventListener('release', () => { console.log('Wake Lock released'); });
                    }
                } catch (err) { console.error(err.name + ', ' + err.message); }
            }
            async function releaseWakeLock() {
                if (wakeLock !== null) { await wakeLock.release(); wakeLock = null; }
            }

            function initCookingMode() {
                const overlay = document.getElementById('cooking-overlay');
                const container = document.getElementById('cooking-steps-container');
                const titleEl = document.getElementById('cooking-title');
                const closeBtn = document.getElementById('close-cooking');
                const prevBtn = document.getElementById('prev-step');
                const nextBtn = document.getElementById('next-step');
                const stepIndicator = document.getElementById('step-indicator');
                let currentSteps = [];
                let currentStepIndex = 0;

                function showStep(index) {
                    const slides = container.querySelectorAll('.step-slide');
                    slides.forEach((s, i) => {
                        s.classList.toggle('active', i === index);
                    });
                    stepIndicator.textContent = 'Schritt ' + (index + 1) + ' von ' + currentSteps.length;
                    prevBtn.disabled = index === 0;
                    nextBtn.textContent = index === currentSteps.length - 1 ? 'Fertig' : 'Weiter';
                    currentStepIndex = index;
                }

                function parseTime(text) {
                    const match = text.match(/(\d+)\s*(?:Minuten|Min|min)/);
                    return match ? parseInt(match[1], 10) : null;
                }

                function startTimer(btn, minutes) {
                    let seconds = minutes * 60;
                    btn.disabled = true;
                    const interval = setInterval(() => {
                        seconds--;
                        const m = Math.floor(seconds / 60);
                        const s = seconds % 60;
                        btn.innerText = m + ':' + s.toString().padStart(2, '0');
                        if (seconds <= 0) {
                            clearInterval(interval);
                            btn.innerText = "Fertig!";
                            btn.classList.remove('bg-slate-100', 'text-slate-800');
                            btn.classList.add('bg-green-500', 'text-white');
                        }
                    }, 1000);
                }

                document.body.addEventListener('click', e => {
                    const startBtn = e.target.closest('.start-cooking-btn');
                    if (startBtn) {
                        const card = startBtn.closest('.recipe-card');
                        const title = card.getAttribute('data-title');
                        const steps = JSON.parse(card.getAttribute('data-steps') || '[]');
                        
                        if (steps.length === 0) return alert("Keine Anleitung vorhanden.");

                        currentSteps = steps;
                        titleEl.textContent = title;
                        container.innerHTML = '';

                        currentSteps.forEach((step, i) => {
                            const slide = document.createElement('div');
                            slide.className = 'step-slide' + (i === 0 ? ' active' : '');
                            
                            const textP = document.createElement('p');
                            textP.className = 'text-xl sm:text-2xl font-medium leading-relaxed text-slate-800 mb-8';
                            textP.innerText = step;
                            slide.appendChild(textP);

                            const time = parseTime(step);
                            if (time) {
                                const timerBtn = document.createElement('button');
                                timerBtn.className = 'mx-auto flex items-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-full font-bold text-lg shadow transition-colors';
                                timerBtn.innerHTML = '<i data-lucide="timer" class="w-6 h-6"></i> Timer: ' + time + ' Min';
                                timerBtn.onclick = () => startTimer(timerBtn, time);
                                slide.appendChild(timerBtn);
                            }

                            container.appendChild(slide);
                        });

                        overlay.classList.add('active');
                        // Ensure icons inside cooking mode are rendered
                        if (window.lucide) window.lucide.createIcons();
                        requestWakeLock();
                        showStep(0);
                    }
                });

                closeBtn.onclick = () => {
                    overlay.classList.remove('active');
                    releaseWakeLock();
                };

                prevBtn.onclick = () => {
                    if (currentStepIndex > 0) showStep(currentStepIndex - 1);
                };

                nextBtn.onclick = () => {
                    if (currentStepIndex < currentSteps.length - 1) {
                        showStep(currentStepIndex + 1);
                    } else {
                        overlay.classList.remove('active');
                        releaseWakeLock();
                    }
                };
            }

            function setupEventListeners() {
                const views = { plan: document.getElementById('view-plan'), shopping: document.getElementById('view-shopping'), recipes: document.getElementById('view-recipes') };
                const buttons = document.querySelectorAll('.nav-button[data-view]');
                buttons.forEach(button => {
                    button.addEventListener('click', () => {
                        const viewName = button.getAttribute('data-view');
                        buttons.forEach(btn => btn.classList.remove('active'));
                        button.classList.add('active');
                        Object.values(views).forEach(v => v.classList.remove('active'));
                        if (views[viewName]) views[viewName].classList.add('active');
                        window.scrollTo(0,0);
                    });
                });
                
                const shareBtn = document.getElementById('share-btn');
                if (shareBtn) {
                    shareBtn.addEventListener('click', async () => {
                        if (navigator.share) {
                            navigator.share({
                                title: document.title,
                                url: window.location.href
                            }).catch(console.error);
                        } else {
                            try {
                                await navigator.clipboard.writeText(window.location.href);
                                alert('Link in die Zwischenablage kopiert!');
                            } catch (err) {
                                console.error('Fehler beim Kopieren:', err);
                                alert('Konnte Link nicht kopieren.');
                            }
                        }
                    });
                }
                
                const path = window.location.pathname;
                const shareId = path.substring(path.lastIndexOf('/') + 1).replace('.html', '').split('?')[0];
                const storageKey = 'shoppingListState_' + shareId;

                const resetButton = document.getElementById('reset-shopping-list');
                if (resetButton) {
                    resetButton.addEventListener('click', () => {
                        if (window.confirm('Möchten Sie den Status der gesamten Einkaufsliste wirklich zurücksetzen? Alle Haken werden entfernt.')) {
                            localStorage.removeItem(storageKey);
                            location.reload();
                        }
                    });
                }
                
                let state = {};
                try { state = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch(e) { console.error('Could not parse shopping list state.'); state = {}; }

                document.querySelectorAll('.shopping-item-checkbox').forEach(checkbox => {
                    const label = checkbox.closest('label');
                    const span = label ? label.querySelector('span') : null;
                    if (!span) return;
                    
                    const itemText = span.textContent.trim();
                    
                    if (state[itemText]) {
                        checkbox.checked = true;
                        span.style.textDecoration = 'line-through';
                        span.style.color = '#94a3b8';
                    }

                    checkbox.addEventListener('change', e => {
                        let currentState = {};
                        try { currentState = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch(err) { currentState = {}; }

                        currentState[itemText] = e.target.checked;
                        localStorage.setItem(storageKey, JSON.stringify(currentState));

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
                    link.addEventListener('click', e => {
                        e.preventDefault();
                        const recipeId = link.getAttribute('href');
                        document.querySelector('.nav-button[data-view="recipes"]').click();
                        setTimeout(() => { document.querySelector(recipeId)?.scrollIntoView({ behavior: 'smooth' }); }, 50);
                    });
                });
                
                initCookingMode();
            }

            async function loadPlan() {
                const path = window.location.pathname;
                const shareId = path.substring(path.lastIndexOf('/') + 1).replace('.html', '').split('?')[0];
                console.log("Loading plan for ShareID:", shareId);
                
                try {
                    const response = await fetch('/api/public/plan/' + shareId);
                    if (!response.ok) {
                        const errText = await response.text().catch(() => '');
                        throw new Error('Serverfehler: ' + response.status + ' ' + response.statusText + ' (' + errText + ')');
                    }
                    const planData = await response.json();
                    console.log("Plan data loaded successfully:", planData);
                    
                    document.getElementById('view-plan').innerHTML = renderWeeklyPlan(planData);
                    document.getElementById('view-shopping').innerHTML = renderShoppingList(planData);
                    document.getElementById('view-recipes').innerHTML = renderRecipes(planData);
                    
                    document.getElementById('loading-state').style.display = 'none';
                    setupEventListeners();
                    
                    // Initialize Lucide icons for the dynamic content
                    if (window.lucide) window.lucide.createIcons();
                    
                } catch (error) {
                    console.error('Failed to load plan:', error);
                    document.getElementById('loading-state').style.display = 'none';
                    document.getElementById('error-state').style.display = 'block';
                    document.getElementById('error-message').innerText = 'Fehler: Der Plan konnte nicht geladen werden.';
                    document.getElementById('error-details').innerText = error.message;
                }
            }
            loadPlan();
        });
        `;
    };
    
    const clientScript = buildClientScript();
    
    const shareIconTag = '<i data-lucide="share-2" class="w-5 h-5"></i>';
    const backIconTag = '<i data-lucide="arrow-left" class="w-5 h-5"></i>';
    const closeIconTag = '<i data-lucide="x" class="w-6 h-6"></i>';

    return `<!DOCTYPE html>
<html lang="de" style="scroll-behavior: smooth;">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(planName)}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <script>
      // PROACTIVE SERVICE WORKER CLEANUP
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
          for(let registration of registrations) {
            console.log('Unregistering SW from shared page:', registration);
            registration.unregister();
          }
        });
      }
    </script>
    <style>
        body { font-family: sans-serif; background-color: #f1f5f9; }
        .view { display: none; }
        .view.active { display: block; }
        .nav-button.active { background-color: #047857; color: white; box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05); }
        .loader { border: 4px solid #f3f3f3; border-radius: 50%; border-top: 4px solid #10b981; width: 40px; height: 40px; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        
        /* Cooking Mode Styles */
        #cooking-overlay { display: none; position: fixed; inset: 0; background: white; z-index: 100; flex-direction: column; }
        #cooking-overlay.active { display: flex; }
        .step-slide { display: none; height: 100%; flex-direction: column; justify-content: center; padding: 2rem; text-align: center; overflow-y: auto; }
        .step-slide.active { display: flex; }
    </style>
</head>
<body class="bg-slate-100 text-slate-800">
    <header class="bg-white shadow-md sticky top-0 z-30">
        <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div class="flex items-center gap-4 w-full sm:w-auto justify-center sm:justify-start">
                <a href="${backLink}" class="flex items-center gap-2 text-slate-500 hover:text-emerald-600 transition-colors group" title="Zurück zum Planer">
                    <div class="p-2 bg-slate-100 rounded-full group-hover:bg-emerald-100 transition-colors">
                        ${backIconTag}
                    </div>
                    <span class="font-medium text-sm sm:hidden md:inline">Planer</span>
                </a>
                <h1 class="text-2xl font-bold text-slate-800">KI Ernährungsplaner</h1>
            </div>
            <div class="flex items-center justify-center gap-2 p-1 bg-slate-100 rounded-lg overflow-x-auto max-w-full">
                <button data-view="plan" class="nav-button active px-3 py-2 text-sm font-medium rounded-md text-slate-600 hover:bg-slate-200 whitespace-nowrap">Wochenplan</button>
                <button data-view="shopping" class="nav-button px-3 py-2 text-sm font-medium rounded-md text-slate-600 hover:bg-slate-200 whitespace-nowrap">Einkaufsliste</button>
                <button data-view="recipes" class="nav-button px-3 py-2 text-sm font-medium rounded-md text-slate-600 hover:bg-slate-200 whitespace-nowrap">Rezepte</button>
                <div class="w-px h-6 bg-slate-300 mx-1"></div>
                <button id="share-btn" class="px-3 py-2 text-sm font-medium rounded-md text-emerald-700 hover:bg-slate-200 flex items-center gap-1 whitespace-nowrap" title="Diesen Plan teilen">
                    ${shareIconTag}
                    <span class="hidden sm:inline">Teilen</span>
                </button>
            </div>
        </div>
    </header>
    <main class="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div id="view-plan" class="view active"></div>
        <div id="view-shopping" class="view"></div>
        <div id="view-recipes" class="view"></div>
        <div id="loading-state" class="text-center py-16 flex flex-col items-center justify-center">
            <div class="loader mb-4"></div>
            <p class="text-slate-600 font-semibold">Lade Ernährungsplan...</p>
        </div>
        <div id="error-state" class="text-center py-16 hidden bg-red-50 border border-red-200 rounded p-4">
            <p class="text-red-600 font-bold text-xl mb-2">Fehler beim Laden</p>
            <p class="text-slate-700 mb-2" id="error-message">Der Plan konnte nicht geladen werden.</p>
            <p class="text-xs text-slate-500 font-mono" id="error-details"></p>
            <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded text-slate-700 text-sm font-semibold">Seite neu laden</button>
        </div>
    </main>
    
    <!-- Cooking Mode Overlay -->
    <div id="cooking-overlay">
        <div class="p-4 border-b flex justify-between items-center bg-white shadow-sm z-10 shrink-0">
            <span id="cooking-title" class="font-bold text-lg truncate mr-2"></span>
            <button id="close-cooking" class="p-2 rounded-full hover:bg-slate-100 text-slate-500">
                ${closeIconTag}
            </button>
        </div>
        <div id="cooking-steps-container" class="flex-grow overflow-hidden bg-slate-50 relative">
            <!-- Steps injected here! -->
        </div>
        <div class="p-4 border-t bg-white flex justify-between items-center gap-4 z-10 shrink-0">
            <button id="prev-step" class="px-6 py-3 bg-slate-200 text-slate-700 rounded-lg font-bold disabled:opacity-50">Zurück</button>
            <span id="step-indicator" class="font-medium text-slate-500"></span>
            <button id="next-step" class="px-6 py-3 bg-emerald-600 text-white rounded-lg font-bold">Weiter</button>
        </div>
    </div>

    <script>
        ${clientScript}
    </script>
</body>
</html>`;
}

module.exports = { generateShareableHtml };
