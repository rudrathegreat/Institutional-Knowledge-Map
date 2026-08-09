import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import { SiteHeader } from "@/components/SiteHeader";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

describe("SiteHeader", () => {
  it("marks Search as active on the search page", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "People" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("keeps People active on an individual profile", () => {
    vi.mocked(usePathname).mockReturnValue("/people/maya-chen");
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "People" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
  });
});
