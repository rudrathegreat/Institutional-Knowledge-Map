import { SearchExperience } from "@/components/SearchExperience";
import { getExpertiseVocabulary } from "@/lib/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function Home() {
  return <SearchExperience expertiseVocabulary={getExpertiseVocabulary()} />;
}
