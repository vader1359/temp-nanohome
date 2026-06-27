import { createOnRequestError } from "@axiomhq/nextjs";
import { Logger, ConsoleTransport, AxiomJSTransport } from "@axiomhq/logging";
import { Axiom } from "@axiomhq/js";

const axiomClient = new Axiom({
  token: process.env.AXIOM_TOKEN || "",
});

const logger = new Logger({
  transports: [
    new AxiomJSTransport({
      axiom: axiomClient,
      dataset: process.env.AXIOM_DATASET || "nanohome-dataset",
    }),
    new ConsoleTransport({ prettyPrint: true }),
  ],
});

export function register() {
  // Axiom environment instrumentation setup
}

export const onRequestError = createOnRequestError(logger);
