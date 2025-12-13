import { AchievementTable, StoreItemTable } from "@/db/schemas/gamification";
import achievements from "@/resources/achievement_list.json" assert { type: "json" };
import storeItems from "@/resources/store_item_list.json" assert { type: "json" };
import { db } from "@/db";

const addAchievements = async () => {
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
  } catch (err) {
    console.error("Error seeding achievements:", err);
    process.exit(1);
  }
};

const addStoreItems = async () => {
  try {
    await Promise.all(
      storeItems.map((item) =>
        db
          .insert(StoreItemTable)
          .values({
            itemId: item.itemId,
            name: item.name,
            description: item.description,
            price: item.price,
            available: item.available,
            autoUse: item.autoUse,
          })
          .onConflictDoNothing(),
      ),
    );

    console.log("StoreItems seeded successfully!");
  } catch (err) {
    console.error("Error seeding items:", err);
    process.exit(1);
  }
};

await addAchievements();
await addStoreItems();
process.exit(0);
