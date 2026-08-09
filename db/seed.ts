import { resolveDatabasePath } from "@/lib/db";
import { seedDatabase } from "@/lib/seed";

const databasePath = resolveDatabasePath();
const count = seedDatabase(databasePath);

console.log(`Seeded ${count} fictional researchers into ${databasePath}.`);
