"use client";

import { useMemo, useSyncExternalStore, type ComponentType } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { AdminFetchContext, createAdminFetch } from "./adminApi";
import DisplayTab from "./DisplayTab";
import GalleriesTab from "./GalleriesTab";
import UploadTab from "./UploadTab";
import RsvpsTab from "./RsvpsTab";
import PublicSquareTab from "./PublicSquareTab";
import LoginScreen from "./LoginScreen";
import { ChatIcon, ListIcon, MonitorIcon, PhotosIcon, UploadIcon } from "./icons";
import { Button } from "./ui";

/**
 * The admin page (/admin): one login, then tabs for the display kiosk's
 * remote, galleries, uploads, RSVPs and Public Square moderation. Built for a
 * phone first: tabs sit in a bar along the bottom on small screens and move
 * up into the header on a laptop. The open tab lives in the url hash
 * (/admin#galleries), so a tab can be bookmarked and the back button steps
 * between tabs. See website/docs/ADMIN.md.
 */

// the same key the old static admin page used, so existing logins carry over
const ADMIN_TOKEN_STORAGE_KEY = "adminToken";

interface AdminTab {
  id: string;
  /** Short name for the bottom bar. */
  label: string;
  /** Full name for the header. */
  title: string;
  Icon: ComponentType<{ className?: string }>;
  Content: ComponentType;
}

// the first tab is where /admin opens
const TABS: AdminTab[] = [
  { id: "display", label: "Display", title: "Display remote", Icon: MonitorIcon, Content: DisplayTab },
  { id: "galleries", label: "Galleries", title: "Galleries", Icon: PhotosIcon, Content: GalleriesTab },
  { id: "upload", label: "Upload", title: "Upload", Icon: UploadIcon, Content: UploadTab },
  { id: "rsvps", label: "RSVPs", title: "RSVPs", Icon: ListIcon, Content: RsvpsTab },
  { id: "square", label: "Square", title: "Public Square", Icon: ChatIcon, Content: PublicSquareTab },
];

/**
 * useSyncExternalStore subscription to the url hash.
 * @param onChange - Called when it changes.
 * @returns Unsubscribe.
 */
function subscribeToHash(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

const readHash = () => window.location.hash.slice(1);
// statically exported, so there's no hash at build time: render the first tab
const readNoHash = () => "";

/**
 * Which tab the url hash points at.
 * @returns The tab, the first one if the hash names none.
 */
function useCurrentTab(): AdminTab {
  const hash = useSyncExternalStore(subscribeToHash, readHash, readNoHash);
  return TABS.find((tab) => tab.id === hash) ?? TABS[0];
}

/**
 * A tab link, styled for the header (laptop) or the bottom bar (phone).
 * @param props.tab - The tab.
 * @param props.active - It's the open one.
 * @param props.place - header or bar.
 */
function TabLink({ tab, active, place }: { tab: AdminTab; active: boolean; place: "header" | "bar" }) {
  if (place === "bar") {
    return (
      <a
        href={`#${tab.id}`}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
          active ? "text-orange-400" : "text-slate-400"
        }`}
      >
        <tab.Icon className="h-6 w-6" />
        {tab.label}
      </a>
    );
  }
  return (
    <a
      href={`#${tab.id}`}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
        active ? "bg-slate-800 text-orange-400" : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"
      }`}
    >
      <tab.Icon className="h-4 w-4" />
      {tab.title}
    </a>
  );
}

/**
 * The admin page.
 */
export default function AdminPage() {
  const { token, ready, login, logout } = useAdminAuth(ADMIN_TOKEN_STORAGE_KEY);
  const adminFetch = useMemo(() => (token ? createAdminFetch(token, logout) : null), [token, logout]);
  const current = useCurrentTab();

  if (!ready) return <div className="min-h-dvh bg-slate-950" />;
  if (!adminFetch) {
    return (
      <div className="min-h-dvh bg-slate-950 text-slate-100">
        <LoginScreen login={login} />
      </div>
    );
  }

  return (
    <AdminFetchContext.Provider value={adminFetch}>
      <div className="min-h-dvh bg-slate-950 text-slate-100">
        <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
            <Link href="/" className="font-bold text-white">
              Admin
            </Link>
            <span className="truncate text-sm text-slate-400 md:hidden">{current.title}</span>
            <nav className="hidden flex-1 gap-1 md:flex">
              {TABS.map((tab) => (
                <TabLink key={tab.id} tab={tab} active={tab === current} place="header" />
              ))}
            </nav>
            <Button size="sm" variant="quiet" className="ml-auto md:ml-0" onClick={logout}>
              Log out
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 pb-28 pt-5 md:pb-12 md:pt-8">
          <current.Content />
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-800 bg-slate-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          <div className="grid grid-cols-5">
            {TABS.map((tab) => (
              <TabLink key={tab.id} tab={tab} active={tab === current} place="bar" />
            ))}
          </div>
        </nav>
      </div>
    </AdminFetchContext.Provider>
  );
}
