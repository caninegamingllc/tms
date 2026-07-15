import { hostname } from "os";
import { claimNextJob, completeJob, failJob, processJob } from "../lib/jobs";

const workerId = `${hostname()}-${process.pid}`;
const pollMs = Number(process.env.JOB_WORKER_POLL_MS || 2000);

async function tick() {
  const job = await claimNextJob(workerId);
  if (!job) {
    return false;
  }

  try {
    await processJob(job);
    await completeJob(job.id);
    console.log(`[worker] completed ${job.type} ${job.id}`);
  } catch (error) {
    await failJob(job.id, error, job.maxAttempts, job.attempts);
    console.error(`[worker] failed ${job.type} ${job.id}`, error);
  }
  return true;
}

async function main() {
  console.log(`[worker] starting as ${workerId}`);
  for (;;) {
    let worked = false;
    try {
      worked = await tick();
    } catch (error) {
      console.error("[worker] tick error", error);
    }
    await new Promise((resolve) => setTimeout(resolve, worked ? 50 : pollMs));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
