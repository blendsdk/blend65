const outcome = process.argv[2];
process.stdout.write("failure-execution-process-fixture\n");
process.exitCode = outcome === "crash" ? 1 : 0;
