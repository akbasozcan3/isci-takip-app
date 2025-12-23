if (typeof global !== 'undefined') {
  const setupPromiseRejectionHandler = () => {
    if (typeof ErrorUtils !== 'undefined') {
      ErrorUtils.setGlobalHandler(() => {});
    }
  };
  setupPromiseRejectionHandler();
}

const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

console.error = () => {};
console.warn = () => {};
console.log = () => {};

if (typeof window !== 'undefined') {
  window.onerror = () => true;
  window.onunhandledrejection = () => true;
}

export { };

