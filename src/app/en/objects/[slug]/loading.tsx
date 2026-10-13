import { SectionLoading } from '@/components/states/SectionLoading'

/** Loading boundary for ['en', 'objects', slug] — real shell, detail skeleton. */
export default function Loading() {
  return <SectionLoading locale="en" path="/objects" route={['en', 'objects']} variant="detail" />
}
