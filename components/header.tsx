"use client";

import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";

export default function Header() {
  return (
    <header className="flex justify-between items-center p-4 bg-gray-100">
      <h1 className="text-xl font-bold">Gotham Comedy Club</h1>
      <div>
        <SignedOut>
          <div className="flex gap-2">
            <SignInButton mode="modal" />
            <SignUpButton mode="modal" />
          </div>
        </SignedOut>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </div>
    </header>
  );
}
