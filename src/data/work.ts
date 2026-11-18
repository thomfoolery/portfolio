import type { ImageMetadata } from 'astro'
import livekitAgentsUiVideo from '@/assets/work/livekit-agents-ui-16x9.mp4'
import livekitAgentsUiPoster from '@/assets/work/livekit-agents-ui-poster3-16x9.jpg'
import livekitAgentUiDocsVideo from '@/assets/work/livekit-agent-ui-docs-16x9.mp4'
import livekitAgentUiDocsPoster from '@/assets/work/livekit-agent-ui-docs-16x9.jpg'
import livekitGlobeVideo from '@/assets/work/livekit-globe-16x9.mp4'
import livekitGlobePoster from '@/assets/work/livekit-globe-16x9.jpg'
import livekitVideo from '@/assets/work/livekit-hp-16x9.mp4'
import livekitPoster from '@/assets/work/livekit-hp-poster-16x9.jpg'
import livekitPricingVideo from '@/assets/work/livekit-pricing-16x9_1.mp4'
import livekitPricingPoster from '@/assets/work/livekit-pricing-poster4-16x9.jpg'
import shopifyAssistantVideo from '@/assets/work/shopify-assistant-panel.mp4'
import shopifyAssistantPoster from '@/assets/work/shopify-assistant-panel-poster.jpg'
import shopifyGraphqlVideo from '@/assets/work/shopify-graphql-16x9.mp4'
import shopifyGraphqlPoster from '@/assets/work/shopify-graphql-poster-16x9.jpg'

/**
 * One tile of the Work carousel: a silent loop, and the still it shows until
 * the loop plays, or instead of it. The tile takes the poster's shape, so the
 * two must match: most are 16:9, and a portrait loop makes a narrow tile.
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
    title: 'LiveKit - Homepage',
    poster: livekitPoster,
    video: livekitVideo,
  },
  {
    title: 'LiveKit - infrastructure globe',
    poster: livekitGlobePoster,
    video: livekitGlobeVideo,
  },
  {
    title: 'LiveKit - Agents UI page',
    poster: livekitAgentsUiPoster,
    video: livekitAgentsUiVideo,
  },
  {
    title: 'LiveKit - Agents UI docs',
    poster: livekitAgentUiDocsPoster,
    video: livekitAgentUiDocsVideo,
  },
  {
    title: 'LiveKit - pricing page',
    poster: livekitPricingPoster,
    video: livekitPricingVideo,
  },
  {
    title: 'Shopify - GraphQL Admin API reference',
    poster: shopifyGraphqlPoster,
    video: shopifyGraphqlVideo,
  },
  {
    title: 'Shopify - Assistant panel',
    poster: shopifyAssistantPoster,
    video: shopifyAssistantVideo,
  },
]
