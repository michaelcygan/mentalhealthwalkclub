// Curated prompts a facilitator can glance at to ease conversation.
// Static for now; later versions can swap in AI-generated prompts via Lovable AI.

export const facilitatorPrompts = {
  openers: [
    "What brought you out walking today?",
    "Anyone walking somewhere new this morning?",
    "How are your feet feeling today — and your head?",
    "Quick check-in: one word for how this week's been.",
    "What was the moment you decided to put on your shoes?",
  ],
  deepening: [
    "What's been sitting with you this week?",
    "Is there something you've been carrying that you'd like to set down for a bit?",
    "When you imagine getting home from this walk, what do you want to feel?",
    "What's a small thing that's been kinder than expected lately?",
    "If your body could talk right now, what would it say?",
  ],
  gentle: [
    "No pressure to share — happy to walk in quiet too.",
    "Just here as company. Take whatever space feels right.",
    "If anyone wants to just listen, that's a beautiful thing too.",
    "We can let the walking do the talking for a bit.",
  ],
  wrap: [
    "A couple minutes left — anything you want to land on?",
    "What's one thing you'll take from this walk?",
    "Thank you all for sharing the path. How's your body feeling now?",
    "Before we finish — anyone want a bit of encouragement going into the rest of the day?",
  ],
} as const;

export type PromptStage = keyof typeof facilitatorPrompts;
