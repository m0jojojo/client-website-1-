import { config } from "dotenv";
import { pruneStaleCarts } from "../src/lib/cart/service";

config({ path: ".env.local" });
config();

const days = Number(process.argv[2] ?? 60);
pruneStaleCarts(days)
  .then((n) => console.log(`Deleted ${n} carts untouched for ${days}+ days`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
