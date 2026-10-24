import { useEffect, useRef, useState } from "react";
import { emptyProject, type Project } from "../model";
import { type StoryOptions } from "../auto/story";
import { ProjectWorker, type StoryPreview } from "./project-client";

export function useStoryPreview(
  project: Project,
  options: StoryOptions,
  rebuild: boolean,
) {
  const worker = useRef<ProjectWorker | null>(null);
  const [result, setResult] = useState<StoryPreview>(() => ({
    project: emptyProject(),
    estimated: false,
  }));
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const client = new ProjectWorker();
    worker.current = client;
    return () => {
      client.close();
      worker.current = null;
    };
  }, []);
  useEffect(() => {
    let disposed = false;
    setPending(true);
    // Coalesce slider/typing bursts and discard stale revisions.
    const timer = setTimeout(() => {
      void worker.current?.preview(project, options, true, rebuild).then(
        (next) => {
          if (!disposed) {
            setResult({
              ...next,
              project: { ...next.project, voiceover: project.voiceover },
            });
            setPending(false);
          }
        },
        (error) => {
          if (!disposed) {
            setResult((old) => ({ ...old, error: String(error) }));
            setPending(false);
          }
        },
      );
    }, 80);
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [project, options, rebuild]);
  return {
    ...result,
    pending,
    worker,
  };
}
