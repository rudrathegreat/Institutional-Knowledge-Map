import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteFooter } from "@/components/SiteFooter";

describe("SiteFooter", () => {
  it("includes the site-wide Puter attribution", () => {
    render(<SiteFooter />);

    expect(screen.getByRole("link", { name: "Powered by Puter" })).toHaveAttribute(
      "href",
      "https://puter.com",
    );
  });
});
