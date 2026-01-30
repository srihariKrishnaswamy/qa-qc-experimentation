import { defineStorage } from "@aws-amplify/backend";
import { specbookProcessor } from "../functions/specbookProcessor/resource.js";

export const storage = defineStorage({
  name: "specbookUploads",
  access: (allow) => ({
    "uploads/*": [allow.resource(specbookProcessor).to(["read", "write"])],
    "outputs/*": [allow.resource(specbookProcessor).to(["read", "write"])],
  }),
});
