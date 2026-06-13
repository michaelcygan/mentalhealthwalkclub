// Reflection prompts library — content, not user data.
// Source: Mental Health Questions.docx (user-supplied), preserved verbatim.
// All questions are tagged as `universal` / `reflecting` so they're suitable
// for any mood. The family/depth scaffolding is kept for the walk-end
// reflection screen, which filters by family with a universal fallback.

export type PromptMoodFamily =
  | "heavy"
  | "tender"
  | "steady"
  | "light"
  | "connection"
  | "universal";

export type PromptDepth = "noticing" | "reflecting" | "imagining";

export interface ReflectionPrompt {
  id: string;
  text: string;
  family: PromptMoodFamily;
  depth: PromptDepth;
}

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

const WALK_NOTICING: Array<{ text: string; family: PromptMoodFamily }> = [
  { text: "What can you hear beneath the loudest sound?", family: "universal" },
  { text: "Notice where your shoulders are. Can they soften by one percent?", family: "heavy" },
  { text: "What feels steady beneath your feet right now?", family: "heavy" },
  { text: "Find one color you might have missed if you were rushing.", family: "steady" },
  { text: "Has the rhythm of your breathing changed since you began?", family: "steady" },
  { text: "What small thing in view feels quietly good?", family: "light" },
  { text: "If this part of the walk had a title, what would it be?", family: "light" },
  { text: "What would feel kind to hear from someone today?", family: "tender" },
  { text: "Who or what helps you feel less alone?", family: "connection" },
  { text: "Let the next ten steps be only ten steps—nothing to solve.", family: "universal" },
];

// Verbatim from the uploaded Mental Health Questions document.
const RAW: string[] = [
  "What is your favorite way to unwind after a stressful day?",
  "Share a self-care practice you swear by.",
  "When was a time you surprised yourself with your own resilience?",
  "What's your go-to activity when you're feeling anxious?",
  "What's one thing you wish people understood better about mental health?",
  "What's the most helpful piece of advice you've received from a therapist or counselor?",
  "Describe your favorite mental health-related book, podcast, or movie.",
  "What helps you to feel grounded when life feels overwhelming?",
  "If you had one day entirely dedicated to your mental health, what would you do?",
  "What's a small habit that significantly improved your mental wellness?",
  "How do you notice when you need a mental health day?",
  "If emotions were colors, what color describes your mood today?",
  "Share one surprising thing that brings you peace.",
  "What's your favorite mindfulness or meditation technique?",
  "Can you share a time when vulnerability brought you closer to someone else?",
  "How has your approach to mental health changed over time?",
  "What is one stigma around mental health that you want to break?",
  "What helps you bounce back from a challenging or difficult moment?",
  "Do you have a mental wellness mantra or affirmation you love?",
  "What's something you've recently learned about yourself?",
  "If you could write a letter to your younger self about mental wellness, what would you say?",
  "What's one mental health-related myth you've discovered isn't true?",
  "Describe a perfect mental health getaway.",
  "What's something simple that makes you smile without fail?",
  "What's your favorite uplifting song or playlist when you're feeling down?",
  "Share a mental health practice you wish you started earlier in life.",
  "When was the last time you asked for help, and how did it go?",
  "What's your favorite way to support a friend who's having a tough time?",
  "If you could design an ideal mental health day for someone else, what would you include?",
  "How do you practice self-compassion?",
  "Name a time when journaling or writing helped you gain clarity.",
  "What's your favorite mental health-related quote, and why does it resonate?",
  "How do you create boundaries to protect your mental health?",
  "What activities make you feel truly present in the moment?",
  "If happiness had a flavor, what would it be for you?",
  "What's your favorite calming scent, and why?",
  "What's your best advice for dealing with negative self-talk?",
  "How do you balance productivity and rest in your daily life?",
  "What's one new self-care routine you'd like to try?",
  "What small changes have you made to your environment to improve your mental well-being?",
  "What's your favorite comfort food when you're feeling down?",
  "How do you remind yourself that your feelings are valid?",
  "If you could recommend one thing everyone should try for their mental health, what would it be?",
  "What's one thing you do regularly that helps maintain your emotional balance?",
  "What's a memorable lesson you've learned from a difficult experience?",
  "Share one mental health-related goal you're working toward.",
  "What's a fun hobby or creative activity that boosts your mood?",
  "What's your favorite way to celebrate personal growth?",
  "How do you know when you're feeling mentally healthy and balanced?",
  "What's your favorite way to disconnect and recharge?",
  "Describe a place that instantly brings you calmness or joy.",
  "How do you recognize when you're nearing burnout?",
  "What's a ritual you have for ending your day positively?",
  "How has your view on happiness evolved?",
  "Name one positive coping strategy you've learned this past year.",
  "If you could invent an app to improve mental wellness, what would it do?",
  "How do you handle uncertainty in your life?",
  "What's something new you've recently tried for your mental health?",
  "Describe a conversation about mental health that changed your perspective.",
  "What simple daily pleasure do you cherish the most?",
  "How do you practice gratitude in your daily life?",
  "What's your favorite form of physical movement for mental clarity?",
  "Can you share a moment when humor helped you cope?",
  "What's something surprising that helps lift your spirits?",
  "How do you handle difficult emotions when you're alone?",
  "What's one resource (book, person, or podcast) you frequently recommend to others?",
  "Describe a memorable moment of genuine connection you've experienced recently.",
  "What's something you're proud of yourself for overcoming?",
  "If you had unlimited resources, what mental health initiative would you create?",
  "What's a small, unnoticed thing in your life that greatly contributes to your mental wellness?",
  "How do you celebrate small victories?",
  "What's one misconception about mental health you've personally overcome?",
  "Share a moment when you felt truly heard and understood.",
  "What's your favorite thing to do when you're feeling creatively stuck?",
  "If you had to describe your mental health journey in three words, what would they be?",
  "What's a moment of peace or clarity you've had recently?",
  "How do you define emotional intelligence, and why is it important to you?",
  "What's something you've learned about mental health through experience rather than advice?",
  "How do you recharge when social interaction becomes exhausting?",
  "What's one activity you loved as a child that still boosts your mental wellness today?",
  "What's the most unusual yet effective mental wellness tip you've tried?",
  "How do you approach conversations about mental health with family members?",
  "If mental health had a season, which one resonates most with you, and why?",
  "What's a creative outlet that brings balance to your life?",
  "What question do you wish people would ask you about your mental health journey?",
  "Describe your ideal mental health retreat.",
  "How do you incorporate mindfulness into your meals or eating habits?",
  "What's a recent emotional or mental health milestone you've achieved?",
  "What's a favorite memory or experience that always improves your mood when you think of it?",
  "If mental wellness was a landscape, what would yours look like?",
  "What's your favorite affirmation or positive reminder to yourself?",
  "How has your environment shaped your mental wellness?",
  "Share something you're currently unlearning for your mental health.",
  "How do you cultivate patience with yourself?",
  "What's your favorite mood-boosting beverage or tea?",
  "Describe a piece of art or music that deeply resonates with your mental health journey.",
  "What's a dream or aspiration that significantly motivates your well-being?",
  "How do you make sure your mental health isn't overshadowed by daily tasks?",
  "What's your favorite way to inspire or uplift others?",
  "Describe one change you've made in your routine that significantly improved your mental health.",
];

export const PROMPTS: ReflectionPrompt[] = [
  ...WALK_NOTICING.map((prompt, i) => ({ id: `walk_${String(i + 1).padStart(2, "0")}`, text: prompt.text, family: prompt.family, depth: "noticing" as const })),
  ...RAW.map((text, i) => ({
    id: `q_${String(i + 1).padStart(3, "0")}`,
    text,
    family: i < 20 ? "heavy" as const : i < 45 ? "steady" as const : i < 70 ? "light" as const : i < 85 ? "connection" as const : "universal" as const,
    depth: "reflecting" as const,
  })),
];

export function promptsForMood(mood: string | null | undefined): ReflectionPrompt[] {
  const family = moodToFamily(mood);
  const inFamily = PROMPTS.filter((p) => p.family === family);
  const universal = PROMPTS.filter((p) => p.family === "universal");
  return [...inFamily.filter((p) => p.depth === "noticing"), ...universal.filter((p) => p.depth === "noticing"), ...inFamily, ...universal];
}
