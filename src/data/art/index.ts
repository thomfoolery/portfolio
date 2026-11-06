import blockExperience from './block/experience.html?raw'
import blockFooter from './block/footer.html?raw'
import blockHeader from './block/header.html?raw'
import blockHonors from './block/honors.html?raw'
import blockPosts from './block/posts.html?raw'

/** One heading fragment per section of the résumé. */
export type SectionArt = {
  header: string
  posts: string
  experience: string
  honors: string
  footer: string
}

/**
 * The ASCII art is content, not structure: it is 30-45% of the page's bytes and
 * almost entirely colour spans, so it lives in .html fragments and is injected
 * rather than written out as a template.
 */
export const blockArt: SectionArt = {
  header: blockHeader,
  posts: blockPosts,
  experience: blockExperience,
  honors: blockHonors,
  footer: blockFooter,
}
