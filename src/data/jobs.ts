/** A date that may or may not be worth marking up as a <time>. */
export type Dateish = { label: string; datetime?: string }

/** One line of a job: the label alone, or with a value, joined by a dotted leader. */
export type Role = {
  label: string
  value?: string
}

export type Job = {
  from: Dateish
  to: Dateish
  company: string
  roles: Role[]
}

export const jobs: Job[] = [
  {
    from: { label: '2025', datetime: '2025' },
    to: { label: 'Now' },
    company: 'LIVEKIT',
    roles: [
      {
        label: 'Design Engineering Manager',
      },
    ],
  },
  {
    from: { label: '2019', datetime: '2019' },
    to: { label: '2025', datetime: '2025' },
    company: 'SHOPIFY',
    roles: [
      {
        label: 'Shopify Learn',
        value: 'Staff design technologist',
      },
      {
        label: 'Shopify Build',
        value: 'Staff design technologist',
      },
      {
        label: 'Shopify Plus Automation',
        value: 'Sr UX developer',
      },
    ],
  },
  {
    from: { label: '2015', datetime: '2015' },
    to: { label: '2019', datetime: '2019' },
    company: 'AMAZON',
    roles: [
      {
        label: 'Amazon Devices Concept Lab',
        value: 'Sr design technologist',
      },
      {
        label: 'Amazon Alexa Skills Kit',
        value: 'Sr design technologist',
      },
      {
        label: 'Amazon Advertising Concept Lab',
        value: 'Design technologist',
      },
    ],
  },
  {
    from: { label: '2012', datetime: '2012' },
    to: { label: '2015', datetime: '2015' },
    company: 'THEREDPIN.CA',
    roles: [{ label: 'Lead frontend developer' }],
  },
  {
    from: { label: '2010', datetime: '2010' },
    to: { label: '2012', datetime: '2012' },
    company: 'CRITICAL MASS',
    roles: [
      {
        label: 'Sr web developer',
      },
    ],
  },
  {
    from: { label: '2009', datetime: '2009' },
    to: { label: '2010', datetime: '2010' },
    company: 'CBC',
    roles: [
      {
        label: 'User interface developer',
      },
    ],
  },
  {
    from: { label: '2007', datetime: '2007' },
    to: { label: '2009', datetime: '2009' },
    company: 'HENDERSON BAS',
    roles: [
      {
        label: 'Frontend developer',
      },
    ],
  },
]
