/** A date that may or may not be worth marking up as a <time>. */
export type Dateish = { label: string; datetime?: string }

/** A line in the CV. `dots` prints the leader between label and value. */
export type Row = {
  label: string
  value?: string
  layout?: 'dots' | 'plain'
}

export type Role = {
  label: string
  value?: string
  layout?: 'dots' | 'plain'
  projects?: Row[]
  /** one per line, two-up in a 24ch grid, or label beside value in 24ch */
  projectsLayout?: 'list' | 'grid' | 'columns'
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
        projects: [{ label: 'Agents UI', value: 'Open Source UI library' }],
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
        layout: 'dots',
        projects: [
          { label: 'Design System', value: 'Shopify.dev Redesign' },
          { label: 'Programmatic References', value: 'Shopify GraphQL Docs' },
        ],
      },
      {
        label: 'Shopify Build',
        value: 'Staff design technologist',
        layout: 'dots',
        projects: [{ label: 'Developer Experience', value: 'App Distribution' }],
      },
      {
        label: 'Shopify Plus Automation',
        value: 'Sr UX developer',
        layout: 'dots',
        projects: [{ label: 'Visual Programming Tool', value: 'Shopify Flow' }],
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
        layout: 'dots',
        projects: [
          { label: 'Visual Programming Tool', value: 'Voice Design Tool' },
          { label: 'Prototyping Tool', value: 'VR Home Environment' },
          { label: 'Concept Device', value: 'Amazon Echo Show 15' },
        ],
      },
      {
        label: 'Amazon Alexa Skills Kit',
        value: 'Sr design technologist',
        layout: 'dots',
        projects: [
          { label: 'Design System', value: 'Alexa Developer Console' },
          { label: 'Visual Programming Tool', value: 'Alexa Interaction Models' },
        ],
      },
      {
        label: 'Amazon Advertising Concept Lab',
        value: 'Design technologist',
        projects: [
          { label: 'Alexa', value: 'The Wayne Investigation' },
          { label: 'Fire TV', value: 'Interactive Ads' },
          { label: 'Fire Tablet', value: 'Daily Deals App' },
          { label: 'Fire Tablet', value: 'Interactive Ads' },
        ],
      },
    ],
  },
  {
    from: { label: '2012', datetime: '2012' },
    to: { label: '2015', datetime: '2015' },
    company: 'THEREDPIN.CA',
    roles: [
      {
        label: 'Lead frontend developer',
        projects: [{ label: 'TheRedPin.ca', layout: 'plain' }],
      },
    ],
  },
  {
    from: { label: '2010', datetime: '2010' },
    to: { label: '2012', datetime: '2012' },
    company: 'CRITICAL MASS',
    roles: [
      {
        label: 'Sr web developer',
        projects: [
          { label: 'PcFinancial.ca', layout: 'plain' },
          { label: 'Infiniti.com', layout: 'plain' },
        ],
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
        projectsLayout: 'columns',
        projects: [
          { label: 'Front Page', value: '2010 FIFA World Cup' },
          { label: 'Media Portal', value: '2010 Winter Olympics Vancouver' },
        ],
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
        projectsLayout: 'grid',
        projects: [
          { label: 'iCoke.ca', layout: 'plain' },
          { label: 'JoeFresh.ca', layout: 'plain' },
          { label: 'Molson.ca', layout: 'plain' },
          { label: 'TimHortons.ca', layout: 'plain' },
        ],
      },
    ],
  },
]
