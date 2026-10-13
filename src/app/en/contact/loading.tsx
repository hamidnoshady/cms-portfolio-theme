import { SectionLoading } from '@/components/states/SectionLoading'

/** Loading boundary for ['en', 'contact'] — real shell, geometry-matched skeleton. */
export default function Loading() {
  return <SectionLoading locale="en" path="/contact" route={['en', 'contact']} variant="page" />
}
