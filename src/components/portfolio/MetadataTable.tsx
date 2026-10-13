/** Year, type, location, collaborators + optional additional facts. */
export const MetadataTable = ({ facts }: { facts: Array<{ label: string; value: string }> }) => {
  if (facts.length === 0) return null
  return (
    <dl className="bang-facts">
      {facts.map((f) => (
        <div className="bang-facts__row" key={f.label}>
          <dt>{f.label}</dt>
          <dd>{f.value}</dd>
        </div>
      ))}
    </dl>
  )
}
