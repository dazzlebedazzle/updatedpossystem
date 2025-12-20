export function Loader({ size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className={`${sizeClasses[size]} border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin`}
        role="status"
        aria-label="Loading"
      >
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  );
}

export default Loader;

export function PageLoader({ fullScreen = false }) {
  const containerClasses = fullScreen 
    ? 'fixed inset-0 flex flex-col items-center justify-center bg-white z-50'
    : 'flex flex-col items-center justify-center min-h-[400px] py-12 bg-white';
  
  return (
    <div className={containerClasses}>
      <div className="w-12 h-12 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin"></div>
    </div>
  );
}

export function InlineLoader({ className = '' }) {
  return (
    <div className={`inline-flex items-center ${className}`}>
      <div className="w-4 h-4 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin mr-2"></div>
      <span className="text-sm">Loading...</span>
    </div>
  );
}

