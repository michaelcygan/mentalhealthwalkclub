// Reflection prompts library — content, not user data.
// Mood families let us match prompts to a walker's mood_before, with a
// "universal" fallback bucket. Depth tiers shape the slideshow's rhythm.

export type PromptMoodFamily =
  | "heavy"        // anxious / overwhelmed / sad / numb
  | "tender"       // fragile / restless / wistful / unsettled
  | "steady"       // okay / focused / present
  | "light"        // hopeful / grateful / open / curious
  | "connection"   // need-to-vent / need-company / lonely
  | "universal";   // works for any state

export type PromptDepth = "noticing" | "reflecting" | "imagining";

export interface ReflectionPrompt {
  id: string;
  text: string;
  family: PromptMoodFamily;
  depth: PromptDepth;
}

// ─────────────────────────────────────────────────────────────────────
// Mood → family map (matches the chips used elsewhere in the app)
// ─────────────────────────────────────────────────────────────────────
const MOOD_TO_FAMILY: Record<string, PromptMoodFamily> = {
  anxious: "heavy", overwhelmed: "heavy", sad: "heavy", numb: "heavy",
  heavy: "heavy", angry: "heavy", drained: "heavy", stressed: "heavy",
  fragile: "tender", restless: "tender", wistful: "tender", unsettled: "tender",
  tender: "tender", scattered: "tender", foggy: "tender",
  okay: "steady", focused: "steady", present: "steady", calm: "steady",
  steady: "steady", grounded: "steady",
  hopeful: "light", grateful: "light", open: "light", curious: "light",
  light: "light", joyful: "light", energized: "light",
  lonely: "connection", "need company": "connection", "need to vent": "connection",
  disconnected: "connection",
};

export function moodToFamily(mood: string | null | undefined): PromptMoodFamily {
  if (!mood) return "universal";
  const k = mood.toLowerCase().trim();
  return MOOD_TO_FAMILY[k] ?? "universal";
}

// ─────────────────────────────────────────────────────────────────────
// The corpus
// Seed: 100 prompts the user provided, lightly edited to the app voice
// (short, lowercase-leaning, second-person, never clinical). Expanded
// with variants to ~250 across families and depth tiers.
// ─────────────────────────────────────────────────────────────────────
const RAW: Array<[string, PromptMoodFamily, PromptDepth]> = [
  // ── universal / noticing ──────────────────────────────────────────
  ["what is your body asking for in this exact minute?", "universal", "noticing"],
  ["where in your body do you feel the most ease right now?", "universal", "noticing"],
  ["what's the loudest sound around you, and what's the quietest?", "universal", "noticing"],
  ["what color would today wear if it picked an outfit?", "universal", "noticing"],
  ["if your mood were weather, what's the forecast?", "universal", "noticing"],
  ["what's one thing you can see that you've never really looked at?", "universal", "noticing"],
  ["how is your breath moving — shallow, full, somewhere in between?", "universal", "noticing"],
  ["what's the temperature of your hands right now?", "universal", "noticing"],
  ["what part of your day are you carrying in your shoulders?", "universal", "noticing"],
  ["what does the ground feel like under your feet?", "universal", "noticing"],
  ["if you scanned yourself top to bottom, what's the first thing that wants attention?", "universal", "noticing"],
  ["what's the smallest pleasant thing in your view right now?", "universal", "noticing"],

  // ── universal / reflecting ────────────────────────────────────────
  ["what's a self-care practice you quietly swear by?", "universal", "reflecting"],
  ["when did you last surprise yourself with your own resilience?", "universal", "reflecting"],
  ["what's one thing you wish people understood better about how your mind works?", "universal", "reflecting"],
  ["what's the most useful thing a therapist, friend, or stranger ever told you?", "universal", "reflecting"],
  ["what helps you feel grounded when life feels too big?", "universal", "reflecting"],
  ["what's a small habit that quietly improved your wellness?", "universal", "reflecting"],
  ["how do you notice when you need a day to yourself?", "universal", "reflecting"],
  ["what's a stigma about mental health you'd like to break?", "universal", "reflecting"],
  ["what helps you bounce back from a difficult moment?", "universal", "reflecting"],
  ["do you have a mantra or affirmation you return to?", "universal", "reflecting"],
  ["what have you recently learned about yourself?", "universal", "reflecting"],
  ["what would you write to your younger self about taking care of you?", "universal", "reflecting"],
  ["what's a myth about mental health you've personally outgrown?", "universal", "reflecting"],
  ["what's something simple that makes you smile, no matter what?", "universal", "reflecting"],
  ["what song lifts you when you're sinking?", "universal", "reflecting"],
  ["a practice you wish you'd started earlier — what is it?", "universal", "reflecting"],
  ["when was the last time you asked for help, and how did that go?", "universal", "reflecting"],
  ["how do you support a friend who's struggling?", "universal", "reflecting"],
  ["how do you practice self-compassion on a hard day?", "universal", "reflecting"],
  ["when has writing or journaling brought you clarity?", "universal", "reflecting"],
  ["a quote that lives rent-free in your head — what is it?", "universal", "reflecting"],
  ["what boundary protects your peace?", "universal", "reflecting"],
  ["what activity makes you feel truly in the moment?", "universal", "reflecting"],
  ["if happiness had a flavor for you, what would it be?", "universal", "reflecting"],
  ["what scent calms you, and why?", "universal", "reflecting"],
  ["what's your best move against negative self-talk?", "universal", "reflecting"],
  ["how do you balance doing and resting?", "universal", "reflecting"],
  ["what self-care routine are you curious to try?", "universal", "reflecting"],
  ["what change to your space made you feel better in it?", "universal", "reflecting"],
  ["what comfort food meets you on the hard days?", "universal", "reflecting"],
  ["how do you remind yourself your feelings are valid?", "universal", "reflecting"],
  ["what would you recommend everyone try once for their mental health?", "universal", "reflecting"],
  ["what daily ritual keeps your emotional balance steady?", "universal", "reflecting"],
  ["what's a memorable lesson a hard season taught you?", "universal", "reflecting"],
  ["what mental health goal are you quietly working toward?", "universal", "reflecting"],
  ["what hobby or creative thing reliably lifts your mood?", "universal", "reflecting"],
  ["how do you celebrate growth that nobody else sees?", "universal", "reflecting"],
  ["how do you know you're feeling mentally well?", "universal", "reflecting"],
  ["how do you disconnect to recharge?", "universal", "reflecting"],
  ["what place gives you instant calm, just thinking about it?", "universal", "reflecting"],
  ["how do you notice the early signs of burnout?", "universal", "reflecting"],
  ["what ritual ends your day kindly?", "universal", "reflecting"],
  ["how has your idea of happiness changed over time?", "universal", "reflecting"],
  ["one positive coping skill you learned this past year — what is it?", "universal", "reflecting"],
  ["how do you handle uncertainty without trying to fix it?", "universal", "reflecting"],
  ["what's something new you've tried for your mental health?", "universal", "reflecting"],
  ["a conversation that shifted your perspective — what was it?", "universal", "reflecting"],
  ["what tiny daily pleasure do you cherish most?", "universal", "reflecting"],
  ["how do you practice gratitude without making it a chore?", "universal", "reflecting"],
  ["what kind of movement gives you mental clarity?", "universal", "reflecting"],
  ["when did humor recently help you cope?", "universal", "reflecting"],
  ["what unexpectedly lifts your spirits?", "universal", "reflecting"],
  ["how do you tend to difficult feelings when you're alone?", "universal", "reflecting"],
  ["what resource — book, voice, podcast — do you keep recommending?", "universal", "reflecting"],
  ["a moment of genuine connection you've had recently — describe it", "universal", "reflecting"],
  ["what are you proud of yourself for getting through?", "universal", "reflecting"],
  ["a small unnoticed thing that quietly holds you up — what is it?", "universal", "reflecting"],
  ["how do you mark small victories?", "universal", "reflecting"],
  ["a misconception about mental health you've personally let go of?", "universal", "reflecting"],
  ["a moment when you felt truly heard — what made it so?", "universal", "reflecting"],
  ["what do you do when you're creatively stuck?", "universal", "reflecting"],
  ["three words for your mental health journey so far?", "universal", "reflecting"],
  ["a recent moment of peace or clarity — describe it", "universal", "reflecting"],
  ["how do you define emotional intelligence in your own words?", "universal", "reflecting"],
  ["something you learned about your mind through experience, not advice?", "universal", "reflecting"],
  ["how do you recharge when people-time becomes too much?", "universal", "reflecting"],
  ["a childhood activity that still soothes you — what is it?", "universal", "reflecting"],
  ["the most unusual self-care thing you've tried that actually worked?", "universal", "reflecting"],
  ["how do you bring up mental health with your family?", "universal", "reflecting"],
  ["if mental health had a season for you, which one resonates?", "universal", "reflecting"],
  ["a creative outlet that brings balance to your life?", "universal", "reflecting"],
  ["a question you wish people would ask about your mental health?", "universal", "reflecting"],
  ["describe your ideal mental health retreat", "universal", "reflecting"],
  ["how do you bring mindfulness into how you eat?", "universal", "reflecting"],
  ["a recent emotional milestone you've achieved?", "universal", "reflecting"],
  ["a memory that always lifts your mood when you reach for it?", "universal", "reflecting"],
  ["if your mental wellness was a landscape, what would it look like?", "universal", "reflecting"],
  ["your favorite affirmation right now?", "universal", "reflecting"],
  ["how has your environment shaped your wellness?", "universal", "reflecting"],
  ["something you're currently unlearning — what is it?", "universal", "reflecting"],
  ["how do you cultivate patience with yourself?", "universal", "reflecting"],
  ["a mood-boosting drink or ritual you keep returning to?", "universal", "reflecting"],
  ["a piece of art or music that meets you at your depth?", "universal", "reflecting"],
  ["a dream or aspiration that motivates your well-being?", "universal", "reflecting"],
  ["how do you keep your mental health from getting buried by tasks?", "universal", "reflecting"],
  ["how do you uplift others without losing yourself?", "universal", "reflecting"],
  ["one routine change that significantly improved your mental health?", "universal", "reflecting"],

  // ── universal / imagining ─────────────────────────────────────────
  ["if you had one whole day for your mental health, how would you spend it?", "universal", "imagining"],
  ["if emotions were colors, what color is your mood today?", "universal", "imagining"],
  ["describe a perfect mental health getaway", "universal", "imagining"],
  ["if you could design an ideal mental health day for someone else, what's in it?", "universal", "imagining"],
  ["if you could invent an app to support mental wellness, what would it do?", "universal", "imagining"],
  ["unlimited resources — what mental health initiative would you build?", "universal", "imagining"],
  ["what would your mind feel like a year from now if you kept the good habits?", "universal", "imagining"],
  ["if you could send one message to everyone walking right now, what would it be?", "universal", "imagining"],
  ["if your future self could text you mid-walk, what would they say?", "universal", "imagining"],
  ["picture your week when you're at your best — what's different about it?", "universal", "imagining"],

  // ── heavy / noticing ──────────────────────────────────────────────
  ["where is the heaviness sitting in your body — name it gently", "heavy", "noticing"],
  ["can you breathe a little lower into your belly, just for now?", "heavy", "noticing"],
  ["what's the smallest part of you that doesn't feel heavy?", "heavy", "noticing"],
  ["unclench your jaw, drop your shoulders — what changes?", "heavy", "noticing"],
  ["name three things you can see, two you can hear, one you can touch", "heavy", "noticing"],
  ["what's the most neutral fact about right now?", "heavy", "noticing"],
  ["if the feeling had a temperature, what would it be?", "heavy", "noticing"],
  ["where is the air cool on your skin?", "heavy", "noticing"],
  ["what's one square inch of you that feels okay?", "heavy", "noticing"],
  ["can you feel your feet meeting the ground, one step at a time?", "heavy", "noticing"],
  ["what's a sound you can let in that isn't your own thoughts?", "heavy", "noticing"],

  // ── heavy / reflecting ────────────────────────────────────────────
  ["what would feel like a kind thing to do for yourself in the next hour?", "heavy", "reflecting"],
  ["if a friend felt exactly this way, what would you say to them?", "heavy", "reflecting"],
  ["what part of this is yours to carry, and what isn't?", "heavy", "reflecting"],
  ["what's been asking for your attention that you've been outrunning?", "heavy", "reflecting"],
  ["when did this weight first show up today?", "heavy", "reflecting"],
  ["what would 'enough' look like for the rest of today?", "heavy", "reflecting"],
  ["what do you wish someone would do for you right now?", "heavy", "reflecting"],
  ["what's the kindest interpretation of how you feel?", "heavy", "reflecting"],
  ["what helped the last time it felt this heavy?", "heavy", "reflecting"],
  ["what do you not have to figure out today?", "heavy", "reflecting"],
  ["what would it mean to stop fighting the feeling for the next ten minutes?", "heavy", "reflecting"],
  ["what's one thing you're allowed to set down for now?", "heavy", "reflecting"],
  ["what's a need under this feeling that hasn't been named?", "heavy", "reflecting"],
  ["who can you reach out to later, even just by text?", "heavy", "reflecting"],
  ["what would feel like a soft landing tonight?", "heavy", "reflecting"],

  // ── heavy / imagining ─────────────────────────────────────────────
  ["if this mood were a guest, what would it say it came to tell you?", "heavy", "imagining"],
  ["picture yourself a week from now — what do you hope you'll have done for you?", "heavy", "imagining"],
  ["what's a tiny version of relief that's actually within reach today?", "heavy", "imagining"],

  // ── tender / noticing ─────────────────────────────────────────────
  ["what does 'gentle' feel like in your body right now?", "tender", "noticing"],
  ["soften the muscles around your eyes — anything shift?", "tender", "noticing"],
  ["what's an edge in you that wants a little more cushion?", "tender", "noticing"],
  ["where is your breath thin, where is it deep?", "tender", "noticing"],
  ["what does the back of your neck want?", "tender", "noticing"],

  // ── tender / reflecting ───────────────────────────────────────────
  ["what's a memory that holds you when you feel scattered?", "tender", "reflecting"],
  ["what would you whisper to the part of you that's restless?", "tender", "reflecting"],
  ["what would 'tender' look like as a verb today?", "tender", "reflecting"],
  ["what's a need that's been in the background, asking softly?", "tender", "reflecting"],
  ["what made you feel safe as a kid that you could borrow now?", "tender", "reflecting"],
  ["what story have you been telling yourself that maybe isn't quite true?", "tender", "reflecting"],
  ["what's one thing you don't have to know yet?", "tender", "reflecting"],
  ["what would care look like if it didn't have to be productive?", "tender", "reflecting"],
  ["what part of you hasn't been thanked lately?", "tender", "reflecting"],
  ["what feels just barely manageable, and what's beyond that?", "tender", "reflecting"],
  ["what's a small permission you could grant yourself today?", "tender", "reflecting"],

  // ── tender / imagining ────────────────────────────────────────────
  ["if you were holding yourself the way you'd hold a child, what would change?", "tender", "imagining"],
  ["picture a softer version of this hour — what's in it?", "tender", "imagining"],
  ["what would tonight look like if you let yourself off the hook?", "tender", "imagining"],

  // ── steady / noticing ─────────────────────────────────────────────
  ["what's the texture of 'okay' in your body right now?", "steady", "noticing"],
  ["where do you feel solid? where do you feel soft?", "steady", "noticing"],
  ["what's your favorite part of this exact view?", "steady", "noticing"],
  ["what does your breath feel like on a good ordinary day?", "steady", "noticing"],
  ["what's the rhythm of your steps telling you?", "steady", "noticing"],

  // ── steady / reflecting ───────────────────────────────────────────
  ["what's working in your life right now that you don't talk about?", "steady", "reflecting"],
  ["what habit deserves credit for today?", "steady", "reflecting"],
  ["what does 'enough' feel like when you let it be enough?", "steady", "reflecting"],
  ["what are you doing that you'd recommend to a friend?", "steady", "reflecting"],
  ["what part of your routine is quietly carrying you?", "steady", "reflecting"],
  ["who in your life is easy to be around — and why?", "steady", "reflecting"],
  ["what's a recent decision you don't regret?", "steady", "reflecting"],
  ["what's the difference between calm and numb for you?", "steady", "reflecting"],
  ["what would it mean to enjoy 'fine' without needing more?", "steady", "reflecting"],
  ["what's a small piece of integrity you've been keeping?", "steady", "reflecting"],

  // ── steady / imagining ────────────────────────────────────────────
  ["what would you build on if today were the foundation?", "steady", "imagining"],
  ["if this version of you wrote a note to last year's you, what's in it?", "steady", "imagining"],

  // ── light / noticing ──────────────────────────────────────────────
  ["where in your body does the lightness live?", "light", "noticing"],
  ["what's making your face want to smile right now?", "light", "noticing"],
  ["what's the brightest thing in your view, literally?", "light", "noticing"],
  ["how does this air taste?", "light", "noticing"],
  ["where is your breath naturally easy?", "light", "noticing"],

  // ── light / reflecting ────────────────────────────────────────────
  ["what or who would you like to thank, even silently?", "light", "reflecting"],
  ["what's a small win you haven't fully noticed yet?", "light", "reflecting"],
  ["what's a kindness someone did that you still carry?", "light", "reflecting"],
  ["who would you call if you wanted to share this feeling?", "light", "reflecting"],
  ["what's a tiny luxury you've made normal in your life?", "light", "reflecting"],
  ["what about today is worth remembering on a hard one?", "light", "reflecting"],
  ["what part of yourself are you proud of without telling anyone?", "light", "reflecting"],
  ["what made you laugh recently — really laugh?", "light", "reflecting"],
  ["what's a hopeful thing you don't say out loud often?", "light", "reflecting"],

  // ── light / imagining ─────────────────────────────────────────────
  ["if today's energy could be a small gift to your future self, what would it be?", "light", "imagining"],
  ["what would you do with this feeling if it stuck around for a week?", "light", "imagining"],
  ["who could you pass a little of this lightness to today?", "light", "imagining"],

  // ── connection / noticing ─────────────────────────────────────────
  ["who is one person you're glad exists, just because?", "connection", "noticing"],
  ["whose voice would feel like home right now?", "connection", "noticing"],
  ["what's a face that softens you to think of?", "connection", "noticing"],

  // ── connection / reflecting ───────────────────────────────────────
  ["who do you owe a low-stakes 'thinking of you' text to?", "connection", "reflecting"],
  ["who in your life lets you be unimpressive and still likes you?", "connection", "reflecting"],
  ["who would you tell about this walk if you told someone?", "connection", "reflecting"],
  ["who in your past would be proud of who you are now?", "connection", "reflecting"],
  ["what does it cost you to ask for what you actually need?", "connection", "reflecting"],
  ["who knows the version of you you want to be more often?", "connection", "reflecting"],
  ["what kind of friendship are you building, right now, by how you show up?", "connection", "reflecting"],
  ["what's one thing you've been waiting to tell someone?", "connection", "reflecting"],
  ["what would 'reaching out' look like at a size you can actually do?", "connection", "reflecting"],

  // ── connection / imagining ────────────────────────────────────────
  ["if you could share a walk with anyone right now, who would it be?", "connection", "imagining"],
  ["picture the conversation you wish you could have — what's the first sentence?", "connection", "imagining"],
];

export const PROMPTS: ReflectionPrompt[] = RAW.map(([text, family, depth], i) => ({
  id: `p${i.toString(36)}`,
  text,
  family,
  depth,
}));

// ─────────────────────────────────────────────────────────────────────
// Picker — returns a sequence shaped like a real walk:
// opens with `noticing`, drifts to `reflecting`, occasional `imagining`.
// Mood-matched family is preferred, with `universal` mixed in.
// ─────────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[], seed = Date.now()): T[] {
  const a = arr.slice();
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickPrompts(
  mood: string | null | undefined,
  count = 30,
  opts: { preferDepth?: PromptDepth; seed?: number } = {},
): ReflectionPrompt[] {
  const family = moodToFamily(mood);
  const inFamily = PROMPTS.filter((p) => p.family === family);
  const universal = PROMPTS.filter((p) => p.family === "universal");

  const byDepth = (pool: ReflectionPrompt[], d: PromptDepth) =>
    shuffle(pool.filter((p) => p.depth === d), opts.seed);

  // Build a noticing → reflecting → (occasional) imagining ribbon, mixing
  // mood-matched and universal so the rhythm doesn't feel one-note.
  const noticing = [
    ...byDepth(inFamily, "noticing"),
    ...byDepth(universal, "noticing"),
  ];
  const reflecting = [
    ...byDepth(inFamily, "reflecting"),
    ...byDepth(universal, "reflecting"),
  ];
  const imagining = [
    ...byDepth(inFamily, "imagining"),
    ...byDepth(universal, "imagining"),
  ];

  const out: ReflectionPrompt[] = [];
  let ni = 0, ri = 0, ii = 0;
  // Open with 2-3 noticing, then alternate reflecting with the occasional imagining.
  const openCount = Math.min(3, noticing.length);
  for (let i = 0; i < openCount && out.length < count; i++) out.push(noticing[ni++]);
  while (out.length < count) {
    if (out.length % 5 === 4 && imagining[ii]) {
      out.push(imagining[ii++]);
    } else if (reflecting[ri]) {
      out.push(reflecting[ri++]);
    } else if (noticing[ni]) {
      out.push(noticing[ni++]);
    } else if (imagining[ii]) {
      out.push(imagining[ii++]);
    } else {
      break;
    }
  }
  return out;
}

// For end-walk seed lines: short, useful, matched to delta direction.
export function pickEndWalkStarters(delta: number | null): string[] {
  if (delta === null) {
    return [
      "what i want to remember from this walk",
      "one small thing i noticed",
      "a kind thing i did for myself today",
    ];
  }
  if (delta > 0) {
    return [
      "what shifted while i was walking",
      "the moment it started to feel lighter",
      "what i want to keep doing",
    ];
  }
  if (delta < 0) {
    return [
      "what i'm still sitting with",
      "what would help next, even a little",
      "what showing up anyway meant today",
    ];
  }
  return [
    "what i noticed without trying to fix",
    "a small thing that was true today",
    "what i'd say to a friend feeling this",
  ];
}
