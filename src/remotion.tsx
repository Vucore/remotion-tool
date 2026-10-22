import { Composition, registerRoot } from "remotion";
import { Video } from "./Video";
import { emptyProject, totalFrames } from "./model";

const Root = () => (
  <Composition
    id="ImageVideo"
    component={Video}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={120}
    defaultProps={{ project: emptyProject() }}
    calculateMetadata={({ props }) => ({
      width: props.project.width,
      height: props.project.height,
      fps: props.project.fps,
      durationInFrames: totalFrames(props.project),
    })}
  />
);
registerRoot(Root);
