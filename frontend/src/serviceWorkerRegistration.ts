import { registerSW } from "virtual:pwa-register";
import { toast } from "sonner";

// Extend the Window interface to include the deferredPrompt property
declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Check if the browser supports service workers
const isSupported = 'serviceWorker' in navigator && 
                   (window.location.protocol === 'https:' || window.location.hostname === 'localhost');

// Function to register the service worker
const registerServiceWorker = () => {
  if (!isSupported) {
    console.warn('Service workers are not supported in this browser or on HTTP (except localhost)');
    return () => {};
  }

  const updateSW = registerSW({
    onNeedRefresh() {
      // Show a toast notification about the update
      toast('New version available!', {
        description: 'A new version of the app is available.',
        action: {
          label: 'Update',
          onClick: () => updateSW(true),
        },
        duration: 10000, // 10 seconds
        position: 'top-center'
      });
    },
    async onOfflineReady() {
      console.log('App ready to work offline');
      // Request notification permission if not already granted
      if ('Notification' in window && Notification.permission !== 'denied') {
        try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
        new Notification('App is ready for offline use');
          }
        } catch (error) {
          console.warn('Error requesting notification permission:', error);
        }
      }
    },
    onRegistered(registration) {
      if (registration) {
        console.log('Service Worker registered', registration);
        // Check for updates every hour
        setInterval(() => {
          registration.update().catch((err: Error) => {
            console.log('Error checking for updates:', err);
          });
        }, 60 * 60 * 1000);
      } else {
        console.log('Service Worker registration failed');
      }
    },
    onRegisterError(error: Error) {
      console.error('Error during service worker registration:', error);
    }
  });

  // Listen for controllerchange event which is fired when a new service worker takes control
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });

  return updateSW;
};

// Variable to store the beforeinstallprompt event
let deferredPrompt: BeforeInstallPromptEvent | null = null;

// Listen for the 'beforeinstallprompt' event to handle PWA installation
window.addEventListener('beforeinstallprompt', (e: BeforeInstallPromptEvent) => {
  // Prevent the default install prompt
  e.preventDefault();
  // Stash the event so it can be triggered later
  deferredPrompt = e;
  
  // Show custom install button or UI
  console.log('App can be installed');
  // You can implement your own UI to prompt the user to install the app
  // Example: showInstallButton();
});

// Function to handle the install button click
export const installApp = async (): Promise<boolean> => {
  if (!deferredPrompt) return false;
  
  try {
    // Show the install prompt
    await deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    // Clear the deferredPrompt variable
    deferredPrompt = null;
    
    return outcome === 'accepted';
  } catch (error) {
    console.error('Error during app installation:', error);
    return false;
  }
};

// Export the service worker registration function
export const register = registerServiceWorker();

// Register the service worker when the app loads
if (isSupported) {
  window.addEventListener('load', () => {
    registerServiceWorker();
  });
}

export default registerServiceWorker;