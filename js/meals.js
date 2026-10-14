// Craft services: meal cards with macros computed from ingredient weights, scaled to your calorie target.
// Ingredient values are per 100 g (raw/dry unless stated), from UK labels / USDA FoodData Central.
export const ING = {
  oats: { n: "Rolled oats", k: 379, p: 13.2, c: 67.7, f: 6.5 },
  whey: { n: "Whey protein", k: 400, p: 78, c: 8, f: 6 },
  milk: { n: "Semi-skimmed milk", k: 50, p: 3.6, c: 4.8, f: 1.8, ml: true },
  banana: { n: "Banana", k: 89, p: 1.1, c: 22.8, f: 0.3 },
  berries: { n: "Frozen mixed berries", k: 50, p: 0.7, c: 12, f: 0.3 },
  yog: { n: "0% Greek yoghurt", k: 59, p: 10.3, c: 3.6, f: 0.4 },
  egg: { n: "Egg", k: 143, p: 12.6, c: 0.7, f: 9.5, each: 58 },
  whites: { n: "Liquid egg whites", k: 52, p: 10.9, c: 0.7, f: 0.2, ml: true },
  sourdough: { n: "Sourdough bread", k: 272, p: 10.8, c: 51.9, f: 2.4 },
  wholemeal: { n: "Wholemeal bread", k: 250, p: 12.5, c: 43, f: 3.5 },
  bagel: { n: "Plain bagel", k: 257, p: 10, c: 50, f: 1.6, each: 85 },
  wrap: { n: "Wholemeal wrap", k: 300, p: 9, c: 48, f: 7, each: 62 },
  pitta: { n: "Wholemeal pitta", k: 266, p: 9.8, c: 55, f: 1.7, each: 60 },
  avocado: { n: "Avocado", k: 160, p: 2, c: 8.5, f: 14.7 },
  salmonSm: { n: "Smoked salmon", k: 117, p: 18.3, c: 0, f: 4.3 },
  softCheese: { n: "Light soft cheese", k: 147, p: 7.4, c: 4, f: 11 },
  cucumber: { n: "Cucumber", k: 15, p: 0.7, c: 3.6, f: 0.1 },
  chicken: { n: "Chicken breast", k: 120, p: 22.5, c: 0, f: 2.6 },
  beef5: { n: "5% beef mince", k: 130, p: 21, c: 0, f: 5 },
  turkey: { n: "2% turkey mince", k: 115, p: 23, c: 0, f: 2 },
  steak: { n: "Lean rump steak", k: 125, p: 22, c: 0, f: 4 },
  salmon: { n: "Salmon fillet", k: 208, p: 20, c: 0, f: 13.4 },
  cod: { n: "Cod fillet", k: 82, p: 17.8, c: 0, f: 0.7 },
  prawns: { n: "Cooked king prawns", k: 99, p: 24, c: 0.2, f: 0.3 },
  tuna: { n: "Tuna in spring water (drained)", k: 116, p: 25.5, c: 0, f: 0.8 },
  pork: { n: "Pork tenderloin", k: 120, p: 21, c: 0, f: 3.5 },
  tofu: { n: "Firm tofu", k: 144, p: 17.3, c: 2.8, f: 8.7 },
  rice: { n: "Basmati rice (dry)", k: 355, p: 7.5, c: 78, f: 1 },
  pasta: { n: "Pasta (dry)", k: 371, p: 13, c: 75, f: 1.5 },
  noodles: { n: "Egg noodles (dry)", k: 384, p: 14, c: 71, f: 4.4 },
  potato: { n: "Potatoes", k: 77, p: 2, c: 17, f: 0.1 },
  sweetpot: { n: "Sweet potato", k: 86, p: 1.6, c: 20, f: 0.1 },
  lentils: { n: "Red lentils (dry)", k: 352, p: 24.6, c: 63, f: 1.1 },
  broccoli: { n: "Tenderstem broccoli", k: 34, p: 2.8, c: 6.6, f: 0.4 },
  spinach: { n: "Spinach", k: 23, p: 2.9, c: 3.6, f: 0.4 },
  peppers: { n: "Mixed peppers", k: 26, p: 1, c: 6, f: 0.3 },
  onion: { n: "Onion", k: 40, p: 1.1, c: 9.3, f: 0.1 },
  mushrooms: { n: "Mushrooms", k: 22, p: 3.1, c: 3.3, f: 0.3 },
  tomatoes: { n: "Cherry tomatoes", k: 18, p: 0.9, c: 3.9, f: 0.2 },
  chopped: { n: "Chopped tomatoes (tin)", k: 24, p: 1.2, c: 4, f: 0.2 },
  stirfry: { n: "Stir-fry veg mix", k: 30, p: 1.8, c: 5, f: 0.3 },
  salad: { n: "Mixed salad leaves", k: 17, p: 1.3, c: 2.8, f: 0.2 },
  kidney: { n: "Kidney beans (tin, drained)", k: 127, p: 8.7, c: 22.8, f: 0.5 },
  blackbeans: { n: "Black beans (tin, drained)", k: 132, p: 8.9, c: 23.7, f: 0.5 },
  chickpeas: { n: "Chickpeas (tin, drained)", k: 139, p: 7, c: 22.5, f: 2.8 },
  edamame: { n: "Edamame beans", k: 121, p: 11.9, c: 8.9, f: 5.2 },
  oil: { n: "Olive oil", k: 884, p: 0, c: 0, f: 100 },
  pb: { n: "Peanut butter", k: 588, p: 25, c: 20, f: 50 },
  almonds: { n: "Almonds", k: 579, p: 21, c: 22, f: 50 },
  chia: { n: "Chia seeds", k: 486, p: 16.5, c: 42, f: 30.7 },
  honey: { n: "Honey", k: 304, p: 0.3, c: 82, f: 0 },
  granola: { n: "Granola", k: 471, p: 10, c: 64, f: 20 },
  cheddar: { n: "Mature cheddar", k: 403, p: 25, c: 1.3, f: 33 },
  feta: { n: "Feta", k: 264, p: 14.2, c: 4.1, f: 21.3 },
  parmesan: { n: "Parmesan", k: 392, p: 35.8, c: 3.2, f: 25.8 },
  cottage: { n: "Cottage cheese", k: 81, p: 10.5, c: 4.8, f: 2.3 },
  pesto: { n: "Green pesto", k: 430, p: 5, c: 6, f: 43 },
  soy: { n: "Soy sauce", k: 53, p: 8, c: 4.9, f: 0.6, ml: true },
  coconut: { n: "Light coconut milk", k: 75, p: 0.7, c: 2, f: 7, ml: true },
  currypaste: { n: "Thai green curry paste", k: 100, p: 2, c: 8, f: 6 },
  salsa: { n: "Tomato salsa", k: 36, p: 1.5, c: 7, f: 0.2 },
  hummus: { n: "Hummus", k: 166, p: 7.9, c: 14.3, f: 9.6 },
  pineapple: { n: "Pineapple", k: 50, p: 0.5, c: 13, f: 0.1 },
  apple: { n: "Apple", k: 52, p: 0.3, c: 14, f: 0.2, each: 180 },
  ricecakes: { n: "Rice cake", k: 387, p: 8, c: 81, f: 2.8, each: 8 },
  jerky: { n: "Beef jerky", k: 410, p: 33, c: 11, f: 25.6 },
  choc: { n: "70% dark chocolate", k: 598, p: 7.8, c: 45.9, f: 42.6 },
  carrots: { n: "Carrot sticks", k: 41, p: 0.9, c: 9.6, f: 0.2 },
};

// [ingredient, grams]. `fixed` ingredients (spices, sauces, veg) don't scale with portion size.
export const MEALS = [
  // ---- breakfast ----
  { id: "oats", slot: "breakfast", name: "Overnight protein oats", mins: 5, tags: ["prep the night before", "high protein"],
    items: [["oats", 80], ["whey", 30], ["milk", 250], ["yog", 100], ["berries", 80], ["chia", 10]],
    method: "Stir everything except the berries in a jar, top with the berries, and fridge it overnight. Grab it on the way out." },
  { id: "eggs", slot: "breakfast", name: "Big-guy eggs on sourdough", mins: 10, tags: ["hot", "high protein"],
    items: [["egg", 174], ["whites", 150], ["sourdough", 100], ["spinach", 60], ["tomatoes", 80], ["oil", 5]],
    method: "Wilt the spinach in the oil, then scramble the eggs and whites low and slow. Serve on toasted sourdough with the tomatoes halved." },
  { id: "yogbowl", slot: "breakfast", name: "Greek yoghurt power bowl", mins: 3, tags: ["no cook", "high protein"],
    items: [["yog", 300], ["granola", 50], ["berries", 100], ["honey", 10], ["whey", 15]],
    method: "Whisk the whey into the yoghurt, then top with granola, berries and a drizzle of honey." },
  { id: "bagel", slot: "breakfast", name: "Smoked salmon bagel", mins: 5, tags: ["no cook", "omega-3"],
    items: [["bagel", 85], ["softCheese", 40], ["salmonSm", 100], ["cucumber", 50], ["egg", 58]],
    method: "Toast the bagel, spread with the soft cheese, then layer salmon and cucumber. Have a boiled egg on the side." },
  { id: "pancakes", slot: "breakfast", name: "Banana protein pancakes", mins: 15, tags: ["weekend", "sweet"],
    items: [["oats", 60], ["egg", 116], ["banana", 120], ["whey", 30], ["milk", 100], ["yog", 100], ["berries", 60]],
    method: "Blitz the oats, eggs, banana, whey and milk into a batter. Cook palm-sized pancakes in a non-stick pan, then top with yoghurt and berries." },
  { id: "burrito", slot: "breakfast", name: "Breakfast burrito", mins: 12, tags: ["hot", "grab & go"],
    items: [["wrap", 62], ["egg", 116], ["whites", 100], ["blackbeans", 80], ["cheddar", 20], ["salsa", 40], ["peppers", 60]],
    method: "Soften the peppers, add the beans, then scramble in the eggs and whites. Wrap with cheddar and salsa, and toast seam-side down." },
  // ---- lunch ----
  { id: "pestopasta", slot: "lunch", name: "Chicken pesto pasta", mins: 20, tags: ["batch cook", "pre-gym"],
    items: [["pasta", 100], ["chicken", 180], ["pesto", 25], ["tomatoes", 100], ["spinach", 50], ["parmesan", 10]],
    method: "Cook the pasta. Pan-fry the sliced chicken, then toss everything together with the pesto, halved tomatoes and spinach. It holds well for 3 days in the fridge." },
  { id: "tunasalad", slot: "lunch", name: "Tuna & chickpea crunch salad", mins: 8, tags: ["no cook", "light"],
    items: [["tuna", 145], ["chickpeas", 120], ["cucumber", 100], ["tomatoes", 100], ["feta", 30], ["oil", 10], ["pitta", 60]],
    method: "Chop and toss everything with the olive oil and a squeeze of lemon. Have a toasted pitta on the side for scooping." },
  { id: "burritobowl", slot: "lunch", name: "Chicken burrito bowl", mins: 25, tags: ["batch cook", "high carb"],
    items: [["rice", 80], ["chicken", 180], ["blackbeans", 100], ["peppers", 100], ["salsa", 60], ["avocado", 50]],
    method: "Season the chicken with paprika, cumin and garlic, then grill it. Serve over rice with beans, charred peppers, salsa and sliced avocado." },
  { id: "chilli", slot: "lunch", name: "Turkey chilli & rice", mins: 35, tags: ["batch cook", "freezes well"],
    items: [["turkey", 200], ["kidney", 100], ["chopped", 200], ["onion", 60], ["peppers", 80], ["rice", 75]],
    method: "Brown the turkey with the onion and peppers, add chilli powder, cumin, the tomatoes and beans, and simmer for 20 minutes. Make four portions at once." },
  { id: "prawnnoodles", slot: "lunch", name: "Prawn teriyaki noodles", mins: 12, tags: ["quick", "high protein"],
    items: [["noodles", 75], ["prawns", 180], ["stirfry", 200], ["edamame", 60], ["soy", 20], ["honey", 10]],
    method: "Boil the noodles. Stir-fry the veg and edamame, add the prawns, then toss everything with soy, honey and a little ginger." },
  { id: "jacket", slot: "lunch", name: "Jacket potato, tuna & cottage cheese", mins: 10, tags: ["microwave", "office-friendly"],
    items: [["potato", 350], ["tuna", 120], ["cottage", 150], ["salad", 60], ["tomatoes", 80]],
    method: "Microwave the potato for 8–10 minutes, turning once. Split it, then load with tuna and cottage cheese, with salad on the side." },
  // ---- dinner ----
  { id: "salmonsweet", slot: "dinner", name: "Salmon, sweet potato & greens", mins: 25, tags: ["omega-3", "tray bake"],
    items: [["salmon", 180], ["sweetpot", 300], ["broccoli", 150], ["oil", 5]],
    method: "Roast sweet potato wedges at 200°C for 25 minutes, adding the salmon and broccoli for the last 12. Finish with lemon." },
  { id: "bolognese", slot: "dinner", name: "Lean beef bolognese", mins: 30, tags: ["batch cook", "comfort"],
    items: [["beef5", 200], ["pasta", 100], ["chopped", 200], ["onion", 60], ["mushrooms", 80], ["parmesan", 10]],
    method: "Brown the mince with the onion and mushrooms, add the tomatoes and herbs, and simmer for 20 minutes. Serve on pasta with parmesan." },
  { id: "greencurry", slot: "dinner", name: "Thai green chicken curry", mins: 25, tags: ["fakeaway", "batch cook"],
    items: [["chicken", 200], ["coconut", 120], ["currypaste", 25], ["stirfry", 150], ["rice", 80]],
    method: "Fry the paste for a minute, add the chicken and brown it, then pour in the coconut milk and veg. Simmer for 10 minutes and serve on rice." },
  { id: "steakstir", slot: "dinner", name: "Steak stir-fry", mins: 15, tags: ["quick", "iron"],
    items: [["steak", 200], ["noodles", 75], ["stirfry", 200], ["soy", 20], ["oil", 5]],
    method: "Sear thin strips of steak in a smoking-hot wok and set aside. Stir-fry the veg, then add the noodles, steak and soy." },
  { id: "cod", slot: "dinner", name: "Crispy cod, new potatoes & beans", mins: 25, tags: ["lean", "light"],
    items: [["cod", 220], ["potato", 300], ["broccoli", 150], ["oil", 8]],
    method: "Boil the potatoes. Pan-fry the cod skin-side down in the oil until crisp, then flip for a minute. Steam the greens." },
  { id: "dal", slot: "dinner", name: "Tofu & red lentil dal", mins: 30, tags: ["plant-based", "batch cook"],
    items: [["lentils", 80], ["tofu", 150], ["chopped", 150], ["spinach", 80], ["onion", 60], ["rice", 60], ["oil", 5]],
    method: "Soften the onion with garam masala and turmeric, add the lentils, tomatoes and 400 ml water, and simmer for 20 minutes. Stir in the spinach, then top with crispy pan-fried tofu." },
  { id: "pork", slot: "dinner", name: "Pork tenderloin & roast potatoes", mins: 35, tags: ["Sunday", "roast"],
    items: [["pork", 200], ["potato", 300], ["carrots", 120], ["broccoli", 100], ["oil", 10]],
    method: "Roast the potatoes in the oil at 200°C for 35 minutes. Sear the pork, then roast it for 15–18 minutes and rest it for 5. Steam the veg." },
  { id: "runclub", slot: "dinner", name: "Run-club recovery wrap", mins: 5, tags: ["Wednesday", "late night"],
    items: [["wrap", 124], ["chicken", 150], ["hummus", 40], ["salad", 50], ["peppers", 60]],
    method: "Pre-cooked chicken from the batch, two wraps, hummus and salad. On the plate within 5 minutes of getting home from run club." },
  // ---- snacks ----
  { id: "cottagepine", slot: "snack", name: "Cottage cheese & pineapple", mins: 1, tags: ["no cook", "casein"],
    items: [["cottage", 250], ["pineapple", 100]], method: "Spoon, eat. Slow-digesting protein: a great one before bed." },
  { id: "shake", slot: "snack", name: "Protein shake & banana", mins: 1, tags: ["post-workout"],
    items: [["whey", 30], ["milk", 300], ["banana", 120]], method: "Shake it up, ideally within a couple of hours of training." },
  { id: "ricecakes", slot: "snack", name: "Rice cakes & peanut butter", mins: 2, tags: ["pre-gym", "quick carbs"],
    items: [["ricecakes", 24], ["pb", 20], ["banana", 60]], method: "Three rice cakes, a thin layer of peanut butter and sliced banana. Perfect 60–90 minutes before lifting." },
  { id: "yogberries", slot: "snack", name: "Greek yoghurt & berries", mins: 2, tags: ["no cook", "high protein"],
    items: [["yog", 250], ["berries", 100], ["honey", 5]], method: "Stir and go." },
  { id: "jerky", slot: "snack", name: "Jerky, apple & almonds", mins: 0, tags: ["on the go", "filming days"],
    items: [["jerky", 40], ["apple", 180], ["almonds", 15]], method: "Bag it, take it to the shoot." },
  { id: "hummus", slot: "snack", name: "Hummus, pitta & crunch", mins: 3, tags: ["savoury"],
    items: [["hummus", 60], ["pitta", 60], ["carrots", 100], ["cucumber", 80]], method: "Slice the veg and toast the pitta." },
  { id: "chocyog", slot: "snack", name: "Chocolate protein pot", mins: 2, tags: ["sweet tooth"],
    items: [["yog", 200], ["whey", 20], ["choc", 10]], method: "Whisk chocolate whey into the yoghurt and grate the dark chocolate on top. Dessert, sorted." },
];

export const SLOTS = [
  { key: "breakfast", name: "Breakfast", share: 0.25 },
  { key: "lunch", name: "Lunch", share: 0.3 },
  { key: "dinner", name: "Dinner", share: 0.32 },
  { key: "snack", name: "Snack", share: 0.13 },
];

// Veg, sauces, oil, spices: keep fixed so scaling a portion doesn't, e.g., halve your broccoli.
const FIXED = new Set(["spinach", "tomatoes", "cucumber", "broccoli", "peppers", "onion", "mushrooms", "chopped", "stirfry", "salad", "carrots", "soy", "salsa", "currypaste", "honey", "oil", "egg", "wrap", "bagel", "pitta", "apple", "ricecakes"]);

export function macros(items) {
  const t = { k: 0, p: 0, c: 0, f: 0 };
  for (const [key, g] of items) { const i = ING[key]; for (const m of ["k", "p", "c", "f"]) t[m] += (i[m] * g) / 100; }
  return { kcal: Math.round(t.k), p: Math.round(t.p), c: Math.round(t.c), f: Math.round(t.f) };
}

// Scale a meal towards `kcal`, keeping fixed items and rounding sensibly (between 0.6× and 1.8×).
export function scaleMeal(meal, kcal) {
  const base = macros(meal.items);
  const fixedK = macros(meal.items.filter(([k]) => FIXED.has(k))).kcal;
  const flexK = base.kcal - fixedK;
  const factor = flexK > 0 ? Math.min(1.8, Math.max(0.6, (kcal - fixedK) / flexK)) : 1;
  const items = meal.items.map(([k, g]) => {
    if (FIXED.has(k)) return [k, g];
    const step = g * factor < 40 ? 5 : 10;
    return [k, Math.max(step, Math.round((g * factor) / step) * step)];
  });
  return { ...meal, items, factor, ...macros(items) };
}

export function portion([key, g]) {
  const i = ING[key];
  if (i.each) {
    const n = Math.round((g / i.each) * 2) / 2;
    if (n >= 0.5 && Math.abs(g / i.each - n) < 0.15) return `${n} × ${i.n.toLowerCase()}${n > 1 ? "s" : ""}`;
  }
  return `${g} ${i.ml ? "ml" : "g"} ${i.n.toLowerCase()}`;
}

// A deterministic daily plan (seeded by date), with per-slot overrides from shuffles.
export function dayPlan(date, kcal, overrides = {}, isRunDay = false) {
  let seed = [...date].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
  return SLOTS.map((s) => {
    const options = MEALS.filter((m) => m.slot === s.key);
    let meal = options.find((m) => m.id === overrides[s.key]);
    if (!meal && s.key === "dinner" && isRunDay) meal = options.find((m) => m.id === "runclub");
    if (!meal) meal = options[Math.floor(rand() * options.length)];
    return { slot: s, meal: scaleMeal(meal, Math.round(kcal * s.share)) };
  });
}

export function nextOption(slotKey, currentId) {
  const options = MEALS.filter((m) => m.slot === slotKey);
  const i = options.findIndex((m) => m.id === currentId);
  return options[(i + 1) % options.length].id;
}
