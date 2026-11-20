"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { SET_PAGE_PATH } from "@/app/opium-den/djApi";

/**
 * where set pages used to be, before the dj sets moved under /opium-den/live. links to
 * it were already shared, so it forwards to the same set's page there, query and all.
 * a static export can't redirect on the server, hence doing it on the client.
 *
 * @returns {JSX.Element} a one-line note while it forwards.
 */
export default function OldSetPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`${SET_PAGE_PATH}${window.location.search}`);
  }, [router]);

  return <p className="px-5 pt-28 text-sm text-den-faint">taking you to the set...</p>;
}
