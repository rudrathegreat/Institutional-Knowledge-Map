import Link from "next/link";

export default function ResearchGroupNotFound() {
  return (
    <main className="notFoundPage">
      <div className="notFoundContent">
        <p className="eyebrow">Research groups</p>
        <h1>Research group not found</h1>
        <p>This group does not exist or is no longer available.</p>
        <Link className="primaryLink" href="/">
          Return to search
        </Link>
      </div>
    </main>
  );
}
