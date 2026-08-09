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
          <p>
            {person.title}
            <span aria-hidden="true"> · </span>
            {person.role}
          </p>
        </header>

        <section className="profileBiography">
          <h2>About</h2>
          <p>{person.biography}</p>
        </section>

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
