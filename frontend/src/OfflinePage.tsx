import { Button } from "@/components/ui/button";
import { WifiOff } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function OfflinePage() {
  const navigate = useNavigate();

  const handleRetry = () => {
    window.location.reload();
  };

  const goHome = () => {
    if (navigator.onLine) {
      navigate('/');
    } else {
      navigate('/offline');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-background">
      <div className="p-6 rounded-full bg-muted mb-6">
        <WifiOff className="w-16 h-16 text-destructive" />
      </div>
      <h1 className="text-3xl font-bold mb-2">You're offline</h1>
      <p className="text-blue-600 mb-6 max-w-md">
        It seems you're not connected to the internet. Please check your connection and try again.
      </p>
      <div className="flex gap-4">
        <Button variant="outline" onClick={goHome}>
          Go to Home
        </Button>
        <Button onClick={handleRetry}>
          Retry
        </Button>
      </div>
    </div>
  );
}
