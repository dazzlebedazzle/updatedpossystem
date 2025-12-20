import { CircleLoader } from 'react-spinners';

export default function LoadingButton({
  children,
  loading = false,
  loadingText = 'Loading...',
  disabled = false,
  className = '',
  variant = 'primary',
  ...props
}) {
  const baseClasses = 'inline-flex items-center justify-center px-4 py-2 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantClasses = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500',
    outline: 'bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 focus:ring-gray-500'
  };

  // Determine spinner color based on variant
  const getSpinnerColor = () => {
    switch (variant) {
      case 'primary':
        return '#ffffff';
      case 'danger':
        return '#ffffff';
      case 'success':
        return '#ffffff';
      case 'secondary':
        return '#111827';
      case 'outline':
        return '#111827';
      default:
        return '#ffffff';
    }
  };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    >
      {loading ? (
        <span className="inline-flex items-center">
          <CircleLoader
            color={getSpinnerColor()}
            size={16}
            aria-label="Loading"
          />
          <span className="ml-2">{loadingText}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}

