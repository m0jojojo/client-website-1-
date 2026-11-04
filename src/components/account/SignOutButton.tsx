"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { authClient } from "@/lib/auth-client";
import { wishlistStore } from "@/lib/wishlist-store";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await authClient.signOut();
    } finally {
      // Wipe the saved items from this browser right away (the account keeps its own copy), so
      // the next person on a shared computer never sees them, even if the page is reloaded at once.
      wishlistStore.clear();
      router.push("/");
      router.refresh();
    }
  }

  return (
    <Button variant="secondary" onClick={signOut} disabled={busy}>
      {busy ? "Signing out..." : "Sign out"}
    </Button>
  );
}
