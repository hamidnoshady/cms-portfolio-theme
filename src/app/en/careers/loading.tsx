import { SectionLoading } from '@/components/states/SectionLoading'

/** Loading boundary for ['en', 'careers'] — real shell, geometry-matched skeleton. */
export default function Loading() {
  return <SectionLoading locale="en" path="/careers" route={['en', 'careers']} variant="page" />
}
