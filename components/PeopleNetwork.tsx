"use client";

import cytoscape, { type Core } from "cytoscape";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import type {
  PeopleGraph,
  PeopleGraphEdge,
  PeopleGraphNode,
  SharedEvidence,
} from "@/lib/people-graph";

interface PeopleNetworkProps {
  graph: PeopleGraph;
}

type GraphStatus = "loading" | "ready" | "error";
type Selection =
  | { kind: "node"; id: string }
  | { kind: "edge"; id: string }
  | undefined;

const GRAPH_PADDING = 48;

function evidenceSummary(evidence: SharedEvidence[]): string {
  return evidence.map(({ label }) => label).join(" · ");
}

function graphElements(graph: PeopleGraph) {
  return [
    ...graph.nodes.map((node) => ({
      data: {
        id: node.id,
        label: node.name,
      },
    })),
    ...graph.edges.map((edge) => ({
      data: {
        id: edge.id,
        source: edge.sourceId,
        target: edge.targetId,
        lineWidth: Math.min(4, 1 + edge.score / 4),
      },
    })),
  ];
}

function connectedPeople(
  graph: PeopleGraph,
  personId: string,
): Array<{ edge: PeopleGraphEdge; person: PeopleGraphNode }> {
  const peopleById = new Map(graph.nodes.map((node) => [node.id, node]));

  return graph.edges
    .filter(
      (edge) => edge.sourceId === personId || edge.targetId === personId,
    )
    .map((edge) => ({
      edge,
      person: peopleById.get(
        edge.sourceId === personId ? edge.targetId : edge.sourceId,
      ),
    }))
    .filter(
      (
        connection,
      ): connection is { edge: PeopleGraphEdge; person: PeopleGraphNode } =>
        Boolean(connection.person),
    )
    .sort(
      (left, right) =>
        right.edge.score - left.edge.score ||
        left.person.name.localeCompare(right.person.name, "en"),
    );
}

function InitialInspector({
  nodes,
  onSelect,
}: {
  nodes: PeopleGraphNode[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="networkInspectorEmpty">
      <p className="eyebrow">How to explore</p>
      <h2>Select a person</h2>
      <p>
        Choose a node or find someone by name. Their strongest shared-expertise
        connections will appear here.
      </p>

      <details className="networkPeopleDirectory">
        <summary>Browse all {nodes.length} people</summary>
        <ul>
          {nodes.map((node) => (
            <li key={node.id}>
              <button type="button" onClick={() => onSelect(node.id)}>
                <span>{node.name}</span>
                <small>{node.role}</small>
              </button>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function PersonInspector({
  graph,
  person,
  onSelect,
}: {
  graph: PeopleGraph;
  person: PeopleGraphNode;
  onSelect: (id: string) => void;
}) {
  const connections = connectedPeople(graph, person.id);

  return (
    <div className="networkPersonInspector">
      <p className="eyebrow">Person</p>
      <h2>{person.name}</h2>
      <p className="networkPersonRole">
        {person.title} <span aria-hidden="true">·</span> {person.role}
      </p>
      <ul className="networkResearchAreas" aria-label="Research areas">
        {person.researchAreas.map((area) => (
          <li key={area}>{area}</li>
        ))}
      </ul>

      <Link className="networkProfileLink" href={`/people/${person.slug}`}>
        View profile <span aria-hidden="true">→</span>
      </Link>

      <section className="networkConnections" aria-labelledby="connections-title">
        <h3 id="connections-title">Shared-expertise connections</h3>
        {connections.length > 0 ? (
          <ul>
            {connections.map(({ edge, person: connectedPerson }) => (
              <li key={edge.id}>
                <button
                  type="button"
                  onClick={() => onSelect(connectedPerson.id)}
                >
                  <span>{connectedPerson.name}</span>
                  <small>{evidenceSummary(edge.evidence)}</small>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="networkNoConnections">
            No meaningful shared-expertise connections were found in the stored
            profile fields.
          </p>
        )}
      </section>
    </div>
  );
}

function ConnectionInspector({
  edge,
  source,
  target,
  onSelect,
}: {
  edge: PeopleGraphEdge;
  source: PeopleGraphNode;
  target: PeopleGraphNode;
  onSelect: (id: string) => void;
}) {
  const groupedEvidence = edge.evidence.reduce(
    (groups, evidence) => {
      const existing = groups.get(evidence.category) ?? [];
      existing.push(evidence.label);
      groups.set(evidence.category, existing);
      return groups;
    },
    new Map<SharedEvidence["category"], string[]>(),
  );

  return (
    <div className="networkEdgeInspector">
      <p className="eyebrow">Connection</p>
      <h2>
        {source.name} <span aria-hidden="true">↔</span> {target.name}
      </h2>
      <p className="networkConnectionClarifier">
        This connection reflects shared stored expertise, not a claimed
        collaboration or reporting relationship.
      </p>

      <dl className="networkEvidenceList">
        {[...groupedEvidence].map(([category, labels]) => (
          <div key={category}>
            <dt>{category}</dt>
            <dd>{labels.join(" · ")}</dd>
          </div>
        ))}
      </dl>

      <div className="networkEndpointActions">
        {[source, target].map((person) => (
          <div key={person.id}>
            <button type="button" onClick={() => onSelect(person.id)}>
              Focus {person.name}
            </button>
            <Link href={`/people/${person.slug}`}>View profile</Link>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PeopleNetwork({ graph }: PeopleNetworkProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Core | null>(null);
  const [status, setStatus] = useState<GraphStatus>("loading");
  const [selection, setSelection] = useState<Selection>();
  const [searchValue, setSearchValue] = useState("");
  const [searchError, setSearchError] = useState("");
  const peopleById = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes],
  );
  const edgesById = useMemo(
    () => new Map(graph.edges.map((edge) => [edge.id, edge])),
    [graph.edges],
  );

  useEffect(() => {
    if (!containerRef.current || graph.nodes.length === 0) {
      setStatus("ready");
      return;
    }

    let resizeObserver: ResizeObserver | undefined;

    try {
      const instance = cytoscape({
        container: containerRef.current,
        elements: graphElements(graph),
        minZoom: 0.35,
        maxZoom: 2.25,
        wheelSensitivity: 0.2,
        boxSelectionEnabled: false,
        style: [
          {
            selector: "node",
            style: {
              width: 54,
              height: 54,
              label: "data(label)",
              "background-color": "#eeeeff",
              "border-color": "#b8b8ee",
              "border-width": 1.5,
              color: "#31313f",
              "font-family": "Inter, ui-sans-serif, system-ui, sans-serif",
              "font-size": 12,
              "font-weight": 550,
              "text-halign": "center",
              "text-valign": "bottom",
              "text-margin-y": 10,
              "text-max-width": "104px",
              "text-wrap": "wrap",
              "transition-property": "opacity, background-color, border-color",
              "transition-duration": 150,
            },
          },
          {
            selector: "edge",
            style: {
              width: "data(lineWidth)",
              "line-color": "#cfcfca",
              "curve-style": "bezier",
              opacity: 0.82,
              "transition-property": "opacity, line-color, width",
              "transition-duration": 150,
            },
          },
          {
            selector: ".is-muted",
            style: {
              opacity: 0.16,
            },
          },
          {
            selector: "node.is-selected",
            style: {
              "background-color": "#5b5bd6",
              "border-color": "#4c4cc4",
              color: "#1f1f1f",
              "font-weight": 650,
            },
          },
          {
            selector: "edge.is-selected",
            style: {
              width: 4.5,
              "line-color": "#5b5bd6",
              opacity: 1,
            },
          },
        ],
        layout: { name: "preset" },
      });

      graphRef.current = instance;
      instance.on("tap", "node", (event) => {
        setSelection({ kind: "node", id: event.target.id() });
        setSearchError("");
      });
      instance.on("tap", "edge", (event) => {
        setSelection({ kind: "edge", id: event.target.id() });
        setSearchError("");
      });
      instance.on("tap", (event) => {
        if (event.target === instance) {
          setSelection(undefined);
        }
      });

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const layout = instance.layout({
        name: "cose",
        animate: !reduceMotion,
        animationDuration: reduceMotion ? 0 : 450,
        fit: true,
        padding: GRAPH_PADDING,
        nodeRepulsion: 9000,
        idealEdgeLength: 110,
        edgeElasticity: 100,
        nestingFactor: 1.2,
        gravity: 0.2,
        numIter: 1000,
        randomize: true,
      });
      layout.one("layoutstop", () => setStatus("ready"));
      layout.run();

      resizeObserver = new ResizeObserver(() => instance.resize());
      resizeObserver.observe(containerRef.current);
    } catch {
      window.setTimeout(() => setStatus("error"), 0);
    }

    return () => {
      resizeObserver?.disconnect();
      graphRef.current?.destroy();
      graphRef.current = null;
    };
  }, [graph]);

  useEffect(() => {
    const instance = graphRef.current;
    if (!instance) {
      return;
    }

    instance.elements().removeClass("is-muted is-selected");

    if (!selection) {
      return;
    }

    if (selection.kind === "node") {
      const node = instance.getElementById(selection.id);
      if (node.empty()) {
        return;
      }

      const neighbourhood = node.closedNeighborhood();
      instance.elements().not(neighbourhood).addClass("is-muted");
      node.addClass("is-selected");
      node.connectedEdges().addClass("is-selected");
      return;
    }

    const edge = instance.getElementById(selection.id);
    if (edge.empty()) {
      return;
    }

    const endpoints = edge.connectedNodes();
    instance.elements().not(edge.union(endpoints)).addClass("is-muted");
    edge.addClass("is-selected");
    endpoints.addClass("is-selected");
  }, [selection]);

  function selectPerson(personId: string, focusGraph = true) {
    const person = peopleById.get(personId);
    if (!person) {
      return;
    }

    setSelection({ kind: "node", id: personId });
    setSearchValue(person.name);
    setSearchError("");

    const instance = graphRef.current;
    const node = instance?.getElementById(personId);
    if (focusGraph && instance && node && !node.empty()) {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      instance.animate({
        fit: { eles: node.closedNeighborhood(), padding: 90 },
        duration: reduceMotion ? 0 : 350,
      });
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchValue.trim().toLocaleLowerCase("en");
    const match = graph.nodes.find(
      (node) =>
        node.name.toLocaleLowerCase("en") === query ||
        node.name.toLocaleLowerCase("en").includes(query),
    );

    if (!query || !match) {
      setSearchError(
        query ? `No person matched “${searchValue.trim()}”.` : "Enter a name to find someone.",
      );
      return;
    }

    selectPerson(match.id);
  }

  function zoomBy(factor: number) {
    const instance = graphRef.current;
    const container = containerRef.current;
    if (!instance || !container) {
      return;
    }

    instance.zoom({
      level: Math.min(
        instance.maxZoom(),
        Math.max(instance.minZoom(), instance.zoom() * factor),
      ),
      renderedPosition: {
        x: container.clientWidth / 2,
        y: container.clientHeight / 2,
      },
    });
  }

  function fitGraph() {
    graphRef.current?.fit(undefined, GRAPH_PADDING);
    setSelection(undefined);
    setSearchValue("");
    setSearchError("");
  }

  if (graph.nodes.length === 0) {
    return (
      <div className="networkEmptyState">
        <h2>No people to map yet</h2>
        <p>The network will appear when researcher profiles are available.</p>
        <Link className="primaryLink" href="/people">
          Browse people
        </Link>
      </div>
    );
  }

  const selectedPerson =
    selection?.kind === "node" ? peopleById.get(selection.id) : undefined;
  const selectedEdge =
    selection?.kind === "edge" ? edgesById.get(selection.id) : undefined;
  const selectedSource = selectedEdge
    ? peopleById.get(selectedEdge.sourceId)
    : undefined;
  const selectedTarget = selectedEdge
    ? peopleById.get(selectedEdge.targetId)
    : undefined;
  const announcement = selectedPerson
    ? `${selectedPerson.name} selected.`
    : selectedEdge && selectedSource && selectedTarget
      ? `Connection between ${selectedSource.name} and ${selectedTarget.name} selected.`
      : "Full network shown.";

  return (
    <div className="networkExperience">
      <div className="networkToolbar">
        <form className="networkSearch" onSubmit={submitSearch}>
          <label htmlFor="network-person-search">Find a person</label>
          <div>
            <input
              id="network-person-search"
              list="network-person-options"
              type="search"
              value={searchValue}
              placeholder="Search by name"
              autoComplete="off"
              aria-describedby={searchError ? "network-search-error" : undefined}
              onChange={(event) => {
                setSearchValue(event.target.value);
                setSearchError("");
              }}
            />
            <datalist id="network-person-options">
              {graph.nodes.map((node) => (
                <option key={node.id} value={node.name} />
              ))}
            </datalist>
            <button type="submit">Focus</button>
          </div>
          {searchError ? (
            <p className="networkSearchError" id="network-search-error">
              {searchError}
            </p>
          ) : null}
        </form>

        <div className="networkControls" aria-label="Network view controls">
          <button
            type="button"
            aria-label="Zoom out"
            disabled={status !== "ready"}
            onClick={() => zoomBy(0.82)}
          >
            −
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            disabled={status !== "ready"}
            onClick={() => zoomBy(1.22)}
          >
            +
          </button>
          <button
            className="networkFitButton"
            type="button"
            disabled={status !== "ready"}
            onClick={fitGraph}
          >
            Fit all
          </button>
        </div>
      </div>

      <p className="srOnly" aria-live="polite">
        {announcement}
      </p>

      <div className="networkWorkspace">
        <section className="networkCanvasPanel" aria-label="Interactive people network">
          <div
            className="networkCanvas"
            ref={containerRef}
            role="img"
            aria-label={`Interactive network showing ${graph.nodes.length} people and ${graph.edges.length} shared-expertise connections. Use the Find a person control for keyboard navigation.`}
          />
          {status === "loading" ? (
            <div className="networkCanvasState" role="status">
              Building network…
            </div>
          ) : null}
          {status === "error" ? (
            <div className="networkCanvasState networkCanvasError" role="alert">
              <p>The interactive view could not be loaded.</p>
              <p>Use Find a person or the people list to continue exploring.</p>
            </div>
          ) : null}
          <p className="networkCanvasHint">
            Drag to pan · Scroll or pinch to zoom · Select a node or line to inspect
          </p>
        </section>

        <aside className="networkInspector" aria-label="Network details">
          {selectedPerson ? (
            <PersonInspector
              graph={graph}
              person={selectedPerson}
              onSelect={selectPerson}
            />
          ) : selectedEdge && selectedSource && selectedTarget ? (
            <ConnectionInspector
              edge={selectedEdge}
              source={selectedSource}
              target={selectedTarget}
              onSelect={selectPerson}
            />
          ) : (
            <InitialInspector nodes={graph.nodes} onSelect={selectPerson} />
          )}
        </aside>
      </div>
    </div>
  );
}
