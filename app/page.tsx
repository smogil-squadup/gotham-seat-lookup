"use client";

import { SignedIn, SignedOut, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Lock } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.push("/dashboard");
    }
  }, [isLoaded, isSignedIn, router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <SignedIn>
        <div className="text-center">
          <p className="text-gray-600">Redirecting to dashboard...</p>
        </div>
      </SignedIn>

      <SignedOut>
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <Lock className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Gotham Seat Lookup
            </h1>
            <p className="text-gray-600">Event Attendee Search Tool</p>
          </div>

          <div className="space-y-4">
            <p className="text-center text-sm text-gray-600 mb-6">
              Please sign in to access the seat lookup tool.
            </p>

            <div className="text-center">
              <p className="text-xs text-gray-500">
                Click &quot;Sign in&quot; in the header to continue
              </p>
            </div>
          </div>
        </div>
      </SignedOut>
    </main>
  );
}
