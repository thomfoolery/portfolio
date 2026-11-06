export type Honor = {
  datetime: string
  date: string
  title: string
  href?: string
  blurb: string
  /** the blurb's measure, in characters, hand-tuned per row so the edge stays ragged */
  measure: 48 | 52 | 56
}

export const honors: Honor[] = [
  {
    datetime: '2025-03',
    date: '2025.03',
    title: 'CERTIFIED AI ENGINEER',
    href: 'https://bit.ly/AIE05020',
    blurb: 'AI Makerspace graduate',
    measure: 56,
  },
  {
    datetime: '2023-01',
    date: '2023.01',
    title: 'THREE.JS JOURNEY CERTIFICATE',
    href: 'https://threejs-journey.com/certificate/view/2640',
    blurb: 'The most complete, yet accessible way to learn 3D on the web.',
    measure: 48,
  },
  {
    datetime: '2022-12',
    date: '2022.12',
    title: 'GOOGLE PROJECT MANAGEMENT CERTIFICATE',
    href: 'https://www.credly.com/badges/8f502281-452f-42af-a862-8d8da440dda5',
    blurb:
      '6 course series, developed by Google, demonstrating competency in initiating, ' +
      'planning and running both traditional and agile projects.',
    measure: 56,
  },
  {
    datetime: '2018-11',
    date: '2018.11',
    title: 'EXPERT ALEXA SKILL DEVELOPER',
    blurb:
      'Built and published 5 certified Alexa skills from start to finish in under 2 months ' +
      'as part of an Alexa developer challenge.',
    measure: 52,
  },
  {
    datetime: '2016-08',
    date: '2016.08',
    title: 'TOP-RANKING ALEXA SKILL',
    blurb:
      'In collaboration with Amazon, Warner Bros., the head writers at DC Comics, and ' +
      'Cruel & Unusual Films, developed the first Alexa skill to utilize compelling music ' +
      'and sound effects to establish an immersive, interactive detective game. It engaged ' +
      '7x more users than all other skills combined in its first week.',
    measure: 56,
  },
  {
    datetime: '2013-06',
    date: '2013.06',
    title: '2013 WEBBY AWARD',
    blurb:
      'Led the UI design and development for TheRedPin.com when it was nominated for a ' +
      '2013 Webby Award in the real estate category.',
    measure: 52,
  },
]
