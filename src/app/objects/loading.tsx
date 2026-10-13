import { SectionLoading } from '@/components/states/SectionLoading'

/** Loading boundary for ['objects'] — real shell, geometry-matched skeleton. */
export default function Loading() {
  return <SectionLoading locale="fa" path="/objects" route={['objects']} variant="objects" />
}
