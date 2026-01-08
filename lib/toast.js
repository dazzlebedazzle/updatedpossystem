// Toast notification utility
// Using a module-level array to store listeners
const toastListeners = [];

// Create toast object with methods
const toast = {
  show: function(message, type = 'success') {
    toastListeners.forEach(listener => {
      if (typeof listener === 'function') {
        try {
          listener({ message, type, isVisible: true });
        } catch (error) {
          console.error('Toast listener error:', error);
        }
      }
    });
  },
  success: function(message) {
    toast.show(message, 'success');
  },
  error: function(message) {
    toast.show(message, 'error');
  },
  warning: function(message) {
    toast.show(message, 'warning');
  },
  info: function(message) {
    toast.show(message, 'info');
  },
  subscribe: function(listener) {
    if (typeof listener === 'function') {
      toastListeners.push(listener);
      return function() {
        const index = toastListeners.indexOf(listener);
        if (index > -1) {
          toastListeners.splice(index, 1);
        }
      };
    }
    return function() {};
  }
};

export { toast };
export default toast;

