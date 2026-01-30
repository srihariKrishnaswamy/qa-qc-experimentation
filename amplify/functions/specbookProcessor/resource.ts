import { defineFunction } from "@aws-amplify/backend";
import { Duration } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { fileURLToPath } from "url";
import path from "path";

export const specbookProcessor = defineFunction((scope) => {
  const handlerDir = path.dirname(fileURLToPath(import.meta.url));
  return new lambda.Function(scope, "SpecbookProcessor", {
    functionName: "specbookProcessor",
    runtime: lambda.Runtime.PYTHON_3_11,
    architecture: lambda.Architecture.ARM_64,
    handler: "handler.handler",
    code: lambda.Code.fromAsset(handlerDir, {
      bundling: {
        image: lambda.Runtime.PYTHON_3_11.bundlingImage,
        command: [
          "bash",
          "-c",
          [
            "pip install -r requirements.txt -t /asset-output",
            "cp -R . /asset-output",
          ].join(" && "),
        ],
      },
    }),
    timeout: Duration.seconds(900),
    memorySize: 2048,
  });
});
