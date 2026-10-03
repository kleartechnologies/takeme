import worker from "../.open-next/worker.js";
import { createStagingWorker } from "./staging-access.mjs";

export * from "../.open-next/worker.js";
export default createStagingWorker(worker);
