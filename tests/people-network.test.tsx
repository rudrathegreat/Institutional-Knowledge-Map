import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { PeopleNetwork } from "@/components/PeopleNetwork";
import type { PeopleGraph } from "@/lib/people-graph";

const renderer = vi.hoisted(() => {
  type MockEvent = { target: { id: () => string } };
  type MockHandler = (event: MockEvent) => void;

  const handlers: Record<string, MockHandler> = {};
  const collection: Record<string, ReturnType<typeof vi.fn>> = {};
  const core: Record<string, ReturnType<typeof vi.fn>> = {};
  const layout: Record<string, ReturnType<typeof vi.fn>> = {};

  collection.removeClass = vi.fn(() => collection);
  collection.addClass = vi.fn(() => collection);
  collection.not = vi.fn(() => collection);
  collection.union = vi.fn(() => collection);
  collection.empty = vi.fn(() => false);
  collection.closedNeighborhood = vi.fn(() => collection);
  collection.connectedEdges = vi.fn(() => collection);
  collection.connectedNodes = vi.fn(() => collection);

  layout.one = vi.fn((_eventName: string, callback: () => void) => {
    callback();
    return layout;
  });
  layout.run = vi.fn(() => layout);

  core.on = vi.fn(
    (
      _eventName: string,
      selectorOrHandler: string | MockHandler,
      handler?: MockHandler,
    ) => {
      if (typeof selectorOrHandler === "string" && handler) {
        handlers[selectorOrHandler] = handler;
      }
      return core;
    },
  );
  core.layout = vi.fn(() => layout);
  core.elements = vi.fn(() => collection);
  core.getElementById = vi.fn(() => collection);
  core.resize = vi.fn(() => core);
  core.destroy = vi.fn(() => core);
  core.animate = vi.fn(() => core);
  core.fit = vi.fn(() => core);
  core.minZoom = vi.fn(() => 0.35);
  core.maxZoom = vi.fn(() => 2.25);
  core.zoom = vi.fn((value?: unknown) => (value ? core : 1));

  return {
    collection,
    core,
    factory: vi.fn(() => core),
    handlers,
    layout,
  };
});

vi.mock("cytoscape", () => ({
  default: renderer.factory,
}));

const graph: PeopleGraph = {
  nodes: [
    {
      id: "maya",
      slug: "maya-chen",
      name: "Maya Chen",
      title: "Senior Research Fellow",
      role: "Pulsar Astronomer",
      researchAreas: ["pulsars", "radio astronomy"],
    },
    {
      id: "daniel",
      slug: "daniel-brooks",
      name: "Daniel Brooks",
      title: "Research Fellow",
      role: "Radio Astronomer",
      researchAreas: ["pulsars", "interstellar medium"],
    },
  ],
  edges: [
    {
      id: "daniel--maya",
      sourceId: "daniel",
      targetId: "maya",
      score: 7,
      evidence: [
        { category: "research area", label: "pulsars" },
        { category: "instrument", label: "MeerKAT" },
      ],
    },
  ],
};

class MockResizeObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}

describe("PeopleNetwork", () => {
  beforeEach(() => {
    renderer.factory.mockImplementation(() => renderer.core);
    Object.keys(renderer.handlers).forEach((key) => delete renderer.handlers[key]);
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true }) as MediaQueryList),
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("finds a person, shows connections, and navigates between people", async () => {
    const user = userEvent.setup();
    render(<PeopleNetwork graph={graph} />);

    await user.type(
      screen.getByRole("combobox", { name: "Find a person" }),
      "Maya",
    );
    await user.click(screen.getByRole("button", { name: "Focus" }));

    expect(
      screen.getByRole("heading", { name: "Maya Chen" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View profile/ })).toHaveAttribute(
      "href",
      "/people/maya-chen",
    );

    await user.click(
      screen.getByRole("button", { name: /Daniel Brooks.*pulsars/ }),
    );
    expect(
      screen.getByRole("heading", { name: "Daniel Brooks" }),
    ).toBeInTheDocument();
  });

  it("inspects a graph edge and exposes both endpoint actions", () => {
    render(<PeopleNetwork graph={graph} />);

    act(() => {
      renderer.handlers.edge({
        target: { id: () => "daniel--maya" },
      });
    });

    expect(
      screen.getByText(/shared stored expertise, not a claimed collaboration/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Focus Maya Chen" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Focus Daniel Brooks" }),
    ).toBeInTheDocument();
    expect(screen.getByText("MeerKAT")).toBeInTheDocument();
  });

  it("connects the zoom and fit controls to the renderer", async () => {
    const user = userEvent.setup();
    render(<PeopleNetwork graph={graph} />);

    const zoomIn = screen.getByRole("button", { name: "Zoom in" });
    await waitFor(() => expect(zoomIn).toBeEnabled());
    await user.click(zoomIn);
    await user.click(screen.getByRole("button", { name: "Fit all" }));

    expect(renderer.core.zoom).toHaveBeenCalledWith(
      expect.objectContaining({ level: 1.22 }),
    );
    expect(renderer.core.fit).toHaveBeenCalledWith(undefined, 48);
  });

  it("keeps HTML navigation available when the renderer fails", async () => {
    renderer.factory.mockImplementationOnce(() => {
      throw new Error("Renderer unavailable");
    });
    const user = userEvent.setup();
    render(<PeopleNetwork graph={graph} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The interactive view could not be loaded.",
    );

    await user.type(
      screen.getByRole("combobox", { name: "Find a person" }),
      "Daniel Brooks",
    );
    await user.click(screen.getByRole("button", { name: "Focus" }));
    expect(
      screen.getByRole("heading", { name: "Daniel Brooks" }),
    ).toBeInTheDocument();
  });

  it("renders an empty state when there are no people", () => {
    render(<PeopleNetwork graph={{ nodes: [], edges: [] }} />);

    expect(
      screen.getByRole("heading", { name: "No people to map yet" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse people" })).toHaveAttribute(
      "href",
      "/people",
    );
  });
});
