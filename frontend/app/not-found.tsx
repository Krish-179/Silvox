import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg text-text px-6 text-center">
      <Compass size={32} className="text-muted mb-6" />
      <h1 className="font-display text-3xl mb-3" style={{ fontWeight: 500 }}>
        Page not found
      </h1>
      <p className="text-muted text-base max-w-sm mb-8">
        The page you're looking for doesn't exist, or the URL might be off.
      </p>
      <Link
        href="/"
        className="bg-accent text-bg text-sm font-medium px-5 py-3 rounded-md transition-all duration-300 ease-out hover:shadow-lg hover:shadow-accent/25"
      >
        Back to home
      </Link>
    </div>
  );
}
