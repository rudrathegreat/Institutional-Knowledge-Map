import Link from "next/link";

export default function PersonNotFound() {
  return (
    <main className="notFoundPage">
      <div className="notFoundContent">
        <p className="eyebrow">People</p>
        <h1>Person not found</h1>
        <p>This profile does not exist or is no longer available.</p>
        <Link className="primaryLink" href="/people">
          Browse all people
        </Link>
      </div>
    </main>
  );
}
