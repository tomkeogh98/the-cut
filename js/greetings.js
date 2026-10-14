// The title card: a different greeting each visit, chosen from lines that fit the moment.
// h = headline (short, shouty), s = the line underneath. {tokens} are filled from the context.
const LINES = [
  // any time
  { h: "Roll camera, {name}.", s: "Today's scene is waiting. Let's make it a good take." },
  { h: "Action.", s: "You didn't start this to be average on camera. Let's go." },
  { h: "Scene {ep}. Take one.", s: "Every rep today is footage your future self gets to watch." },
  { h: "Lights. Iron. Action.", s: "Same plan as yesterday, a little better than yesterday." },
  { h: "You're the lead, {name}.", s: "Leads show up. That's most of the job." },
  { h: "Back on set.", s: "Consistency is the only special effect that works." },
  { h: "Quiet on set.", s: "No noise, no excuses, just today's list." },
  { h: "Frame it up.", s: "Big shoulders, tall posture, steady voice. We're building all three." },
  { h: "Director's chair: yours.", s: "Call the shots today." },
  { h: "This is the montage.", s: "The bit in the film where it all comes together. You're in it." },
  { h: "Hey {name}. Good to see you.", s: "Let's put another day in the can." },
  { h: "Confidence is a rep.", s: "Every session you finish is proof you do what you say. That shows on camera." },
  // by time of day
  { h: "Morning, {name}.", s: "Water first, then the day. 4 litres starts with one glass.", when: (c) => c.hour >= 5 && c.hour < 12 },
  { h: "Early call time.", s: "First on set, best lit. Let's have a day.", when: (c) => c.hour >= 5 && c.hour < 8 },
  { h: "Afternoon, {name}.", s: "Halfway through the day. How's the water bottle looking?", when: (c) => c.hour >= 12 && c.hour < 17 },
  { h: "Evening shoot.", s: "Still time to tick the list. Guitar and 30 pages before bed.", when: (c) => c.hour >= 17 && c.hour < 22 },
  { h: "Night owl edit.", s: "Wind it down: journal, read, lights out. Sleep is where you grow.", when: (c) => c.hour >= 22 || c.hour < 5 },
  // by the day's session
  { h: "Bench day.", s: "Upper A: chest and back. Set Monday's number to beat.", when: (c) => c.type === "upperA" },
  { h: "Monday. New week, new reel.", s: "Upper A opens the week. Heavy press, strong rows.", when: (c) => c.weekday === 1 && c.type === "upperA" },
  { h: "Leg day. No skipping.", s: "Lower A: the squat. Tall frame, big foundation.", when: (c) => c.type === "lowerA" },
  { h: "Run club tonight.", s: "18:45, Oxford. Easy pace, good company. Talk to someone new.", when: (c) => c.type === "run" },
  { h: "Wednesday miles.", s: "Cardio for the heart, conversation for the confidence.", when: (c) => c.type === "run" },
  { h: "V-taper day.", s: "Upper B: overhead press and pull-ups, the width that reads on camera.", when: (c) => c.type === "upperB" },
  { h: "Shoulder day, {name}.", s: "Boulders take time. Today counts.", when: (c) => c.type === "upperB" },
  { h: "Deadlift Friday.", s: "Lower B: the biggest lift of the week. Finish strong.", when: (c) => c.type === "lowerB" },
  { h: "Season finale (of the week).", s: "Lower B and the week's in the can.", when: (c) => c.type === "lowerB" },
  { h: "Rest day. Earned.", s: "Recover hard: walk, eat, sleep. The list still runs: water, guitar, reading.", when: (c) => c.type === "rest" },
  { h: "Day off set.", s: "Muscle's built on days like this. Keep the habits ticking.", when: (c) => c.type === "rest" },
  { h: "Sunday reset.", s: "Prep food, pack the gym bag, line up Monday.", when: (c) => c.weekday === 0 },
  // by progress
  { h: "{streak} in a row.", s: "That's a streak worth protecting. Don't break the chain.", when: (c) => c.streak >= 3 },
  { h: "On a roll: {streak} straight.", s: "This is what consistency looks like.", when: (c) => c.streak >= 6 },
  { h: "{togo} kg to the final cut.", s: "One weigh-in at a time.", when: (c) => c.togo != null && c.togo > 0.5 },
  { h: "So close: {togo} kg.", s: "90 kg is in shot. Stay on script.", when: (c) => c.togo != null && c.togo > 0.3 && c.togo <= 3 },
  { h: "90 kg. You did it.", s: "Now we hold it, and build the physique on top of it.", when: (c) => c.togo != null && c.togo <= 0.3 },
  { h: "Perfect-day run: {perfect}.", s: "Every box, every day. That's how 75 Hard is won.", when: (c) => c.perfect >= 3 },
  { h: "Week {week} of the season.", s: "{phase}. Trust the plan.", when: (c) => c.week != null },
  { h: "Wrap week.", s: "Deload: same weights, half the sets. Rest is part of the script.", when: (c) => c.phaseKey === "wrap" },
  { h: "Weigh-in day.", s: "First thing, after the loo, before food. Then log it.", when: (c) => c.weighDay },
  { h: "Rushes day.", s: "Progress photo this morning: same spot, same light, same poses.", when: (c) => c.photoDay },
  // bounce-back (warm, never guilt)
  { h: "New take, {name}.", s: "Yesterday didn't make the cut. Today can.", when: (c) => c.missedYesterday },
  { h: "Reset. Reshoot.", s: "Missed one? Fine. Missing two is a pattern. Let's not.", when: (c) => c.missedYesterday },
  // special days
  { h: "Day one. Scene one.", s: "Welcome to The Cut. Today we start the footage.", when: (c) => c.dayNumber === 1, weight: 50 },
  { h: "Happy birthday, {name}!", s: "{age} today. Best shape of your life starts this year.", when: (c) => c.birthday, weight: 100 },
];

const RECENT_KEY = "cut.greet.recent";

export function pickGreeting(ctx) {
  const fill = (str) => str.replace(/\{(\w+)\}/g, (_, k) => (ctx[k] ?? ""));
  let recent = [];
  try { recent = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { /* ignore */ }
  const eligible = LINES.map((l, i) => ({ ...l, i })).filter((l) => !l.when || l.when(ctx));
  const special = eligible.filter((l) => l.weight);
  let pool = special.length ? special : eligible.filter((l) => !recent.includes(l.i));
  if (!pool.length) pool = eligible;
  // Context-specific lines are twice as likely as generic ones.
  const weighted = pool.flatMap((l) => (l.when ? [l, l] : [l]));
  const pick = weighted[Math.floor(Math.random() * weighted.length)];
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([pick.i, ...recent].slice(0, 12))); } catch { /* ignore */ }
  return { h: fill(pick.h), s: fill(pick.s) };
}
