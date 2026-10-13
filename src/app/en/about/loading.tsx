import { SectionLoading } from '@/components/states/SectionLoading'

/** Loading boundary for ['en', 'about'] — real shell, geometry-matched skeleton. */
export default function Loading() {
  return <SectionLoading locale="en" path="/about" route={['en', 'about']} variant="page" />
}
