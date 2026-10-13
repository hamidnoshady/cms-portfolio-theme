import { SectionLoading } from '@/components/states/SectionLoading'

/** Loading boundary for ['projects', slug] — real shell, detail skeleton. */
export default function Loading() {
  return <SectionLoading locale="fa" path="/projects" route={['projects']} variant="detail" />
}
