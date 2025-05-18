// Fix para navegadores (STOMP.js y otras librerías)
(window as any).global = window;
(window as any).process = { env: {} };