export type Post = {
  datetime: string
  /** the date as printed in the list, which is not always the datetime */
  date: string
  title: string
  href: string
  linkTitle: string
  blurb: string
}

export const posts: Post[] = [
  {
    datetime: '2022-06-11',
    date: '2022.06.11',
    title: 'cmyk-mix-blend-mode',
    href: 'https://thomasyuill.com/posts/2022-06-12-cmyk-mix-blend-mode',
    linkTitle: 'Blend it',
    blurb: "Playing around with CSS' mix blend mode.",
  },
  {
    datetime: '2022-05-22',
    date: '2022.05.22',
    title: 'color-system-design-tool',
    href: 'https://thomasyuill.com/posts/2022-05-23-color-system-design-tool',
    linkTitle: 'Taste the rainbow',
    blurb: 'A color system design tool.',
  },
  {
    datetime: '2022-05-18',
    date: '2022.05.18',
    title: 'react-network-canvas',
    href: 'https://thomasyuill.com/posts/2022-05-19-react-network-canvas',
    linkTitle: "Nodes 'n' edges",
    blurb:
      'A react component that provides a visual canvas and api for creating, editing, ' +
      'importing and exporting directed network graphs.',
  },
  {
    datetime: '2021-02-06',
    date: '2021.02.06',
    title: 'web-audio-experiments',
    href: 'https://thomasyuill.com/posts/2021-02-07-web-audio-drum-machine-and-synth',
    linkTitle: "Boots 'n' cats",
    blurb: 'A playground for web audio experiments.',
  },
]
