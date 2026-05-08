import { createFileRoute, Outlet, useNavigate, useMatches } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

export const Route = createFileRoute("/groups")({ component: GroupsLayout });

function GroupsLayout() {
  const navigate = useNavigate();
  const matches = useMatches();
  const detailMatch = matches.find((m) => m.routeId === "/groups/$slug");
  const open = !!detailMatch;
  const slug = (detailMatch?.params as { slug?: string } | undefined)?.slug ?? "";

  return (
    <>
      {/* List always rendered underneath */}
      <Outlet />
      <Sheet open={open} onOpenChange={(o) => { if (!o) navigate({ to: "/groups" as never }); }}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto p-0 sm:max-w-xl data-[state=open]:duration-300"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>
              <VisuallyHidden>Group {slug}</VisuallyHidden>
            </SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-10 pt-5 md:px-6">
            {/* The /groups/$slug route renders here via the router; but since Outlet is above,
                we re-render the same matched element by reading children of the detail match. */}
            {detailMatch ? <DetailMount key={slug} /> : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// Mounts the detail route's component by reading the matched route element.
// We import the component directly to avoid double-mounting via Outlet.
import { GroupDetailView } from "./groups.$slug";
function DetailMount() {
  return <GroupDetailView />;
}
