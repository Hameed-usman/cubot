import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://cubot.cityuniversity.edu.pk'
  return [
    { url: base, lastModified: new Date(), changeFrequency: 'monthly', priority: 1 },
    { url: `${base}/chat`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
  ]
}
