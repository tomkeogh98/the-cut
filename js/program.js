// The training programme: four lifting sessions (upper/lower split) + Oxford Run Club.
// Exercise names match Hevy's built-in library so workouts can be read and routines pushed.
import { daysBetween, mondayOf, weekday } from "./util.js?v=15";

// lift keys feed the goals engine; `hevy` lists Hevy titles to match (first is preferred).
export const SESSIONS = {
  upperA: {
    code: "UA", name: "Upper A", tag: "Chest & back thickness",
    focus: "your heaviest press of the week (bench) plus rows for a thick, strong upper back",
    camera: "A fuller chest and upper back fill out a T-shirt on camera, and strong rows pull your shoulders back so you stand tall when you talk.",
    exercises: [
      { name: "Bench press", hevy: ["Bench Press (Barbell)"], sets: 3, reps: [5, 8], rest: 150, lift: "bench", main: true,
        cue: "Pin your shoulder blades back and down, plant your feet, and touch the bar to your lower chest. Long arms mean a long bar path, so use a slightly wider grip and a controlled touch, never a bounce." },
      { name: "Chest-supported row", hevy: ["Chest Supported Incline Row (Dumbbell)", "Seated Row (Machine)", "Bent Over Row (Dumbbell)"], sets: 3, reps: [8, 12], rest: 120,
        cue: "With your chest on the pad you can't cheat with your lower back, which matters with a long torso. Drive your elbows towards your hips and pause for a second at the top." },
      { name: "Seated dumbbell shoulder press", hevy: ["Seated Overhead Press (Dumbbell)", "Shoulder Press (Dumbbell)", "Overhead Press (Dumbbell)"], sets: 3, reps: [8, 12], rest: 90,
        cue: "Set the bench just short of vertical, start with the dumbbells at ear height and press up and slightly in. Keep your ribs down." },
      { name: "Lat pulldown", hevy: ["Lat Pulldown (Cable)", "Lat Pulldown (Machine)"], sets: 3, reps: [10, 12], rest: 90,
        cue: "Lean back slightly and pull the bar to your upper chest. Think 'elbows into back pockets'. Let your lats stretch fully at the top." },
      { name: "Dumbbell lateral raise", hevy: ["Lateral Raise (Dumbbell)"], sets: 3, reps: [12, 20], rest: 60,
        cue: "The best single exercise for wider shoulders on camera. Use a light weight, raise to shoulder height leading with the elbows, and no swinging." },
      { name: "EZ-bar curl", hevy: ["EZ Bar Biceps Curl", "Bicep Curl (Barbell)"], sets: 2, reps: [10, 12], rest: 60,
        cue: "Keep your elbows pinned to your sides and take three seconds to lower. Leave the ego at the rack." },
      { name: "Triceps pushdown", hevy: ["Triceps Pushdown", "Triceps Rope Pushdown"], sets: 2, reps: [10, 15], rest: 60,
        cue: "Keep your upper arms still and squeeze hard at the bottom. Your triceps are two-thirds of your arm size." },
    ],
  },
  lowerA: {
    code: "LA", name: "Lower A", tag: "Quads & the squat",
    focus: "the squat and quad-dominant work, with hamstrings and core to balance it",
    camera: "Big legs balance a tall frame. Without them, broad shoulders look top-heavy, and with them you stand more solidly on camera.",
    exercises: [
      { name: "Back squat", hevy: ["Squat (Barbell)", "Hack Squat (Machine)", "Safety Bar Squat"], sets: 3, reps: [5, 8], rest: 180, lift: "squat", main: true,
        cue: "Long femurs mean more forward lean, and that's fine. Use a stance a little wider than your shoulders with toes turned out, and lifting shoes or a small heel wedge if your ankles are tight. If squats never feel right, a hack squat or safety-bar squat is a great swap." },
      { name: "Romanian deadlift", hevy: ["Romanian Deadlift (Barbell)", "Romanian Deadlift (Dumbbell)"], sets: 3, reps: [8, 10], rest: 120,
        cue: "Soft knees, push your hips back and keep the bar brushing your legs. Stop when your hamstrings are fully stretched, usually just below the knee. You don't need to touch the floor." },
      { name: "Bulgarian split squat", hevy: ["Bulgarian Split Squat"], sets: 3, reps: [8, 12], rest: 90,
        cue: "Each leg. Put your back foot on a bench and take a long stride, which is easy with your legs. Drop the back knee straight down." },
      { name: "Lying leg curl", hevy: ["Lying Leg Curl (Machine)", "Seated Leg Curl (Machine)"], sets: 3, reps: [10, 15], rest: 60,
        cue: "Keep your hips pressed into the pad, curl hard and lower slowly." },
      { name: "Standing calf raise", hevy: ["Standing Calf Raise (Machine)", "Standing Calf Raise (Smith)", "Standing Calf Raise"], sets: 4, reps: [10, 15], rest: 60,
        cue: "Pause for a full second at the bottom stretch. Bouncing does nothing for your calves." },
      { name: "Hanging leg raise", hevy: ["Hanging Leg Raise", "Knee Raise Parallel Bars"], sets: 3, reps: [10, 15], rest: 60,
        cue: "Curl your pelvis up rather than just lifting your legs. Bend your knees until you can do 10 strict reps with them straight." },
    ],
  },
  run: {
    code: "RC", name: "Run Club", tag: "Oxford Run Club · 18:45",
    focus: "an easy-paced group run: cardio, recovery, and a social hit",
    camera: "Cardio keeps your heart healthy and your face lean, and it's your mid-week social rep. Talk to someone new tonight: confidence is a skill you train too.",
    exercises: [],
    notes: [
      "Have a carb-heavy lunch and a light snack around 17:00, such as a banana and a yoghurt.",
      "Keep most of it conversational: you should be able to talk in full sentences. Join a faster group once a fortnight if you feel good.",
      "Stretch your hip flexors and calves for 5 minutes afterwards, and get protein in within a couple of hours.",
      "Late finish? Have a quick dinner ready to go (see Meals) so you still hit your protein.",
    ],
  },
  upperB: {
    code: "UB", name: "Upper B", tag: "Shoulders & V-taper",
    focus: "overhead press and pull-ups, for the shoulder and lat width that does most for how you look",
    camera: "The V-taper (wide shoulders and lats over a narrower waist) is the shape that reads as 'athletic' from across a room or through a lens.",
    exercises: [
      { name: "Overhead press", hevy: ["Overhead Press (Barbell)", "Seated Overhead Press (Barbell)"], sets: 3, reps: [5, 8], rest: 150, lift: "ohp", main: true,
        cue: "Stand with feet hip-width apart, squeeze your glutes and press the bar in a straight line, moving your head back and then 'through the window' at the top. Brace like you're about to be punched." },
      { name: "Pull-up", hevy: ["Pull Up", "Pull Up (Weighted)", "Pull Up (Assisted)", "Chin Up"], sets: 3, reps: [6, 10], rest: 120, lift: "pullup", main: true,
        cue: "Start from a dead hang and finish with your chin over the bar. Use an assisted machine or band until you can do 6 clean reps, and add weight once you can do 3 × 10." },
      { name: "Incline dumbbell press", hevy: ["Incline Bench Press (Dumbbell)"], sets: 3, reps: [8, 12], rest: 90,
        cue: "Set the bench to 30°. The upper chest is what shows in a shirt's neckline, so make it count." },
      { name: "Seated cable row", hevy: ["Seated Cable Row - V Grip (Cable)", "Seated Cable Row - Bar Grip", "Seated Row (Machine)"], sets: 3, reps: [10, 12], rest: 90,
        cue: "Sit tall, let your shoulder blades stretch forward, then row to your belly button." },
      { name: "Cable lateral raise", hevy: ["Lateral Raise (Cable)", "Single Arm Lateral Raise (Cable)"], sets: 3, reps: [12, 20], rest: 60,
        cue: "One arm at a time with the cable behind you, which keeps tension on the side delt at the bottom." },
      { name: "Face pull", hevy: ["Face Pull"], sets: 3, reps: [15, 20], rest: 60,
        cue: "Rope to your forehead, pulling it apart, and finish like a double-biceps pose. This builds rear delts and posture, so you'll stand taller on camera." },
      { name: "Incline dumbbell curl", hevy: ["Incline Curl (Dumbbell)", "Bicep Curl (Dumbbell)"], sets: 2, reps: [10, 12], rest: 45,
        cue: "Superset this with the next exercise. Let your arms hang behind you to get a full stretch." },
      { name: "Overhead cable triceps extension", hevy: ["Triceps Extension (Cable)", "Overhead Triceps Extension (Cable)"], sets: 2, reps: [10, 15], rest: 60,
        cue: "Working overhead stretches the long head of the triceps, which gives the most growth per set." },
    ],
  },
  lowerB: {
    code: "LB", name: "Lower B", tag: "Hinge & posterior chain",
    focus: "the trap-bar deadlift, your biggest lift of the week, plus glutes, hamstrings and core",
    camera: "A strong posterior chain is what keeps you upright through hours of filming, rather than slumping into the desk.",
    exercises: [
      { name: "Trap-bar deadlift", hevy: ["Trap Bar Deadlift", "Deadlift (Trap bar)", "Deadlift (Barbell)"], sets: 3, reps: [5, 6], rest: 180, lift: "deadlift", main: true,
        cue: "A tall lifter's best friend. The handles sit at your sides, so the bar travels less and your back stays more upright than with a straight bar. Use the high handles at first if hips-down feels cramped." },
      { name: "Leg press", hevy: ["Leg Press (Machine)", "Leg Press Horizontal (Machine)"], sets: 3, reps: [10, 12], rest: 120,
        cue: "Feet mid-to-high on the platform. Go as deep as you can without your lower back lifting off the pad." },
      { name: "Dumbbell walking lunge", hevy: ["Walking Lunge (Dumbbell)", "Lunge (Dumbbell)"], sets: 2, reps: [10, 12], rest: 90,
        cue: "Each leg. Take long strides and lean your torso forward slightly to work the glutes." },
      { name: "Leg extension", hevy: ["Leg Extension (Machine)"], sets: 3, reps: [12, 15], rest: 60,
        cue: "Pause at the top. Adjust the machine so your knee lines up with the pivot, as long shins often need the pad at its lowest setting." },
      { name: "Seated leg curl", hevy: ["Seated Leg Curl (Machine)", "Lying Leg Curl (Machine)"], sets: 3, reps: [10, 15], rest: 60,
        cue: "Lean forward slightly to stretch the hamstrings harder." },
      { name: "Seated calf raise", hevy: ["Seated Calf Raise"], sets: 3, reps: [12, 20], rest: 60,
        cue: "This hits the soleus, which is under the gastrocnemius and adds width to the lower leg." },
      { name: "Cable crunch", hevy: ["Cable Crunch"], sets: 3, reps: [10, 15], rest: 60,
        cue: "Kneel and crunch your ribs down towards your hips. Your hips stay still." },
    ],
  },
  rest: {
    code: "—", name: "Rest day", tag: "Recover & reset",
    focus: "recovery: walking, food, sleep",
    camera: "Muscle is built while you recover, not while you train. Sleep is the cheapest physique (and on-camera skin) upgrade there is.",
    exercises: [],
    notes: [
      "Aim for 8,000+ steps. An easy walk is enough.",
      "Spend 10 minutes on mobility for the spots tall people get tight: hip flexors, hamstrings, and your upper back (thoracic spine).",
      "Get 7.5–9 hours of sleep.",
    ],
  },
};

export const LIFTING = ["upperA", "lowerA", "upperB", "lowerB"];
export const DEFAULT_WEEK = { 1: "upperA", 2: "lowerA", 3: "run", 4: "upperB", 5: "lowerB" };

export const LIFTS = {
  bench: { name: "Bench press", unit: "kg" },
  squat: { name: "Back squat", unit: "kg" },
  ohp: { name: "Overhead press", unit: "kg" },
  deadlift: { name: "Trap-bar deadlift", unit: "kg" },
  pullup: { name: "Pull-ups", unit: "reps" },
};

// ---------- seasons & phases ----------
// A 12-week "season": 4 weeks of pre-production, 4 of principal photography, 3 of reshoots, 1 wrap (deload).
export const PHASES = [
  { key: "pre", name: "Pre-production", weeks: [1, 2, 3, 4], rir: "3 reps in reserve (RPE 7)",
    brief: "Learn the lifts, groove technique, and find honest starting weights. Every rep should look the same. Leave 3 in the tank.",
    progress: "Add reps first. When every set hits the top of the range, add weight next session." },
  { key: "shoot", name: "Principal photography", weeks: [5, 6, 7, 8], rir: "2 reps in reserve (RPE 8)",
    brief: "Now we build. Push each working set to about 2 reps short of failure, and chase one more rep or a little more weight than last week.",
    progress: "Double progression: hit the top of the rep range on all sets, then add 2.5 kg (upper) or 5 kg (lower)." },
  { key: "reshoot", name: "Reshoots", weeks: [9, 10, 11], rir: "1–2 reps in reserve (RPE 8–9)",
    brief: "The hard block. Add a 4th set to your main lift and take the final set of each exercise to about 1 rep short of failure.",
    progress: "Main lift gets 4 sets. Keep the double progression going and expect some PRs." },
  { key: "wrap", name: "Wrap week (deload)", weeks: [12], rir: "4 reps in reserve (RPE 6)",
    brief: "Same weights, half the sets. You're not slacking: fatigue drops away, the gains show up, and next season starts fresh.",
    progress: "Cut every exercise to 1–2 sets. Re-test your main lifts on the first week of the next season." },
];

export function seasonInfo(startDate, date) {
  const w = Math.max(0, Math.floor(daysBetween(mondayOf(startDate), mondayOf(date)) / 7));
  const season = Math.floor(w / 12) + 1;
  const week = (w % 12) + 1;
  const phase = PHASES.find((p) => p.weeks.includes(week));
  return { season, week, phase, absWeek: w + 1 };
}

export function setsFor(ex, phase) {
  if (phase.key === "wrap") return Math.max(1, Math.ceil(ex.sets / 2));
  if (phase.key === "reshoot" && ex.main) return ex.sets + 1;
  return ex.sets;
}

// Default planned session for a weekday (before moves).
export const plannedType = (date) => DEFAULT_WEEK[weekday(date)] || "rest";

// ---------- "how today builds on yesterday" ----------
const BUILDS = {
  "lowerB>upperA": "Friday's deadlifts hammered your posterior chain and the weekend let it recover. Upper A opens the week with your heaviest press while your legs stay fresh, and today's numbers set the bar for Thursday's Upper B.",
  "rest>upperA": "Two days off means your nervous system is at its freshest, which is exactly why the week opens with the bench, your heaviest press. Today's top set is the number to beat next Monday.",
  "upperA>lowerA": "Yesterday's Upper A loaded your chest, back and shoulders. They recover today while Lower A hands the work to your quads with the squat. Different muscles, same week: that's how you train four days without grinding yourself down.",
  "lowerA>run": "Yesterday's squats will make your legs feel heavy at run club. That's normal, and an easy, conversational run actually helps flush out the stiffness before Thursday.",
  "run>upperB": "Last night's run was your cardio and social rep. Today is the aesthetic day: overhead press and pull-ups for the shoulder and lat width that does most for how you look on camera. Your legs get one more day to recover before Friday.",
  "upperB>lowerB": "Yesterday built shoulder and back width. Lower B finishes the week with the trap-bar deadlift, your biggest lift. Nail it and that's four lifts plus run club: a full week in the can.",
  "lowerB>rest": "Week wrapped: four lifts and a run. Today's job is recovery, because this is when the muscle actually gets built. Eat your protein and get to bed on time.",
  "rest>rest": "Second rest day. Hit your water, guitar and reading, prep some food, and get Monday ready: check the Upper A routine in Hevy and pack your gym bag tonight.",
  "upperA>rest": "Rest today. Your upper body is rebuilding from yesterday's pressing and pulling.",
  "lowerA>rest": "Rest today. Your legs are rebuilding from yesterday's squats.",
  "upperB>rest": "Rest today. Your shoulders and back are rebuilding from yesterday's work.",
  "run>rest": "Rest today. Your legs have had their miles.",
};

export function buildsOn(prevType, todayType) {
  const key = `${prevType}>${todayType}`;
  if (BUILDS[key]) return BUILDS[key];
  const t = SESSIONS[todayType], p = SESSIONS[prevType];
  if (todayType === "rest") return "Recovery day. The work you've put in this week turns into muscle while you rest.";
  if (!p || prevType === "rest") return `Fresh legs, fresh arms. ${t.name} is about ${t.focus}.`;
  return `Last time out was ${p.name} (${p.tag.toLowerCase()}). Today's ${t.name} moves the work on to ${t.focus}, so nothing is trained two days running.`;
}
