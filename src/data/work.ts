import type { ImageMetadata } from 'astro'
import livekitAgentsUiVideo from '@/assets/work/livekit-agents-ui-7s.webm'
import livekitAgentsUiPoster from '@/assets/work/livekit-agents-ui-7s.jpg'
// import livekitAgentUiDocsVideo from '@/assets/work/livekit-agent-ui-docs-16x9.mp4'
// import livekitAgentUiDocsPoster from '@/assets/work/livekit-agent-ui-docs-16x9.jpg'
import livekitRoboticsGlobeVideo from '@/assets/work/livekit-globe-10s.webm'
import livekitRoboticsGlobePoster from '@/assets/work/livekit-globe-10s.jpg'
// import livekitVideo from '@/assets/work/livekit-hp-16x9.mp4'
// import livekitPoster from '@/assets/work/livekit-hp-poster-16x9.jpg'
import livekitPricingCalculatorVideo from '@/assets/work/livekit-pricing-4x3-12s.webm'
import livekitPricingCalculatorPoster from '@/assets/work/livekit-pricing-4x3-12s.jpg'
import livekitRegionsGlobeVideo from '@/assets/work/livekit-uscentral-singapore-10s.webm'
import livekitRegionsGlobePoster from '@/assets/work/livekit-uscentral-singapore-10s.jpg'
import shopifyAssistantVideo from '@/assets/work/shopify-assistant-panel.mp4'
import shopifyAssistantPoster from '@/assets/work/shopify-assistant-panel-poster.jpg'
// import shopifyGraphqlVideo from '@/assets/work/shopify-graphql-16x9.mp4'
// import shopifyGraphqlPoster from '@/assets/work/shopify-graphql-poster-16x9.jpg'

/**
 * One tile of the Work carousel: a silent loop, which plays only enlarged, and
 * the still the tile shows as pixels. The tile takes the poster's shape, so the
 * two must match: most are 16:9, and a squarer or portrait loop makes a narrower
 * tile. A WebM loop is AV1, so a browser that cannot decode AV1 keeps its
 * pixels.
 * `title` is the tile's label and, as it comes to rest, the caption between
 * the steps.
 */
export type WorkItem = {
  title: string
  poster: ImageMetadata
  video: string
}

export const work: WorkItem[] = [
  {
    title: 'LiveKit - Agents UI hero animation',
    poster: livekitAgentsUiPoster,
    video: livekitAgentsUiVideo,
  },
  {
    title: 'LiveKit - Robotics globe',
    poster: livekitRoboticsGlobePoster,
    video: livekitRoboticsGlobeVideo,
  },
  {
    title: 'LiveKit - Pricing calculator',
    poster: livekitPricingCalculatorPoster,
    video: livekitPricingCalculatorVideo,
  },
  {
    title: 'LiveKit - Infrastructure globe',
    poster: livekitRegionsGlobePoster,
    video: livekitRegionsGlobeVideo,
  },
  {
    title: 'Shopify - Assistant panel',
    poster: shopifyAssistantPoster,
    video: shopifyAssistantVideo,
  },
  // {
  //   title: 'LiveKit - Homepage',
  //   poster: livekitPoster,
  //   video: livekitVideo,
  // },
  // {
  //   title: 'LiveKit - Agents UI docs',
  //   poster: livekitAgentUiDocsPoster,
  //   video: livekitAgentUiDocsVideo,
  // },
  // {
  //   title: 'Shopify - GraphQL Admin API reference',
  //   poster: shopifyGraphqlPoster,
  //   video: shopifyGraphqlVideo,
  // },
]
