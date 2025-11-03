import type { ShoppingList, WeeklyPlan, Recipes, MealCategory, Recipe, StructuredIngredient } from './types';

export const shoppingList: ShoppingList = [
  {
    category: "Obst & Gemüse",
    items: [
      "Frische Petersilie: 1 Bund",
      "Ingwer: 1 kleines Stück",
      "Knoblauch: 2-3 Knollen",
      "Paprika, gemischt (rot, gelb): ca. 8-9 Stück",
      "Karotten: 1 Netz (ca. 500g)",
      "Staudensellerie: 1 Packung",
      "Zucchini: 3-4 Stück",
      "Champignons: ca. 700g (frisch)",
      "Romanasalat: 1 Kopf",
      "Gurke: 1 Stück",
      "Kirschtomaten: 1 Schale (250g)",
      "Avocado: 1 Stück",
      "Limette: 1 Stück"
    ]
  },
  {
    category: "Tiefkühlprodukte",
    items: [
      "Beerenmischung: 2 Packungen (à 300-500g)"
    ]
  },
  {
    category: "Molkereiprodukte & Eier",
    items: [
      "Eier: 2 Packungen (à 10 Stück)",
      "CremeQuark (Magerstufe oder cremig): 14 Becher à 500g",
      "Feta: 3 Packungen (à 150-200g)",
      "Halloumi: 2 Packungen (à 200-250g)",
      "Kräuter-Frischkäse oder Crème fraîche: 1 Becher (200g)",
      "Milch oder Sahne: 1 kleine Packung",
      "Butter: 1 Stück",
      "Geriebener Käse (z.B. Gouda/Emmentaler): 1 Packung (100-150g)",
      "Optional: Parmesan am Stück"
    ]
  },
  {
    category: "Vegetarische Produkte",
    items: [
      "Naturtofu: 2 Packungen (à 200g)"
    ]
  },
  {
    category: "Trockensortiment & Konserven",
    items: [
      "Rote Linsen, getrocknet: 1 Packung (500g)",
      "Gehackte Tomaten in der Dose: 2 Dosen (à 400g)",
      "Passierte Tomaten: 1 Packung (500g)",
      "Kokosmilch: 1 Dose (400ml)",
      "Gemüsebrühe (Pulver oder Würfel)",
      "Konjak-Reis: 2 Packungen",
      "Konjak-Nudeln: 4 Packungen",
      "Balsamico-Essig, Sojasauce, Senf, Olivenöl"
    ]
  },
  {
    category: "Nüsse & Saaten",
    items: [
      "Walnüsse: 1 Beutel (ca. 100-150g)",
      "Mandeln: 1 Beutel (ca. 100-150g)"
    ]
  },
  {
    category: "Gewürze & Sonstiges",
    items: [
      "Salz, Pfeffer, Paprikapulver (edelsüß), Kreuzkümmel, Currypulver, Oregano, Thymian, Muskatnuss"
    ]
  }
];

export const recipes: Recipes = [
  {
    id: 1,
    category: 'dinner',
    base_persons: 2,
    title: "Große Shakshuka mit Feta und Paprika",
    ingredients: [
      { ingredient: 'Olivenöl', quantity: 1, unit: 'EL' },
      { ingredient: 'Knoblauchzehen (gehackt)', quantity: 2.5, unit: 'Stück' },
      { ingredient: 'Paprika (gemischt, in Streifen)', quantity: 3, unit: 'Stück' },
      { ingredient: 'gehackte Tomaten (2 Dosen)', quantity: 800, unit: 'g' },
      { ingredient: 'Paprikapulver', quantity: 1, unit: 'TL' },
      { ingredient: 'Kreuzkümmel', quantity: 0.5, unit: 'TL' },
      { ingredient: 'Salz, Pfeffer', quantity: 1, unit: 'Prise' },
      { ingredient: 'Eier', quantity: 4, unit: 'Stück' },
      { ingredient: 'Feta', quantity: 200, unit: 'g' },
      { ingredient: 'frische Petersilie', quantity: 1, unit: 'Bund' }
    ],
    instructions: [
      "Olivenöl in einer großen Pfanne erhitzen, Knoblauch kurz andünsten.",
      "Paprikastreifen hinzufügen und ca. 5-7 Minuten weich braten.",
      "Gehackte Tomaten und Gewürze dazugeben, 10 Min. köcheln lassen.",
      "Vier Mulden in die Sauce drücken und in jede ein Ei aufschlagen.",
      "Feta darüber bröseln, Deckel auflegen und 5-8 Min. bei schwacher Hitze stocken lassen. Mit frischer Petersilie servieren."
    ],
    totalCalories: 950
  },
  {
    id: 2,
    category: 'dinner',
    base_persons: 2,
    title: "Tofu-Curry-Pfanne mit Paprika & Zucchini",
    ingredients: [
      { ingredient: 'Naturtofu', quantity: 400, unit: 'g' },
      { ingredient: 'Sojasauce', quantity: 1, unit: 'EL' },
      { ingredient: 'Olivenöl', quantity: 1, unit: 'EL' },
      { ingredient: 'Knoblauchzehen (gehackt)', quantity: 1.5, unit: 'Stück' },
      { ingredient: 'Ingwer (ca. 2 cm, gerieben)', quantity: 1, unit: 'Stück' },
      { ingredient: 'Currypulver', quantity: 2, unit: 'TL' },
      { ingredient: 'Kokosmilch', quantity: 400, unit: 'ml' },
      { ingredient: 'rote Paprika (in Streifen)', quantity: 1, unit: 'Stück' },
      { ingredient: 'Zucchini (in Würfeln)', quantity: 1, unit: 'Stück' },
      { ingredient: 'Saft einer halben Limette', quantity: 0.5, unit: 'Stück' },
      { ingredient: 'Salz, Pfeffer', quantity: 1, unit: 'Prise' },
      { ingredient: 'Konjak-Reis', quantity: 2, unit: 'Packungen' }
    ],
    instructions: [
      "Tofu trocken pressen, würfeln und mit Sojasauce marinieren. Konjak-Reis nach Packungsanweisung vorbereiten.",
      "Öl erhitzen, Tofuwürfel goldbraun anbraten und beiseitestellen.",
      "Knoblauch, Ingwer, Paprika und Zucchini in der Pfanne 5-7 Minuten anbraten.",
      "Currypulver kurz mitrösten, mit Kokosmilch ablöschen und aufkochen.",
      "Tofu wieder zugeben, mit Limettensaft, Salz und Pfeffer abschmecken und mit dem Konjak-Reis servieren."
    ],
    totalCalories: 900
  },
  {
    id: 3,
    category: 'dinner',
    base_persons: 2,
    title: "Linsen-Bolognese mit Konjak-Nudeln",
    ingredients: [
      { ingredient: 'Konjak-Nudeln', quantity: 2, unit: 'Packungen' },
      { ingredient: 'Olivenöl', quantity: 1, unit: 'EL' },
      { ingredient: 'Karotten (fein gewürfelt)', quantity: 1.5, unit: 'Stück' },
      { ingredient: 'Stangen Staudensellerie (fein gewürfelt)', quantity: 2, unit: 'Stück' },
      { ingredient: 'Knoblauchzehen (gehackt)', quantity: 2, unit: 'Stück' },
      { ingredient: 'rote Linsen (trocken)', quantity: 150, unit: 'g' },
      { ingredient: 'passierte Tomaten', quantity: 500, unit: 'g' },
      { ingredient: 'Gemüsebrühe', quantity: 200, unit: 'ml' },
      { ingredient: 'getrockneter Oregano', quantity: 1, unit: 'TL' },
      { ingredient: 'Salz, Pfeffer', quantity: 1, unit: 'Prise' }
    ],
    instructions: [
      "Konjak-Nudeln vorbereiten.",
      "Öl erhitzen, Karotten und Sellerie 5 Minuten andünsten. Knoblauch kurz mitbraten.",
      "Linsen, Tomaten, Brühe und Oregano zugeben, aufkochen lassen.",
      "Bei schwacher Hitze 15-20 Minuten köcheln, bis die Linsen gar sind. Abschmecken und mit den Nudeln servieren."
    ],
    totalCalories: 850
  },
  {
    id: 4,
    category: 'dinner',
    base_persons: 2,
    title: "Gebratener Halloumi auf großem Salat",
    ingredients: [
      { ingredient: 'Halloumi', quantity: 400, unit: 'g' },
      { ingredient: 'Olivenöl', quantity: 1, unit: 'EL' },
      { ingredient: 'Kopf Romanasalat', quantity: 1, unit: 'Stück' },
      { ingredient: 'Gurke', quantity: 1, unit: 'Stück' },
      { ingredient: 'Kirschtomaten', quantity: 250, unit: 'g' },
      { ingredient: 'rote Paprika', quantity: 1, unit: 'Stück' },
      { ingredient: 'Avocado', quantity: 1, unit: 'Stück' },
      { ingredient: 'Dressing: Olivenöl', quantity: 4, unit: 'EL' },
      { ingredient: 'Dressing: Balsamico', quantity: 2, unit: 'EL' },
      { ingredient: 'Dressing: Senf', quantity: 1, unit: 'TL' },
      { ingredient: 'Dressing: Salz, Pfeffer', quantity: 1, unit: 'Prise' }
    ],
    instructions: [
      "Salat und Gemüse waschen und mundgerecht schneiden.",
      "Für das Dressing alle Zutaten gut verquirlen.",
      "Halloumi in ca. 1 cm dicke Scheiben schneiden und in Olivenöl von beiden Seiten goldbraun braten.",
      "Salat mit dem Dressing mischen und den warmen Halloumi darauf anrichten."
    ],
    totalCalories: 980
  },
  {
    id: 5,
    category: 'dinner',
    base_persons: 2,
    title: "Cremige Champignon-Pfanne mit Konjak-Nudeln",
    ingredients: [
      { ingredient: 'Konjak-Nudeln', quantity: 2, unit: 'Packungen' },
      { ingredient: 'Butter oder Olivenöl', quantity: 1, unit: 'EL' },
      { ingredient: 'Champignons (in Scheiben)', quantity: 500, unit: 'g' },
      { ingredient: 'Knoblauchzehen (gehackt)', quantity: 2, unit: 'Stück' },
      { ingredient: 'Kräuter-Frischkäse oder Crème fraîche', quantity: 200, unit: 'g' },
      { ingredient: 'Gemüsebrühe', quantity: 100, unit: 'ml' },
      { ingredient: 'Salz, Pfeffer', quantity: 1, unit: 'Prise' },
      { ingredient: 'frische Petersilie', quantity: 1, unit: 'Bund' }
    ],
    instructions: [
      "Konjak-Nudeln vorbereiten.",
      "Butter/Öl erhitzen. Champignons darin goldbraun anbraten. Knoblauch kurz mitbraten.",
      "Frischkäse und Gemüsebrühe einrühren, bis eine cremige Sauce entsteht. Abschmecken.",
      "Nudeln in die Sauce geben, gut vermischen und mit Petersilie servieren."
    ],
    totalCalories: 880
  },
  {
    id: 6,
    category: 'dinner',
    base_persons: 2,
    title: "Gefüllte Paprika mit Linsen & Feta",
    ingredients: [
      { ingredient: 'große Paprika', quantity: 4, unit: 'Stück' },
      { ingredient: 'rote Linsen (trocken)', quantity: 100, unit: 'g' },
      { ingredient: 'Gemüsebrühe', quantity: 300, unit: 'ml' },
      { ingredient: 'Karotte (fein gerieben)', quantity: 1, unit: 'Stück' },
      { ingredient: 'Zucchini (fein gewürfelt)', quantity: 1, unit: 'Stück' },
      { ingredient: 'Feta', quantity: 150, unit: 'g' },
      { ingredient: 'Salz, Pfeffer', quantity: 1, unit: 'Prise' },
      { ingredient: 'getrocknete Kräuter (Thymian, Oregano)', quantity: 1, unit: 'TL' }
    ],
    instructions: [
      "Backofen auf 180°C Umluft vorheizen.",
      "Linsen in der Gemüsebrühe nach Packungsanweisung kochen.",
      "Paprika waschen, Deckel abschneiden und Kerngehäuse entfernen.",
      "Gekochte Linsen mit geriebener Karotte, Zucchiniwürfeln und zerbröseltem Feta mischen. Kräftig würzen.",
      "Paprika füllen, Deckel aufsetzen und im Ofen ca. 25-30 Minuten backen, bis die Paprika weich ist."
    ],
    totalCalories: 920
  },
  {
    id: 7,
    category: 'dinner',
    base_persons: 2,
    title: "Großes Gemüse-Omelett aus der Pfanne",
    ingredients: [
      { ingredient: 'Eier', quantity: 7, unit: 'Stück' },
      { ingredient: 'Milch oder Sahne', quantity: 100, unit: 'ml' },
      { ingredient: 'Salz, Pfeffer, Muskatnuss', quantity: 1, unit: 'Prise' },
      { ingredient: 'Olivenöl', quantity: 1, unit: 'EL' },
      { ingredient: 'Champignons (in Scheiben)', quantity: 200, unit: 'g' },
      { ingredient: 'Zucchini (gewürfelt)', quantity: 1, unit: 'Stück' },
      { ingredient: 'rote Paprika (gewürfelt)', quantity: 1, unit: 'Stück' },
      { ingredient: 'geriebener Käse', quantity: 100, unit: 'g' }
    ],
    instructions: [
      "Eier mit Milch und Gewürzen verquirlen.",
      "Öl in einer großen, ofenfesten Pfanne erhitzen. Gemüse darin anbraten, bis es gar ist.",
      "Eiermasse über das Gemüse gießen und den Käse darüber streuen.",
      "Bei mittlerer Hitze stocken lassen. Anschließend entweder mit Deckel bei schwacher Hitze fertig garen oder für 5-10 Minuten im auf 180°C vorgeheizten Backofen überbacken."
    ],
    totalCalories: 900
  }
];

const breakfastRecipes: { [key: string]: Recipe } = {
  beeren: { id: 101, title: 'CremeQuark mit Beerenmix', ingredients: [{ ingredient: 'CremeQuark', quantity: 500, unit: 'g' }, { ingredient: 'Beerenmix', quantity: 75, unit: 'g' }], instructions: ['Zutaten mischen.'], totalCalories: 450, category: 'breakfast', base_persons: 1 },
  walnuss: { id: 102, title: 'CremeQuark mit Walnüssen', ingredients: [{ ingredient: 'CremeQuark', quantity: 500, unit: 'g' }, { ingredient: 'Walnüsse', quantity: 25, unit: 'g' }], instructions: ['Zutaten mischen.'], totalCalories: 550, category: 'breakfast', base_persons: 1 },
  mandel: { id: 103, title: 'CremeQuark mit Mandeln', ingredients: [{ ingredient: 'CremeQuark', quantity: 500, unit: 'g' }, { ingredient: 'Mandeln', quantity: 25, unit: 'g' }], instructions: ['Zutaten mischen.'], totalCalories: 530, category: 'breakfast', base_persons: 1 },
};

export const weeklyPlan: WeeklyPlan = [
  { day: "Montag", meals: [{ mealType: 'breakfast', recipe: breakfastRecipes.beeren }, { mealType: 'dinner', recipe: recipes[0] }], totalCalories: 450 + 950 },
  { day: "Dienstag", meals: [{ mealType: 'breakfast', recipe: breakfastRecipes.walnuss }, { mealType: 'dinner', recipe: recipes[1] }], totalCalories: 550 + 900 },
  { day: "Mittwoch", meals: [{ mealType: 'breakfast', recipe: breakfastRecipes.beeren }, { mealType: 'dinner', recipe: recipes[2] }], totalCalories: 450 + 850 },
  { day: "Donnerstag", meals: [{ mealType: 'breakfast', recipe: breakfastRecipes.mandel }, { mealType: 'dinner', recipe: recipes[3] }], totalCalories: 530 + 980 },
  { day: "Freitag", meals: [{ mealType: 'breakfast', recipe: breakfastRecipes.beeren }, { mealType: 'dinner', recipe: recipes[4] }], totalCalories: 450 + 880 },
  { day: "Samstag", meals: [{ mealType: 'breakfast', recipe: breakfastRecipes.walnuss }, { mealType: 'dinner', recipe: recipes[5] }], totalCalories: 550 + 920 },
  { day: "Sonntag", meals: [{ mealType: 'breakfast', recipe: breakfastRecipes.beeren }, { mealType: 'dinner', recipe: recipes[6] }], totalCalories: 450 + 900 }
];