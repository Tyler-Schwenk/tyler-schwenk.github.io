import Navigation from "@/components/Navigation";
import MicExplainer from "@/components/mic/MicExplainer";
import { DEFAULT_PREVIEW_IMAGE, pageMetadata } from "@/lib/siteMetadata";

export const metadata = pageMetadata({
  title: "The Military-Industrial Complex",
  description: "How U.S. tax money becomes weapons contracts, and where those weapons go.",
  path: "/mic",
  image: DEFAULT_PREVIEW_IMAGE,
});

/**
 * the military-industrial complex explainer. all the content lives in
 * micData.ts, so the page is just the shell.
 *
 * @returns {JSX.Element} the page.
 */
export default function MicPage() {
  return (
    <>
      <Navigation />
      <MicExplainer />
    </>
  );
}
