import { defineBackend, secret } from "@aws-amplify/backend";
import { storage } from "./storage/resource.js";
import { specbookProcessor } from "./functions/specbookProcessor/resource.js";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";

const backend = defineBackend({
  storage,
  specbookProcessor,
});

const bucket = backend.storage.resources.bucket;
const processorLambda = backend.specbookProcessor.resources.lambda;
const googleApiKey = secret("GOOGLE_API_KEY");

bucket.addEventNotification(
  s3.EventType.OBJECT_CREATED,
  new s3n.LambdaDestination(processorLambda)
);

backend.specbookProcessor.addEnvironment(
  "UPLOAD_PREFIX",
  "uploads/"
);
backend.specbookProcessor.addEnvironment("OUTPUT_PREFIX", "outputs/");
backend.specbookProcessor.addEnvironment("GOOGLE_API_KEY", googleApiKey);
