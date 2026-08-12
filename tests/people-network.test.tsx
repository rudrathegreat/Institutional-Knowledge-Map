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
  layout.stop = vi.fn(() => layout);

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
    factory: vi.fn((options?: unknown) => {
      void options;
      return core;
    }),
    handlers,
    layout,
  };
});

vi.mock("cytoscape", () => ({
  default: renderer.factory,
}));

const graph: PeopleGraph = {
  groups: [
    { id: "radio-group", name: "Radio Astronomy & Pulsars" },
  ],
  nodes: [
    {
      id: "maya",
      slug: "maya-chen",
      name: "Maya Chen",
      title: "Senior Research Fellow",
      role: "Pulsar Astronomer",
      researchGroups: [
        {
          id: "radio-group",
          name: "Radio Astronomy & Pulsars",
          isPrimary: true,
        },
      ],
      primaryResearchGroupId: "radio-group",
      researchAreas: ["pulsars", "radio astronomy"],
    },
    {
      id: "daniel",
      slug: "daniel-brooks",
      name: "Daniel Brooks",
      title: "Research Fellow",
      role: "Radio Astronomer",
      researchGroups: [
        {
          id: "radio-group",
          name: "Radio Astronomy & Pulsars",
          isPrimary: true,
        },
      ],
      primaryResearchGroupId: "radio-group",
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
    vi.clearAllMocks();
    window.history.replaceState(null, "", "/network");
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
    expect(
      screen.getByRole("heading", { name: "Research groups" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Primary")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Daniel Brooks.*pulsars/ }),
    );
    expect(
      screen.getByRole("heading", { name: "Daniel Brooks" }),
    ).toBeInTheDocument();
  });

  it("groups people by their primary tag and keeps tags on each node", () => {
    render(<PeopleNetwork graph={graph} />);

    const configuration = renderer.factory.mock.calls[0]?.[0] as unknown as {
      elements: Array<{
        classes?: string;
        data: { id: string; parent?: string; label?: string; groupLabel?: string };
      }>;
    };
    const mayaElement = configuration.elements.find(
      ({ data }) => data.id === "maya",
    );

    expect(
      configuration.elements.find(
        ({ classes }) => classes === "research-group",
      )?.data,
    ).toMatchObject({
      id: "research-group:radio-group",
      label: "Radio Astronomy & Pulsars",
    });
    expect(mayaElement).toMatchObject({
      classes: "person",
      data: {
        label: "Maya Chen\nRadio Astronomy & Pulsars",
        groupLabel: "Radio Astronomy & Pulsars",
        parent: "research-group:radio-group",
      },
    });
    expect(
      screen.getByLabelText("Research group tags"),
    ).toHaveTextContent("Radio Astronomy & Pulsars");
  });

  it("survives Strict Mode mount, cleanup, remount, and unmount", () => {
    const { unmount } = render(<PeopleNetwork graph={graph} />, {
      reactStrictMode: true,
    });

    expect(renderer.factory).toHaveBeenCalledTimes(2);
    expect(renderer.core.layout).toHaveBeenCalledWith(
      expect.objectContaining({ name: "cose", animate: false }),
    );
    expect(renderer.layout.stop).toHaveBeenCalledTimes(1);
    expect(renderer.core.destroy).toHaveBeenCalledTimes(1);

    unmount();

    expect(renderer.layout.stop).toHaveBeenCalledTimes(2);
    expect(renderer.core.destroy).toHaveBeenCalledTimes(2);
    const stopCalls = renderer.layout.stop.mock.invocationCallOrder;
    const destroyCalls = renderer.core.destroy.mock.invocationCallOrder;
    expect(stopCalls[0]).toBeLessThan(destroyCalls[0]);
    expect(stopCalls[1]).toBeLessThan(destroyCalls[1]);
  });

  it("inspects a graph edge and exposes both endpoint actions", () => {
    render(<PeopleNetwork graph={graph} />);

    act(() => {
      renderer.handlers.edge({
        target: { id: () => "daniel--maya" },
      });
    });

    expect(
      screen.getByText(/line reflects shared stored expertise/),
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
    expect(renderer.core.fit).toHaveBeenCalledWith(renderer.collection, 48);
  });

  it("filters nodes, edges, name options, and the HTML directory", async () => {
    const user = userEvent.setup();
    render(<PeopleNetwork graph={graph} />);

    await user.click(screen.getByRole("button", { name: "Appointment titles" }));
    await user.click(
      screen.getByRole("checkbox", { name: "Senior Research Fellow" }),
    );

    expect(screen.getByText("1 of 2 people shown.")).toBeInTheDocument();
    expect(
      screen.getByText("Browse all 1 person"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Maya Chen.*Pulsar Astronomer/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Daniel Brooks.*Radio Astronomer/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: /1 person and 0 shared-expertise connections/,
      }),
    ).toBeInTheDocument();
    expect(renderer.core.getElementById).toHaveBeenCalledWith("daniel");
    expect(renderer.core.getElementById).toHaveBeenCalledWith("daniel--maya");
    expect(window.location.search).toContain("title=Senior+Research+Fellow");
  });

  it("clears a selection that becomes hidden by filters", async () => {
    const user = userEvent.setup();
    render(<PeopleNetwork graph={graph} />);

    await user.type(
      screen.getByRole("combobox", { name: "Find a person" }),
      "Daniel Brooks",
    );
    await user.click(screen.getByRole("button", { name: "Focus" }));
    expect(
      screen.getByRole("heading", { name: "Daniel Brooks" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Appointment titles" }));
    await user.click(
      screen.getByRole("checkbox", { name: "Senior Research Fellow" }),
    );
    expect(
      screen.getByRole("heading", { name: "Select a person" }),
    ).toBeInTheDocument();
  });

  it("shows and recovers from a no-results network filter", async () => {
    const user = userEvent.setup();
    render(<PeopleNetwork graph={graph} />);

    await user.click(screen.getByRole("button", { name: "Appointment titles" }));
    await user.click(
      screen.getByRole("checkbox", { name: "Senior Research Fellow" }),
    );
    await user.click(screen.getByRole("button", { name: "Research areas" }));
    await user.click(
      screen.getByRole("checkbox", { name: "interstellar medium" }),
    );

    expect(
      screen.getByRole("heading", { name: "No people match these filters" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(
      screen.queryByRole("heading", { name: "No people match these filters" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Browse all 2 people")).toBeInTheDocument();
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
    render(<PeopleNetwork graph={{ groups: [], nodes: [], edges: [] }} />);

    expect(
      screen.getByRole("heading", { name: "No people to map yet" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse people" })).toHaveAttribute(
      "href",
      "/people",
    );
  });

  it("accepts the graph shape from before research groups were added", () => {
    const legacyGraph = {
      nodes: graph.nodes.map(
        ({ id, slug, name, title, role, researchAreas }) => ({
          id,
          slug,
          name,
          title,
          role,
          researchAreas,
        }),
      ),
      edges: graph.edges,
    } as unknown as PeopleGraph;

    render(<PeopleNetwork graph={legacyGraph} />);

    expect(screen.getByLabelText("Research group tags")).toHaveTextContent(
      "No research group",
    );
    expect(
      screen.getByRole("button", { name: /Maya Chen.*Pulsar Astronomer/ }),
    ).toBeInTheDocument();
  });
});
