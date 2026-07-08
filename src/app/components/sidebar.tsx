import { SidebarBrand, SidebarNav } from "./sidebar-nav";

/** Desktop sidebar — hidden on phones (< 640px), unchanged layout on sm+ */
export function Sidebar() {
  return (
    <aside className="hidden h-full w-56 flex-col border-r border-border bg-gradient-to-b from-sidebar via-sidebar to-sidebar/95 sm:flex">
      <SidebarBrand />
      <SidebarNav />
    </aside>
  );
}
