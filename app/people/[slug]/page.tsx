import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getPersonBySlug } from "@/lib/people";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PersonPageProps {
  params: Promise<{ slug: string }>;
}

interface ProfileFieldProps {
  title: string;
  items: string[];
}

function formatPublicationDate(publicationDate: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${publicationDate}T00:00:00Z`));
}

function formatWorkType(workType: string): string {
  return workType
    .split("-")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

function ProfileField({ title, items }: ProfileFieldProps) {
  return (
    <section className="profileField">
      <h2>{title}</h2>
      <ul className="profileTags">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export async function generateMetadata({
  params,
}: PersonPageProps): Promise<Metadata> {
  const { slug } = await params;
  const person = getPersonBySlug(slug);

  if (!person) {
    return { title: "Person not found" };
  }

  return {
    title: person.name,
    description: person.biography,
  };
}

export default async function PersonPage({ params }: PersonPageProps) {
  const { slug } = await params;
  const person = getPersonBySlug(slug);

  if (!person) {
    notFound();
  }

  return (
    <main className="profilePage">
      <article className="profileContent">
        <Link className="backLink" href="/people">
          <span aria-hidden="true">←</span> All people
        </Link>

        <header className="profileHeader">
          <p className="eyebrow">Person profile</p>
          <h1>{person.name}</h1>
          <p className="profileRole">
            {person.title}
            <span aria-hidden="true"> · </span>
            {person.role}
          </p>
          <section
            className="profileResearchGroups"
            aria-labelledby="profile-research-groups-title"
          >
            <h2 id="profile-research-groups-title">Research groups</h2>
            {person.researchGroups.length > 0 ? (
              <ul>
                {person.researchGroups.map((group) => (
                  <li key={group.id}>
                    <Link href={`/groups/${group.slug}`}>{group.name}</Link>
                    {group.isPrimary ? <span>Primary</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No research group listed.</p>
            )}
          </section>
          {person.orcidId && person.orcidIdStatus === "mock" && (
            <p className="mockOrcidId">
              <span>Mock ORCID iD</span>
              <span>{person.orcidId}</span>
            </p>
          )}
        </header>

        <section className="profileBiography">
          <h2>About</h2>
          <p>{person.biography}</p>
        </section>

        {person.publications.length > 0 && (
          <section className="profilePublications">
            <header>
              <h2>Recent publications</h2>
              <p>
                The ORCID iD and publications are fictional prototype data.
              </p>
            </header>
            <ol className="publicationList">
              {person.publications.map((publication) => (
                <li key={publication.id}>
                  <h3>{publication.title}</h3>
                  <p>
                    {formatWorkType(publication.workType)}
                    <span aria-hidden="true"> · </span>
                    <time dateTime={publication.publicationDate}>
                      {formatPublicationDate(publication.publicationDate)}
                    </time>
                  </p>
                </li>
              ))}
            </ol>
          </section>
        )}

        <div className="profileFields">
          <ProfileField title="Research areas" items={person.researchAreas} />
          <ProfileField title="Methods" items={person.methods} />
          <ProfileField title="Instruments" items={person.instruments} />
          <ProfileField title="Software" items={person.software} />
          <ProfileField title="Keywords" items={person.keywords} />
        </div>
      </article>
    </main>
  );
}
