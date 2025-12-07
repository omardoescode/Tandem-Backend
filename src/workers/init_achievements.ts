import { AchievementTable } from "@/db/schemas/gamification";
import achievements from "@/resources/achievement_list.json" assert { type: "json" };
import { db } from "@/db";

try {
  await Promise.all(
    achievements.map((achievement) =>
      db
        .insert(AchievementTable)
        .values({
          achievementId: achievement.achievementId,
          name: achievement.name,
          description: achievement.description,
        })
        .onConflictDoNothing(),
    ),
  );

  console.log("Achievements seeded successfully!");
  process.exit(0);
} catch (err) {
  console.error("Error seeding achievements:", err);
  process.exit(1);
}
