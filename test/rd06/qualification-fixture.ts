import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** One isolated qualification project copy and its owned cleanup. */
export interface QualificationProject {
  /** Absolute path to the copied manifest. */
  readonly project: string;
  /** Absolute path to the temporary root. */
  readonly root: string;
  /** Remove this test's temporary tree. */
  readonly cleanup: () => Promise<void>;
}

/** Copy one checked-in qualification project into an isolated output-owning tree. */
export async function qualificationProject(name: string): Promise<QualificationProject> {
  const source = join(process.cwd(), "test/rd06/qualification", name);
  const root = await mkdtemp(join(tmpdir(), `blend65-${name}-`));
  await cp(source, root, { recursive: true });
  return {
    project: join(root, "blend65.json"),
    root,
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}
