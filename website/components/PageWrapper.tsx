import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

interface PageWrapperProps {
  children: React.ReactNode;
  hideFooter?: boolean;
  hideNavigation?: boolean;
}

export default function PageWrapper({ children, hideFooter, hideNavigation }: PageWrapperProps) {
  return (
    <>
      {!hideNavigation && <Navigation />}
      {children}
      {!hideFooter && <Footer />}
    </>
  );
}
