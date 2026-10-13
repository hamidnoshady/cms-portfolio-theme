import { SectionLoading } from '@/components/states/SectionLoading'

/** Loading boundary for ['en', 'projects'] — real shell, geometry-matched skeleton. */
export default function Loading() {
  return <SectionLoading locale="en" path="/projects" route={['en', 'projects']} variant="detail" />
}
