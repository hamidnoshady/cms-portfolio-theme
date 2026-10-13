import { SectionLoading } from '@/components/states/SectionLoading'

/** Loading boundary for ['en', 'objects'] — real shell, geometry-matched skeleton. */
export default function Loading() {
  return <SectionLoading locale="en" path="/objects" route={['en', 'objects']} variant="objects" />
}
