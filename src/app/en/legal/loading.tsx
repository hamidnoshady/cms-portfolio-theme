import { SectionLoading } from '@/components/states/SectionLoading'

/** Loading boundary for ['en', 'legal'] — real shell, geometry-matched skeleton. */
export default function Loading() {
  return <SectionLoading locale="en" path="/legal" route={['en', 'legal']} variant="page" />
}
