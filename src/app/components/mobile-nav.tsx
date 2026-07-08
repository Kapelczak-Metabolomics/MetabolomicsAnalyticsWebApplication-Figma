import { Sheet, SheetContent, SheetTitle, SheetDescription } from "./ui/sheet";
import { SidebarBrand, SidebarNav } from "./sidebar-nav";
import { useLayout } from "../../contexts/layout-context";

export function MobileNav() {
  const { mobileNavOpen, setMobileNavOpen } = useLayout();

  return (
    <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
      <SheetContent side="left" className="w-[min(300px,88vw)] gap-0 border-r border-sidebar-border bg-gradient-to-b from-sidebar via-sidebar to-sidebar/95 p-0 text-sidebar-foreground">
        <SheetTitle className="sr-only">Navigation menu</SheetTitle>
        <SheetDescription className="sr-only">Main application navigation</SheetDescription>
        <SidebarBrand />
        <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
