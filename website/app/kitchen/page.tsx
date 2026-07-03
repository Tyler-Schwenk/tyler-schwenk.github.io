"use client";

import PageWrapper from "@/components/PageWrapper";
import Image from "next/image";
import KitchenWindow from "@/components/kitchen/KitchenWindow";
import KitchenButton from "@/components/kitchen/KitchenButton";
import RecipeBrowser from "@/components/kitchen/RecipeBrowser";

const COOKBOOK_PDF_URL = "https://drive.google.com/file/d/13BWPrmZUnqTKYk3aeeXbBb_ateAsxtT5/view?usp=sharing";

/**
 * The Kitchen -- a recipe box you can add to from your phone, plus the
 * original friends-and-family cookbook PDF. Styled per the retro
 * desktop-OS design system in website/docs/themes/cookbook.md.
 *
 * @returns {JSX.Element} The Kitchen page.
 */
export default function Kitchen() {
  return (
    <PageWrapper>
      <div
        className="kitchen-theme min-h-screen bg-cover bg-center bg-fixed py-10 md:py-16"
        style={{ backgroundImage: "url('/images/woodbackground.jpg')" }}
      >
        <div className="container mx-auto px-4 md:px-6 max-w-4xl space-y-6">
          <h1 className="text-3xl md:text-4xl font-medium text-[var(--k-white)] text-center font-[family-name:var(--k-font-serif)] drop-shadow-[2px_2px_0_rgba(56,28,0,0.35)]">
            The Kitchen
          </h1>

          <RecipeBrowser />

          <KitchenWindow title="Download the Cookbook" floating>
            <div className="flex justify-center mb-5">
              <Image
                src="/images/recipies.png"
                alt="Recipes"
                width={320}
                height={240}
                className="rounded-[3px] border border-[var(--k-border-default)]"
              />
            </div>
            <p className="text-[15px] text-[var(--k-body)] text-center mb-5 font-[family-name:var(--k-font-sans)]">
              Recipes from friends and friends of friends, collected as a PDF.
            </p>
            <div className="flex justify-center">
              <a href={COOKBOOK_PDF_URL} target="_blank" rel="noopener noreferrer">
                <KitchenButton variant="secondary" size="lg">
                  View / Download PDF
                </KitchenButton>
              </a>
            </div>
          </KitchenWindow>
        </div>
      </div>
    </PageWrapper>
  );
}
