import { useParams } from 'react-router-dom'

/**
 * Placeholder registered by S-1.1 (AC2) so the route /projects/:p/flags/:flagId resolves and
 * receives `flagId`. The real Flag detail page is S-1.7, which replaces this component.
 */
export default function FlagDetailPage() {
  const { flagId } = useParams<{ flagId: string }>()
  return (
    <div data-testid="flag-detail-placeholder">
      <h1 className="text-2xl font-bold text-gray-900">Flag detail</h1>
      <p className="text-sm text-gray-500 mt-1">{flagId}</p>
    </div>
  )
}
