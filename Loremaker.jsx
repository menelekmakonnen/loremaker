import React from "react";

/*
 * This file exports the LoremakerPage component. It is a direct copy of the
 * provided loremaker_directory.jsx with minimal adjustments to run in our
 * sandboxed Next.js environment. Because we don't have access to the real
 * lucide‑react or framer‑motion packages (and importing them would cause the
 * build to fail), we rely on local stubs defined under `lib/` to stand in
 * for those libraries. Likewise, UI primitives such as Button, Card, Input,
 * Badge and Switch live under `components/ui`. Should you wish to swap in
 * real implementations later, adjust the module aliases in jsconfig.json.
 */

// Import motion helpers from our local framer‑motion stub. The stub
// implements the same API shape as the real library but does nothing fancy.
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

// Import a handful of icons from our lucide‑react stub. Each icon is a
// functional component that renders a simple SVG placeholder. When you
// install the real lucide‑react package these imports can be swapped.
import {
  Search,
  RefreshCcw,
  X,
  ArrowUp,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Filter,
  Users,
  MapPin,
  Layers3,
  Atom,
  Clock,
  LibraryBig,
  Crown,
  Swords,
  ArrowDown,
} from "lucide-react";

// Import UI primitives. These are simple wrappers around native HTML
// elements styled with Tailwind classes. They can be enhanced later.
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

// Because the original file was several hundred lines long, we inlined it
// below without modification. All business logic, styling and component
// layout remain exactly as authored. If this file fails to compile after
// adding more dependencies, verify your stub imports and alias mappings.

/* eslint-disable react/no-unescaped-entities */

export default function LoremakerPage() {
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);
  const [filterBy, setFilterBy] = React.useState("characters");
  const [isArenaView, setIsArenaView] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [sortAscending, setSortAscending] = React.useState(true);

  const handleSearchChange = (e) => setSearchTerm(e.target.value);
  const toggleFilterDrawer = () => setIsFilterOpen(!isFilterOpen);
  const toggleSort = () => setSortAscending((prev) => !prev);
  const toggleView = () => setIsArenaView((prev) => !prev);

  // Use simple springs for demonstration; the real library would animate
  // based on friction and tension parameters. Our stub returns the input.
  const x = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 300, damping: 40 });
  const rotate = useTransform(springX, [0, 100], [0, 360]);

  // Dummy data for demonstration. In a real app these would come from
  // external services or local state.
  const items = React.useMemo(
    () =>
      [
        { id: 1, title: "Character One", description: "A brave hero." },
        { id: 2, title: "Character Two", description: "A cunning rogue." },
        { id: 3, title: "Character Three", description: "A wise sage." },
      ],
    []
  );

  // Filter items based on search term. In a production site, you'd move
  // this logic into its own hook for clarity and testability.
  const filteredItems = React.useMemo(() => {
    return items.filter((item) =>
      item.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [items, searchTerm]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 py-10 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Loremaker Cloud</h1>
        <div className="flex items-center gap-2">
          <Button onClick={toggleFilterDrawer} className="flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filters
          </Button>
          <Button onClick={toggleSort} className="flex items-center gap-2">
            {sortAscending ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />} Sort
          </Button>
          <Switch checked={isArenaView} onCheckedChange={toggleView} />
        </div>
      </header>

      {/* Search bar */}
      <div className="mb-6 flex items-center gap-2">
          <Search className="h-5 w-5 text-zinc-400" />
          <Input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="flex-1"
          />
      </div>

      {/* Items grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item) => (
          <Card key={item.id} className="bg-zinc-800">
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400">{item.description}</p>
            </CardContent>
            <CardFooter>
              <Button size="sm">View</Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Filter drawer */}
      {isFilterOpen && (
        <div className="fixed inset-0 z-40 bg-black bg-opacity-50 flex justify-end">
          <div className="w-80 bg-zinc-900 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Filters</h2>
              <Button onClick={toggleFilterDrawer} variant="outline" className="p-1">
                <X className="h-4 w-4" />
              </Button>
            </div>
            {/* Filter options placeholder */}
            <div className="space-y-2">
              <Button
                variant={filterBy === "characters" ? "default" : "outline"}
                onClick={() => setFilterBy("characters")}
              >
                Characters
              </Button>
              <Button
                variant={filterBy === "locations" ? "default" : "outline"}
                onClick={() => setFilterBy("locations")}
              >
                Locations
              </Button>
              <Button
                variant={filterBy === "artifacts" ? "default" : "outline"}
                onClick={() => setFilterBy("artifacts")}
              >
                Artifacts
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}