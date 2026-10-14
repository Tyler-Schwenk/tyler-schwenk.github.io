import type { Metadata } from "next";
import Link from "next/link";

// where the cookbook lives now. the old /cookbook url is printed as a qr code in
// the physical cookbooks, so this page has to stick around forever
const KITCHEN_PATH = "/kitchen";

// keep the old url out of search results so google only lists the real page
export const metadata: Metadata = {
  title: "The Kitchen",
  robots: { index: false, follow: true },
};

/**
 * Old cookbook url that forwards to The Kitchen.
 *
 * the site's a static export, so there are no server-side redirects. a meta refresh
 * does it instead -- it fires as soon as the html parses, no js needed. react hoists
 * the meta tag into the head.
 *
 * @returns {JSX.Element} The refresh tag plus a fallback link in case it doesn't fire.
 */
export default function CookbookRedirect() {
  return (
    <>
      <meta httpEquiv="refresh" content={`0; url=${KITCHEN_PATH}`} />
      <main className="flex min-h-screen items-center justify-center p-4">
        <Link href={KITCHEN_PATH} className="underline">
          The cookbook has moved to The Kitchen. Click here if you aren&apos;t redirected.
        </Link>
      </main>
    </>
  );
}
