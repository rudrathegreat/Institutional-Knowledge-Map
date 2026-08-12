import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getResearchGroupBySlug } from "@/lib/research-groups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ResearchGroupPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: ResearchGroupPageProps): Promise<Metadata> {
  const { slug } = await params;
  const group = getResearchGroupBySlug(slug);

  if (!group) {
    return { title: "Research group not found" };
  }

  return {
    title: group.name,
    description: group.summary,
  };
}

export default async function ResearchGroupPage({
  params,
}: ResearchGroupPageProps) {
  const { slug } = await params;
  const group = getResearchGroupBySlug(slug);

  if (!group) {
    notFound();
  }

  return (
    <main className="profilePage groupProfilePage">
      <article className="profileContent">
        <Link className="backLink" href="/">
          <span aria-hidden="true">←</span> Back to search
        </Link>

        <header className="profileHeader">
          <p className="eyebrow">Research group</p>
          <h1>{group.name}</h1>
          <p className="profileRole">
            {group.members.length}{" "}
            {group.members.length === 1 ? "member" : "members"}
          </p>
        </header>

        <section className="profileBiography">
          <h2>About</h2>
          <p>{group.summary}</p>
        </section>

        <section className="groupFocusAreas">
          <h2>Research focus</h2>
          <ul className="profileTags">
            {group.researchAreas.map((area) => (
              <li key={area}>{area}</li>
            ))}
          </ul>
        </section>

        <section className="groupMembers" aria-labelledby="group-members-title">
          <header>
            <h2 id="group-members-title">People in this group</h2>
            <p>Primary and secondary group memberships are both included.</p>
          </header>
          <ul>
            {group.members.map((member) => (
              <li key={member.id}>
                <Link href={`/people/${member.slug}`}>
                  <span>
                    <strong>{member.name}</strong>
                    <span>
                      {member.title}
                      <span aria-hidden="true"> · </span>
                      {member.role}
                    </span>
                  </span>
                  <span className="membershipType">
                    {member.isPrimary ? "Primary group" : "Secondary group"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </main>
  );
}
