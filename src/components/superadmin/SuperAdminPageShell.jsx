import Header from '../Header';
import '../../styles/SuperAdminMain.css';

/**
 * Shared shell for super admin pages — Header + scrollable main using app theme.
 */
export default function SuperAdminPageShell({
  title,
  subtitle,
  className = '',
  loading = false,
  loadingText = 'Loading...',
  error = null,
  onRetry,
  children,
}) {
  return (
    <div className={`main-content sa-portal-page ${className}`.trim()}>
      <Header title={title} subtitle={subtitle} />
      <div className="page-content sa-portal-main custom-scrollbar">
        {loading ? (
          <div className="sa-portal-loading">
            <div className="sa-portal-spinner" />
            <p>{loadingText}</p>
          </div>
        ) : error ? (
          <div className="card sa-portal-error">
            <p>{error}</p>
            {onRetry && (
              <button type="button" className="hr-btn-primary" onClick={onRetry}>
                Retry
              </button>
            )}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
