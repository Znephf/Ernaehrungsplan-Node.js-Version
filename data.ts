import type { ShoppingList, WeeklyPlan, Recipes } from './types';

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

export const weeklyPlan: WeeklyPlan = [
  { day: "Montag", breakfast: "500g CremeQuark mit 75g Beerenmix.", breakfastCalories: 450, dinner: "Große Shakshuka mit Feta und Paprika.", dinnerCalories: 950 },
  { day: "Dienstag", breakfast: "500g CremeQuark mit 25g Walnüssen.", breakfastCalories: 550, dinner: "Tofu-Curry-Pfanne mit Paprika, Zucchini und Konjak-Reis.", dinnerCalories: 900 },
  { day: "Mittwoch", breakfast: "500g CremeQuark mit 75g Beerenmix.", breakfastCalories: 450, dinner: "Linsen-Bolognese mit Konjak-Nudeln.", dinnerCalories: 850 },
  { day: "Donnerstag", breakfast: "500g CremeQuark mit 25g Mandeln.", breakfastCalories: 530, dinner: "Gebratener Halloumi auf einem großen bunten Salat.", dinnerCalories: 980 },
  { day: "Freitag", breakfast: "500g CremeQuark mit 75g Beerenmix.", breakfastCalories: 450, dinner: "Cremige Champignon-Pfanne mit Konjak-Nudeln.", dinnerCalories: 880 },
  { day: "Samstag", breakfast: "500g CremeQuark mit 25g Walnüssen.", breakfastCalories: 550, dinner: "Gefüllte Paprika mit Linsen und Feta.", dinnerCalories: 920 },
  { day: "Sonntag", breakfast: "500g CremeQuark mit 75g Beerenmix.", breakfastCalories: 450, dinner: "Großes Gemüse-Omelett aus der Pfanne.", dinnerCalories: 900 }
];

export const recipes: Recipes = [
  {
    day: "Montag",
    title: "Große Shakshuka mit Feta und Paprika",
    ingredients: [
      "1 EL Olivenöl", "2-3 Knoblauchzehen (gehackt)", "3 Paprika (gemischt, in Streifen)",
      "800g gehackte Tomaten (2 Dosen)", "1 TL Paprikapulver", "1/2 TL Kreuzkümmel",
      "Salz, Pfeffer", "4 Eier", "200g Feta", "frische Petersilie"
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
    day: "Dienstag",
    title: "Tofu-Curry-Pfanne mit Paprika & Zucchini",
    ingredients: [
      "400g Naturtofu", "1 EL Sojasauce", "1 EL Olivenöl", "1-2 Knoblauchzehen (gehackt)",
      "1 Stück Ingwer (ca. 2 cm, gerieben)", "2 TL Currypulver", "400ml Kokosmilch",
      "1 rote Paprika (in Streifen)", "1 Zucchini (in Würfeln)", "Saft einer halben Limette",
      "Salz, Pfeffer", "2 Packungen Konjak-Reis"
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
    day: "Mittwoch",
    title: "Linsen-Bolognese mit Konjak-Nudeln",
    ingredients: [
      "2 Packungen Konjak-Nudeln", "1 EL Olivenöl", "1-2 Karotten (fein gewürfelt)",
      "2 Stangen Staudensellerie (fein gewürfelt)", "2 Knoblauchzehen (gehackt)",
      "150g rote Linsen (trocken)", "500g passierte Tomaten", "200ml Gemüsebrühe",
      "1 TL getrockneter Oregano", "Salz, Pfeffer"
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
    day: "Donnerstag",
    title: "Gebratener Halloumi auf großem Salat",
    ingredients: [
      "400g Halloumi", "1 EL Olivenöl", "1 Kopf Romanasalat", "1 Gurke",
      "250g Kirschtomaten", "1 rote Paprika", "1 Avocado",
      "Für das Dressing: 4 EL Olivenöl, 2 EL Balsamico, 1 TL Senf, Salz, Pfeffer"
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
    day: "Freitag",
    title: "Cremige Champignon-Pfanne mit Konjak-Nudeln",
    ingredients: [
      "2 Packungen Konjak-Nudeln", "1 EL Butter oder Olivenöl", "500g Champignons (in Scheiben)",
      "2 Knoblauchzehen (gehackt)", "200g Kräuter-Frischkäse oder Crème fraîche",
      "100ml Gemüsebrühe", "Salz, Pfeffer", "frische Petersilie"
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
    day: "Samstag",
    title: "Gefüllte Paprika mit Linsen & Feta",
    ingredients: [
      "4 große Paprika", "100g rote Linsen (trocken)", "300ml Gemüsebrühe",
      "1 Karotte (fein gerieben)", "1 Zucchini (fein gewürfelt)", "150g Feta",
      "Salz, Pfeffer", "getrocknete Kräuter (Thymian, Oregano)"
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
    day: "Sonntag",
    title: "Großes Gemüse-Omelett aus der Pfanne",
    ingredients: [
      "6-8 Eier", "100ml Milch oder Sahne", "Salz, Pfeffer, Muskatnuss", "1 EL Olivenöl",
      "200g Champignons (in Scheiben)", "1 Zucchini (gewürfelt)", "1 rote Paprika (gewürfelt)",
      "100g geriebener Käse"
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