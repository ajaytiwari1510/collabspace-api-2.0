import mongoose from "mongoose";
import { College } from "../models/college.model.js";
import { env } from "../config/env.js";

interface HipolabsUniversity {
  name: string;
  country: string;
  "state-province": string | null;
  domains: string[];
  web_pages: string[];
}

const seedColleges = async () => {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(env.MONGO_URI);
    console.log("✅ Connected");

    console.log("🌐 Fetching Indian colleges from Hipolabs API...");
    const response = await fetch(
      "http://universities.hipolabs.com/search?country=India"
    );

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data: HipolabsUniversity[] = await response.json();
    console.log(`📦 Fetched ${data.length} colleges from API`);

    let insertedCount = 0;
    let skippedCount = 0;

    for (const uni of data) {
      const existing = await College.findOne({ name: uni.name });

      if (existing) {
        skippedCount++;
        continue;
      }

      await College.create({
        name: uni.name,
        state: uni["state-province"] || undefined,
        isVerified: true,
        source: "seeded",
      });

      insertedCount++;
    }

    console.log(`✅ Seeding complete!`);
    console.log(`   Inserted: ${insertedCount}`);
    console.log(`   Skipped (already existed): ${skippedCount}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
};

seedColleges();