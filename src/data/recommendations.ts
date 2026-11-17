/**
 * Three of the LinkedIn recommendations, each cut to a passage: `[...]` marks a
 * cut, and the words are otherwise the recommender's own. The font has no curly
 * quotes, so an apostrophe is a straight one; the subset carries é for José.
 */
export type Recommendation = {
  name: string
  /** their headline now, not when they wrote it */
  title: string
  /** where they worked with Thomas */
  company: string
  /** the year they wrote it */
  year: number
  quote: string
}

export const recommendations: Recommendation[] = [
  {
    name: 'Lily Wagner',
    title: 'Project Manager, Shopify',
    company: 'Shopify',
    year: 2024,
    quote:
      'He was our secret weapon, filling cross-functional gaps to keep us moving fast and focused on the user.',
  },
  {
    name: 'José Torre',
    title: 'Principle Designer, Shopify',
    company: 'Shopify',
    year: 2022,
    quote:
      "He's not afraid to take action and make things. He dives headfirst into turning our abstract ideas into brilliant, working prototypes we could get in front of people.",
  },
  {
    name: 'Dennis Harrington',
    title: 'Design Technologist Manager, Amazon',
    company: 'Amazon',
    year: 2020,
    quote:
      "Thom is every manager's dream employee. [...] the two traits that stood out the most for me were Thom's strong bias for action and his ability to be openly self-critical.",
  },
]
