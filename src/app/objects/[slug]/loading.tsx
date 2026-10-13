import { SectionLoading } from '@/components/states/SectionLoading'

/** Loading boundary for ['objects', slug] — real shell, detail skeleton. */
export default function Loading() {
  return <SectionLoading locale="fa" path="/objects" route={['objects']} variant="detail" />
}
