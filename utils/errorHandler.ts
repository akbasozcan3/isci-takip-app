if (typeof global !== 'undefined') {
  const setupPromiseRejectionHandler = () => {
    if (typeof ErrorUtils !== 'undefined') {
      const originalHandler = ErrorUtils.getGlobalHandler();
      
      ErrorUtils.setGlobalHandler((error, isFatal) => {
        const errorMessage = error?.message || error?.toString() || '';
        
        if (
          errorMessage.includes('ExpoFontLoader.loadAsync') ||
          errorMessage.includes('ionicons') ||
          (errorMessage.includes('Call to function') &&
           (errorMessage.includes('ExpoFontLoader') || errorMessage.includes('ionicons'))) ||
          errorMessage.includes('keep awake') ||
          errorMessage.includes('KeepAwake') ||
          errorMessage.includes('Unable to activate keep awake')
        ) {
          return;
        }
        
        if (originalHandler) {
          originalHandler(error, isFatal);
        }
      });
    }
  };
  
  setupPromiseRejectionHandler();
}

const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  const message = args[0]?.toString() || '';
  
  if (
    message.includes('ExpoFontLoader.loadAsync') ||
    message.includes('ionicons') ||
    (message.includes('Call to function') &&
     (message.includes('ExpoFontLoader') || message.includes('ionicons'))) ||
    (message.includes('Uncaught (in promise') &&
     (message.includes('ExpoFontLoader') || message.includes('ionicons'))) ||
    message.includes('keep awake') ||
    message.includes('KeepAwake') ||
    message.includes('Unable to activate keep awake')
  ) {
    return;
  }
  
  originalConsoleError.apply(console, args);
};

const originalConsoleWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const message = args[0]?.toString() || '';
  
  if (message.includes('ExpoFontLoader') || message.includes('ionicons')) {
    return;
  }
  
  originalConsoleWarn.apply(console, args);
};

export { };

