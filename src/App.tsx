import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import {
  emptyProject,
  parseProject,
  timeline,
  totalFrames,
  type Project,
  type Asset,
} from "./model";
import { Video } from "./Video";
import { Icon } from "./icons";
import { StoryInput } from "./editor/StoryInput";
import { Timeline } from "./editor/Timeline";
import { useWorkspaceLayout } from "./editor/WorkspaceLayout";
import { QuickSettings, type SettingsTab } from "./editor/QuickSettings";
import { compileAuto } from "./auto/compile";
import {
  defaultStoryOptions,
  finishStory,
  optionsFromProject,
  parseStoryOptions,
  storyConfig,
  storyInputs,
  previewStory,
  type StoryOptions,
  type SceneStoryOverride,
  sceneStoryOptions,
} from "./auto/story";
import { buildWithNarration } from "./editor/narration-client";
import { importStoryFiles, type ImportKind } from "./editor/story-import";
import { NarrationPanel } from "./editor/NarrationPanel";
import { createTtsVoices } from "./editor/tts-client";
import {
  defaultTtsSettings,
  parseTtsSettings,
  ttsInputKey,
  ttsPlan,
  speechPlan,
  type TtsSettings,
  type SceneDialogue,
} from "./auto/tts";
import { NARRATION_LANGUAGES } from "./auto/languages";
import { EditorDialog } from "./editor/EditorDialog";
import { ImageProcessingPanel } from "./editor/ImageProcessingPanel";
import { processProjectImages } from "./editor/image-processing-client";
import {
  defaultImageProcessing,
  parseImageProcessing,
  type ImageProcessingSettings,
} from "./auto/image-processing";
import { SubtitlePanel } from "./editor/SubtitlePanel";
import { estimatedSubtitles } from "./auto/subtitles";

type Job = {
  id: string;
  status: "preparing" | "rendering" | "done" | "error" | "cancelled";
  progress: number;
  error?: string;
  url?: string;
  subtitleUrl?: string;
  subtitleFilename?: string;
};
type Workspace = {
  project: Project;
  options: StoryOptions;
  dirty: boolean;
  job: Job | null;
};
const STORAGE = "khung-story-workspace-v1";
function initial(): Workspace {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) {
      const saved = JSON.parse(raw);
      let tts = defaultTtsSettings();
      try {
        tts = parseTtsSettings(saved.options?.tts);
      } catch {
        /* Keep the project even if a draft API setting is incomplete. */
      }
      return {
        project: parseProject(saved.project),
        options: parseStoryOptions({ ...saved.options, tts }),
        dirty: saved.dirty !== false,
        job:
          saved.job?.id && /^[a-f0-9-]{36}$/.test(saved.job.id)
            ? saved.job
            : null,
      };
    }
    const legacy = localStorage.getItem("khung-editor-project-v1");
    if (legacy) {
      const project = parseProject(JSON.parse(legacy));
      return {
        project,
        options: optionsFromProject(project),
        dirty: !project.scenes.length,
        job: null,
      };
    }
  } catch {
    /* A damaged cache must not prevent opening the application. */
  }
  return {
    project: emptyProject(),
    options: defaultStoryOptions(),
    dirty: true,
    job: null,
  };
}
function saveJson(filename: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Không hoàn tất được thao tác. Hãy thử lại.";
const running = (job: Job | null) =>
  Boolean(job && ["preparing", "rendering"].includes(job.status));

export function App() {
  const layout = useWorkspaceLayout();
  const [workspace, setWorkspace] = useState<Workspace>(initial);
  const { project, options, dirty, job } = workspace;
  const [phase, setPhase] = useState<
    "idle" | "importing" | "generating" | "building" | "starting" | "processing"
  >("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [connectionLost, setConnectionLost] = useState(false);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("motion");
  const [settingsScope, setSettingsScope] = useState<"all" | "scene">("all");
  const [mobilePanel, setMobilePanel] = useState<
    "media" | "preview" | "settings"
  >("preview");
  const [saved, setSaved] = useState(true);
  const [resetOpen, setResetOpen] = useState(false);
  const [resourceDialog, setResourceDialog] = useState<
    "tts" | "actors" | "subtitles" | "help" | "images" | null
  >(null);
  const [imagePreview, setImagePreview] = useState<{
    id: string;
    src: string;
    key: string;
  } | null>(null);
  const imageSettings = project.imageProcessing ?? defaultImageProcessing();
  const player = useRef<PlayerRef>(null);
  const imagesInput = useRef<HTMLInputElement>(null);
  const addImagesInput = useRef<HTMLInputElement>(null);
  const voicesInput = useRef<HTMLInputElement>(null);
  const scriptInput = useRef<HTMLInputElement>(null);
  const actorsInput = useRef<HTMLInputElement>(null);
  const projectInput = useRef<HTMLInputElement>(null);
  const presetInput = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const operation = useRef(false);
  const resetDialog = useRef<HTMLDialogElement>(null);
  const mounted = useRef(true);
  const busy = phase !== "idle" || running(job);
  const exportId = job?.id;
  const exportActive = running(job);
  const hasScenes = project.scenes.length > 0;
  const ttsReady = useMemo(() => {
    if (!options.tts.enabled || !project.voiceover?.assets.length) return false;
    try {
      return (
        project.voiceover.ttsKey ===
        ttsInputKey(project.voiceover.script, options.tts)
      );
    } catch {
      return false;
    }
  }, [project.voiceover, options.tts]);
  const ttsPending = options.tts.enabled && !ttsReady;
  const previewSource = useMemo(
    () =>
      ttsPending
        ? {
            ...project,
            scenes: [],
            automation: undefined,
            voiceover: {
              ...project.voiceover!,
              assets: [],
              script: project.voiceover?.script ?? "",
              scriptName: project.voiceover?.scriptName ?? "",
            },
          }
        : project,
    [project, ttsPending],
  );
  const preview = useMemo<ReturnType<typeof previewStory>>(
    () =>
      dirty || !hasScenes || ttsPending
        ? previewStory(previewSource, options)
        : { project, estimated: estimatedSubtitles(project) },
    [project, previewSource, options, dirty, hasScenes, ttsPending],
  );
  const previewProject = preview.project;
  const previewHasScenes = previewProject.scenes.length > 0;
  const duration = totalFrames(previewProject);
  const previewItems = useMemo(
    () => timeline(previewProject),
    [previewProject],
  );
  const validation = useMemo(() => {
    try {
      if (options.tts.enabled) {
        const tts = parseTtsSettings(options.tts);
        ttsPlan(project.voiceover?.script ?? "", project.assets);
        speechPlan(project.voiceover?.script ?? "", tts);
      }
      return { rows: storyInputs(previewSource), error: "" };
    } catch (e) {
      return { rows: [], error: errorMessage(e) };
    }
  }, [project, previewSource, options.tts]);
  const voiceCount = project.voiceover?.assets.length ?? 0;
  const hasScript = Boolean(project.voiceover?.script.trim());
  const canRun = !busy && !validation.error && project.assets.length > 0;
  const activeScene = [...previewItems].reverse().find((i) => frame >= i.from)
    ?.scene.id;
  const activeAsset = project.assets.find(
    (a) =>
      a.id === previewProject.scenes.find((s) => s.id === activeScene)?.assetId,
  );
  const sceneScope =
    settingsScope === "scene" &&
    settingsTab !== "overlay" &&
    Boolean(activeAsset);
  const quickOptions = sceneScope
    ? sceneStoryOptions(options, activeAsset!.name)
    : options;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    setSaved(false);
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE, JSON.stringify(workspace));
        setSaved(true);
      } catch {
        setNotice(
          "Trình duyệt hết dung lượng lưu. Dùng Lưu dự án ở mục Tệp để giữ bản dựng.",
        );
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [workspace]);
  useEffect(() => {
    if (resetOpen) resetDialog.current?.showModal();
    else resetDialog.current?.close();
  }, [resetOpen]);
  useEffect(() => {
    const p = player.current;
    if (!p) return;
    const update = ({ detail }: { detail: { frame: number } }) =>
      setFrame(detail.frame);
    const onPlay = () => setPlaying(true),
      onPause = () => setPlaying(false);
    p.addEventListener("play", onPlay);
    p.addEventListener("pause", onPause);
    p.addEventListener("ended", onPause);
    p.addEventListener("frameupdate", update);
    return () => {
      p.removeEventListener("frameupdate", update);
      p.removeEventListener("play", onPlay);
      p.removeEventListener("pause", onPause);
      p.removeEventListener("ended", onPause);
    };
  }, [previewProject]);
  useEffect(() => {
    if (!exportId || !exportActive) return;
    let disposed = false,
      timer: ReturnType<typeof setTimeout>;
    const abort = new AbortController();
    const poll = async () => {
      try {
        const response = await fetch("/api/exports/" + exportId, {
          signal: abort.signal,
        });
        const result = await response.json();
        if (disposed) return;
        if (!response.ok) {
          if (response.status === 404) {
            setWorkspace((w) =>
              w.job?.id === exportId
                ? {
                    ...w,
                    job: {
                      ...w.job,
                      status: "error",
                      error:
                        "Server đã khởi động lại, không còn trạng thái tác vụ. Hãy xuất lại bản dựng.",
                    },
                  }
                : w,
            );
            return;
          }
          throw Error(result.error);
        }
        setConnectionLost(false);
        setWorkspace((w) =>
          w.job?.id === exportId ? { ...w, job: result } : w,
        );
        if (!["preparing", "rendering"].includes(result.status)) return;
      } catch {
        if (disposed) return;
        setConnectionLost(true);
      }
      timer = setTimeout(poll, 1200);
    };
    void poll();
    return () => {
      disposed = true;
      abort.abort();
      clearTimeout(timer);
    };
  }, [exportId, exportActive]);

  function changeOptions(patch: Partial<StoryOptions>) {
    setWorkspace((w) => ({
      ...w,
      options: { ...w.options, ...patch },
      dirty: true,
      job: null,
    }));
    setError("");
    setNotice("");
  }
  function changeTtsSettings(patch: Partial<TtsSettings>) {
    setWorkspace((w) => {
      const tts = { ...w.options.tts, ...patch };
      return {
        ...w,
        options: {
          ...w.options,
          tts,
        },
        dirty: true,
        job: null,
      };
    });
    setError("");
    setNotice("");
  }
  async function uploadTtsReference(file: File, speakerId = "default") {
    if (busy || operation.current) return;
    operation.current = true;
    setPhase("importing");
    setProgress("Đang nhập giọng mẫu…");
    setError("");
    try {
      if (!/\.(wav|mp3)$/i.test(file.name) || file.size > 25 * 1024 * 1024)
        throw Error("Giọng mẫu cần là WAV/MP3, tối đa 25 MB.");
      const response = await fetch(
        "/api/voices?name=" + encodeURIComponent(file.name),
        {
          method: "POST",
          headers: {
            "Content-Type": /\.mp3$/i.test(file.name)
              ? "audio/mpeg"
              : "audio/wav",
          },
          body: file,
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw Error(result.error || "Không nhập được giọng mẫu.");
      setWorkspace((w) => {
        const reference = { src: result.src, name: file.name };
        const tts =
          speakerId === "default"
            ? { ...w.options.tts, reference }
            : {
                ...w.options.tts,
                speakers: w.options.tts.speakers.map((speaker) =>
                  speaker.id === speakerId
                    ? { ...speaker, reference }
                    : speaker,
                ),
              };
        return { ...w, options: { ...w.options, tts }, dirty: true, job: null };
      });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      operation.current = false;
      setPhase("idle");
      setProgress("");
    }
  }
  function changeQuickOptions(patch: Partial<StoryOptions>) {
    if (!sceneScope || !activeAsset) {
      changeOptions(patch);
      return;
    }
    setWorkspace((w) => {
      const base = w.options;
      const global = {
        ...base,
        ...(patch.seconds !== undefined ? { seconds: patch.seconds } : {}),
        ...(patch.caption
          ? { caption: { ...base.caption, maxChars: patch.caption.maxChars } }
          : {}),
      };
      const scoped = { ...patch };
      delete scoped.seconds;
      return {
        ...w,
        options: {
          ...global,
          sceneOverrides: {
            ...global.sceneOverrides,
            [activeAsset.name]: {
              ...base.sceneOverrides[activeAsset.name],
              ...(scoped as SceneStoryOverride),
            },
          },
        },
        dirty: true,
        job: null,
      };
    });
    setError("");
    setNotice("");
  }
  function changeImageSettings(settings: ImageProcessingSettings) {
    setWorkspace((w) => ({
      ...w,
      project: { ...w.project, imageProcessing: settings },
      dirty: true,
      job: null,
    }));
  }
  async function processImages(assetId?: string) {
    if (busy || operation.current || !project.assets.length) return;
    operation.current = true;
    setPhase("processing");
    setError("");
    setNotice("");
    player.current?.pause();
    const abort = new AbortController();
    controller.current = abort;
    try {
      const settings = parseImageProcessing(imageSettings);
      const assets = assetId
        ? project.assets.filter((asset) => asset.id === assetId)
        : project.assets;
      const result = await processProjectImages(
        { ...project, assets, scenes: [], automation: undefined },
        settings,
        abort.signal,
        setProgress,
      );
      if (abort.signal.aborted) throw Error("Đã dừng xử lý ảnh.");
      if (assetId) {
        const asset = result.assets[0];
        if (asset)
          setImagePreview({
            id: assetId,
            src: asset.src,
            key: JSON.stringify(imageSettings),
          });
      } else {
        setWorkspace((w) => ({
          ...w,
          project: {
            ...w.project,
            assets: w.project.assets.map(
              (asset) =>
                result.assets.find((item) => item.id === asset.id) ?? asset,
            ),
          },
          dirty: true,
          job: null,
        }));
        setImagePreview(null);
        setNotice(
          `Đã cập nhật ${result.assets.length}/${assets.length} ảnh. Có thể khôi phục ảnh gốc trong Xử lý ảnh.`,
        );
      }
      if (result.errors.length)
        setError(
          result.errors
            .map((item) => `${item.name}: ${item.error}`)
            .join(" · "),
        );
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      operation.current = false;
      controller.current = null;
      setPhase("idle");
      setProgress("");
    }
  }
  function restoreOriginalImages() {
    setWorkspace((w) => ({
      ...w,
      project: {
        ...w.project,
        assets: w.project.assets.map((asset): Asset => {
          const { original, ...rest } = asset;
          return original ? { ...rest, ...original } : asset;
        }),
      },
      dirty: true,
      job: null,
    }));
    setImagePreview(null);
    setNotice("Đã khôi phục ảnh gốc. Cấu hình vẫn giữ để dùng lần sau.");
  }
  async function importFiles(
    files: File[],
    kind: ImportKind,
    appendImages = false,
  ) {
    if (busy || operation.current || !files.length) return;
    operation.current = true;
    setPhase("importing");
    setError("");
    setNotice("");
    player.current?.pause();
    try {
      const result = await importStoryFiles(
        files,
        project,
        kind,
        setProgress,
        appendImages,
      );
      setWorkspace((w) => ({
        ...w,
        project: result.project,
        options:
          kind === "voices"
            ? { ...w.options, tts: { ...w.options.tts, enabled: false } }
            : kind === "script"
              ? { ...w.options, tts: { ...w.options.tts, dialogue: [] } }
              : w.options,
        dirty: true,
        job: null,
      }));
      const processing = result.project.imageProcessing;
      if (
        kind === "images" &&
        processing?.autoOnImport &&
        (processing.removeLogo || processing.upscale)
      ) {
        const incoming = result.project.assets.filter(
          (asset) =>
            !appendImages || !project.assets.some((old) => old.id === asset.id),
        );
        const abort = new AbortController();
        controller.current = abort;
        setPhase("processing");
        try {
          const processed = await processProjectImages(
            {
              ...result.project,
              assets: incoming,
              scenes: [],
              automation: undefined,
            },
            processing,
            abort.signal,
            setProgress,
          );
          if (abort.signal.aborted)
            throw Error("Đã dừng xử lý; ảnh vừa nhập vẫn được giữ.");
          result.project = {
            ...result.project,
            assets: result.project.assets.map(
              (asset) =>
                processed.assets.find((item) => item.id === asset.id) ?? asset,
            ),
          };
          result.warnings.push(
            ...processed.errors.map((item) => `${item.name}: ${item.error}`),
          );
          setWorkspace((w) => ({
            ...w,
            project: result.project,
            dirty: true,
            job: null,
          }));
        } catch (error) {
          setError(`Đã nhập ảnh gốc. ${errorMessage(error)}`);
        } finally {
          controller.current = null;
        }
      }
      setWarnings(result.warnings);
      setFrame(0);

      setNotice(
        "Đã cập nhật " +
          {
            images: "bộ ảnh",
            voices: "voice",
            script: "lời đọc TXT",
            characters: "bộ nhân vật",
          }[kind] +
          ". Các đầu vào khác được giữ nguyên.",
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      operation.current = false;
      setPhase("idle");
      setProgress("");
    }
  }
  async function openFile(file: File | undefined, type: "project" | "preset") {
    if (!file || busy || operation.current) return;
    operation.current = true;
    setPhase("importing");
    setProgress("Đang mở tệp…");
    setError("");
    try {
      if (file.size > 10_000_000) throw Error("Tệp dự án/mẫu tối đa 10 MB.");
      const data = JSON.parse(await file.text());
      if (type === "project") {
        const next = parseProject(data);
        player.current?.pause();
        setFrame(0);
        setWorkspace({
          project: next,
          options: optionsFromProject(next),
          dirty: !next.scenes.length,
          job: null,
        });
        setWarnings([]);
        setNotice(
          "Đã mở dự án. Xuất video sẽ giữ bản dựng này; Dựng lại sẽ áp dụng mẫu hiện tại.",
        );
      } else {
        if (data.storyPresetVersion !== 1)
          throw Error("Chọn tệp .khung-preset.json đã lưu từ Khung.");
        const next = parseStoryOptions({ ...data.options, name: options.name });
        setWorkspace((w) => ({
          ...w,
          options: next,
          project: {
            ...w.project,
            ...(data.imageProcessing
              ? { imageProcessing: parseImageProcessing(data.imageProcessing) }
              : {}),
          },
          dirty: true,
          job: null,
        }));
        setNotice("Đã áp dụng mẫu. Bấm Tạo video để dựng bộ đầu vào hiện tại.");
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      operation.current = false;
      setPhase("idle");
      setProgress("");
    }
  }
  async function run(
    exportVideo: boolean,
    forceBuild = false,
    voiceOnly = false,
  ) {
    if (busy || operation.current) return;
    operation.current = true;
    setError("");
    setNotice("");
    setConnectionLost(false);
    player.current?.pause();
    const abort = new AbortController();
    controller.current = abort;
    let exportStarted = false;
    try {
      let next = project;
      let buildOptions = options;
      let generated = false;
      if (options.tts.enabled) {
        const tts = parseTtsSettings(options.tts);
        ttsPlan(project.voiceover?.script ?? "", project.assets);
        buildOptions = {
          ...options,
          tts,
        };
        if (!ttsReady) {
          setPhase("generating");
          next = await createTtsVoices(project, tts, abort.signal, setProgress);
          next.voiceover!.uploadLanguage = options.language;
          if (abort.signal.aborted) throw Error("Đã dừng tạo voice.");
          generated = true;
          setWorkspace((w) => ({
            ...w,
            project: next,
            options: buildOptions,
            dirty: true,
            job: null,
          }));
          setFrame(0);
          player.current?.seekTo(0);
        }
        if (voiceOnly) {
          setNotice("Voice đã sẵn sàng. Có thể nghe thử hoặc xuất video.");
          return;
        }
      }
      if (dirty || !hasScenes || forceBuild || generated) {
        setPhase("building");
        setProgress("Đang kiểm tra và ghép đầu vào…");
        const config = storyConfig(next, buildOptions);
        const result = config.narration.enabled
          ? await buildWithNarration(
              next,
              config,
              false,
              abort.signal,
              setProgress,
            )
          : compileAuto(config, next.assets, next, false);
        if (abort.signal.aborted) throw Error("Đã dừng dựng video.");
        next = finishStory(result.project, next, buildOptions, config);
        if (next.voiceover?.tts) next.voiceover.tts = buildOptions.tts;
        setWarnings(result.report.warnings);
        setWorkspace((w) => ({
          ...w,
          project: next,
          options: buildOptions,
          dirty: false,
          job: null,
        }));
        setFrame(0);
        player.current?.seekTo(0);
      }
      if (exportVideo) {
        if (abort.signal.aborted) throw Error("Đã dừng dựng video.");
        setPhase("starting");
        setProgress("Đang chuẩn bị xuất MP4…");
        // Do not abort this POST: obtain its job ID so any requested cancellation can reach the server.
        const response = await fetch("/api/exports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project: next,
            quality: options.quality,
            filename: options.name.trim() + ".mp4",
          }),
        });
        const result = await response.json();
        if (!response.ok)
          throw Error(result.error || "Không bắt đầu được xuất video.");
        exportStarted = true;
        setWorkspace((w) => ({ ...w, job: result }));
        if (abort.signal.aborted) {
          const cancelled = await fetch("/api/exports/" + result.id, {
            method: "DELETE",
          });
          if (cancelled.ok)
            setWorkspace((w) => ({
              ...w,
              job: { ...result, status: "cancelled" },
            }));
          else
            throw Error("Chưa huỷ được xuất video. Hãy bấm Dừng tác vụ lại.");
        }
      } else {
        setNotice("Bản dựng đã sẵn sàng. Xem trước rồi xuất khi bạn muốn.");
      }
    } catch (e) {
      const message = errorMessage(e);
      if (abort.signal.aborted && !exportStarted)
        setNotice("Đã dừng dựng video. Đầu vào được giữ nguyên.");
      else setError(message);
    } finally {
      controller.current = null;
      operation.current = false;
      if (mounted.current) {
        setPhase("idle");
        setProgress("");
      }
    }
  }
  async function cancel() {
    if (
      phase === "processing" ||
      phase === "generating" ||
      phase === "building" ||
      phase === "starting"
    ) {
      controller.current?.abort();
      return;
    }
    if (!running(job)) return;
    try {
      const response = await fetch("/api/exports/" + job!.id, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Chưa huỷ được tác vụ.");
      setWorkspace((w) => ({ ...w, job: result }));
    } catch {
      setError(
        "Chưa kết nối được server để huỷ. Trạng thái xuất vẫn được theo dõi; hãy thử huỷ lại.",
      );
    }
  }
  const seek = useCallback(
    (f: number) => {
      const next = Math.max(0, Math.min(duration - 1, Math.round(f)));
      player.current?.seekTo(next);
      setFrame(next);
    },
    [duration],
  );
  useEffect(() => {
    if (frame >= duration) seek(duration - 1);
  }, [frame, duration, seek]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.code !== "Space" ||
        (e.target as HTMLElement).closest(
          "input,textarea,select,button,a,summary,[contenteditable],dialog",
        )
      )
        return;
      e.preventDefault();
      player.current?.toggle();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  function clearInput(kind: "images" | "voices" | "script") {
    if (busy || operation.current) return;
    player.current?.pause();
    setWorkspace((w) => ({
      ...w,
      project: {
        ...w.project,
        scenes: [],
        automation: undefined,
        assets: kind === "images" ? [] : w.project.assets,
        voiceover: {
          ...(kind !== "voices" ? w.project.voiceover : {}),
          assets: kind === "voices" ? [] : (w.project.voiceover?.assets ?? []),
          script: kind === "script" ? "" : (w.project.voiceover?.script ?? ""),
          scriptName:
            kind === "script" ? "" : (w.project.voiceover?.scriptName ?? ""),
        },
      },
      dirty: true,
      job: null,
    }));
    setFrame(0);
    setError("");
    setNotice("");
    setWarnings([]);
  }
  const statusText = connectionLost
    ? "Mất kết nối server. Đang kết nối lại…"
    : phase !== "idle"
      ? progress
      : job?.status === "preparing"
        ? "Đang chuẩn bị khung hình…"
        : job?.status === "rendering"
          ? "Đang xuất MP4 · " + Math.round(job.progress * 100) + "%"
          : "";

  return (
    <div className="editor-app" ref={layout.root} style={layout.style}>
      <header className="workspace-header">
        <div className="workspace-brand">
          <span>
            <Icon name="film" />
          </span>
          <strong>Khung</strong>
        </div>
        <input
          className="project-name"
          aria-label="Tên video"
          value={options.name}
          maxLength={100}
          disabled={busy}
          onChange={(e) => changeOptions({ name: e.target.value })}
        />
        <span
          className="workspace-saved"
          title={saved ? "Đã lưu trên trình duyệt" : "Đang lưu"}
        >
          <Icon name={saved ? "check" : "clock"} />
        </span>
        <nav className="mobile-panels" aria-label="Không gian làm việc">
          {(
            [
              ["media", "folder", "Tệp"],
              ["preview", "play", "Video"],
              ["settings", "settings", "Sửa"],
            ] as const
          ).map(([id, icon, label]) => (
            <button
              key={id}
              aria-pressed={mobilePanel === id}
              onClick={() => setMobilePanel(id)}
            >
              <Icon name={icon} />
              {label}
            </button>
          ))}
        </nav>
        <div className="workspace-ratio" role="group" aria-label="Tỷ lệ video">
          {(["9:16", "16:9"] as const).map((ratio) => (
            <button
              key={ratio}
              disabled={busy}
              aria-pressed={options.ratio === ratio}
              onClick={() => changeOptions({ ratio })}
            >
              <span
                className={
                  ratio === "9:16" ? "ratio-portrait" : "ratio-landscape"
                }
              />
              {ratio}
            </button>
          ))}
        </div>
        <details className="project-menu">
          <summary aria-label="Tệp và tuỳ chọn" title="Tệp và tuỳ chọn">
            <Icon name="folder" />
            <span>Tệp</span>
            <Icon name="down" />
          </summary>
          <div className="project-menu-content">
            <button
              disabled={busy}
              onClick={() => projectInput.current?.click()}
            >
              <Icon name="folder" />
              Mở dự án
            </button>
            <button
              disabled={busy || dirty || !hasScenes}
              onClick={() =>
                saveJson((project.name || "video") + ".khung.json", project)
              }
            >
              <Icon name="save" />
              Lưu dự án
            </button>
            <hr />
            <button
              disabled={busy}
              onClick={() => presetInput.current?.click()}
            >
              Mở mẫu dựng
            </button>
            <button
              disabled={busy}
              onClick={() => {
                try {
                  saveJson("mau-ke-chuyen.khung-preset.json", {
                    storyPresetVersion: 1,
                    imageProcessing: project.imageProcessing,
                    options: parseStoryOptions({
                      ...options,
                      tts: { ...options.tts, dialogue: [] },
                    }),
                  });
                } catch (e) {
                  setError(errorMessage(e));
                }
              }}
            >
              Lưu mẫu dựng
            </button>
            <button onClick={layout.reset}>Khôi phục bố cục</button>
            <hr />
            <label>
              Chất lượng
              <select
                disabled={busy}
                value={options.quality}
                onChange={(e) =>
                  changeOptions({
                    quality: e.target.value as StoryOptions["quality"],
                  })
                }
              >
                <option value="high">1080p</option>
                <option value="standard">720p</option>
              </select>
            </label>
            <label>
              Model căn phụ đề
              <select
                disabled={busy}
                value={options.model}
                onChange={(e) =>
                  changeOptions({
                    model: e.target.value as StoryOptions["model"],
                  })
                }
              >
                {["tiny", "base", "small", "medium"].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label>
              Ngôn ngữ
              <select
                disabled={busy || options.tts.enabled}
                value={
                  options.tts.enabled
                    ? options.tts.model === "turbo"
                      ? "en"
                      : options.tts.languageId
                    : options.language
                }
                onChange={(e) =>
                  changeOptions({
                    language: e.target.value as StoryOptions["language"],
                  })
                }
              >
                {Object.entries(NARRATION_LANGUAGES).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button disabled={busy} onClick={() => setResetOpen(true)}>
              Câu chuyện mới
            </button>
            {!!warnings.length && (
              <details className="compact-details">
                <summary>Ghi chú · {warnings.length}</summary>
                <ul>
                  {warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </details>
        {busy ? (
          <button
            className="button export-button"
            onClick={() => void cancel()}
            disabled={phase === "importing"}
          >
            <Icon name="close" />
            {phase === "importing" ? "Đang nhập" : "Dừng"}
          </button>
        ) : (
          <button
            className="button primary export-button"
            disabled={!canRun}
            onClick={() => void run(true)}
          >
            <Icon name="download" />
            Xuất video
          </button>
        )}
      </header>
      {(busy ||
        error ||
        job?.status === "error" ||
        notice ||
        job?.status === "done" ||
        job?.status === "cancelled") && (
        <div
          className={
            "workspace-message" +
            (error || job?.status === "error" ? " is-error" : "")
          }
          role={error || job?.status === "error" ? "alert" : "status"}
        >
          {busy ? (
            <>
              <span className="working-indicator" />
              <span>{statusText}</span>
              {running(job) && (
                <progress
                  max={1}
                  value={job!.progress}
                  aria-label="Tiến độ xuất"
                />
              )}
            </>
          ) : error || job?.status === "error" ? (
            <>
              <Icon name="info" />
              <span>
                {error || job?.error}
                {/python|\buv\b|whisper|venv|bộ căn phụ đề|model voice/i.test(
                  error || job?.error || "",
                ) && (
                  <>
                    {" "}
                    · Cài bằng <code>npm run setup:voice</code>
                  </>
                )}
              </span>
              <button
                aria-label="Đóng thông báo lỗi"
                onClick={() => {
                  setError("");
                  if (job?.status === "error")
                    setWorkspace((w) => ({ ...w, job: null }));
                }}
              >
                <Icon name="close" />
              </button>
            </>
          ) : job?.status === "done" && job.url ? (
            <>
              <Icon name="check" />
              <span>Đã xuất MP4</span>
              <a href={job.url} download>
                Tải video
                <Icon name="download" />
              </a>
              {job.subtitleUrl && (
                <a href={job.subtitleUrl} download={job.subtitleFilename}>
                  SRT gốc
                  <Icon name="download" />
                </a>
              )}
            </>
          ) : (
            <>
              <Icon name="check" />
              <span>
                {job?.status === "cancelled" ? "Đã huỷ xuất" : notice}
              </span>
              <button
                aria-label="Đóng thông báo"
                onClick={() => {
                  setNotice("");
                  if (job?.status === "cancelled")
                    setWorkspace((w) => ({ ...w, job: null }));
                }}
              >
                <Icon name="close" />
              </button>
            </>
          )}
        </div>
      )}
      <main className="workspace-main" data-panel={mobilePanel}>
        <aside className="media-panel" aria-label="Tài nguyên">
          <div className="panel-title">
            <h2>Câu chuyện</h2>
            <span>{project.assets.length} ảnh</span>
          </div>
          <fieldset disabled={busy} className="media-inputs">
            <StoryInput
              title="Ảnh bối cảnh"
              icon="image"
              hint="PNG · JPG · WebP"
              summary={
                project.assets.length
                  ? project.assets.length + " ảnh"
                  : "Chưa có ảnh"
              }
              selected={project.assets.length > 0}
              busy={busy}
              onChoose={() => imagesInput.current?.click()}
              onDrop={(files) => void importFiles(files, "images")}
              onClear={() => clearInput("images")}
            />
            <StoryInput
              title="Lời đọc TXT"
              icon="text"
              hint="Một TXT đánh số 1., 2., 3.…"
              summary={
                hasScript
                  ? project.voiceover?.scriptName || "Đã nhập TXT"
                  : "Chưa có TXT"
              }
              selected={hasScript}
              busy={busy}
              onChoose={() => scriptInput.current?.click()}
              onDrop={(files) => void importFiles(files, "script")}
              onClear={() => clearInput("script")}
            />
            <div>
              <button
                className="resource-config"
                onClick={() => setResourceDialog("tts")}
              >
                <Icon name="voice" />
                <span>
                  <strong>Lời đọc & giọng</strong>
                  <small>
                    {options.tts.enabled
                      ? `${options.tts.speakers.length + 1} người nói · ${ttsReady ? `${voiceCount} voice sẵn sàng` : "Tạo từ TXT"}`
                      : `WAV / MP3 · ${voiceCount} file`}{" "}
                    · Chỉnh lời và phân vai
                  </small>
                </span>
                <Icon name="settings" />
              </button>
            </div>
          </fieldset>
          {project.assets.length > 0 && validation.error && (
            <p className="media-validation">
              <Icon name="info" />
              {validation.error}
            </p>
          )}
          <div className="media-gallery-heading">
            <strong>Ảnh đã nhập</strong>
            <button
              className="icon-button"
              aria-label="Thêm ảnh"
              title="Thêm ảnh"
              disabled={busy}
              onClick={() => addImagesInput.current?.click()}
            >
              <Icon name="plus" />
            </button>
          </div>
          <div className="media-gallery">
            {project.assets.map((asset, i) => {
              const scene = previewProject.scenes.find(
                (s) => s.assetId === asset.id,
              );
              const item = previewItems.find((t) => t.scene.id === scene?.id);
              return (
                <button
                  key={asset.id}
                  className={activeScene === scene?.id ? "active" : ""}
                  title={asset.name}
                  aria-label={"Xem ảnh " + asset.name}
                  onClick={() => {
                    if (item) seek(item.from + item.overlap);
                    setMobilePanel("preview");
                  }}
                >
                  <img src={asset.src} alt="" loading="lazy" />
                  <span>{asset.name}</span>
                  <small>{i + 1}</small>
                </button>
              );
            })}
          </div>
          {!project.assets.length && (
            <p className="empty-small">Chọn ảnh để bắt đầu</p>
          )}
          <div className="resource-tools" aria-label="Công cụ tài nguyên">
            <button disabled={busy} onClick={() => setResourceDialog("images")}>
              <Icon name="image" />
              <span>
                Xử lý ảnh
                <small>
                  Xóa logo · Upscale · Hàng loạt
                  {imageSettings.autoOnImport ? " · Tự động" : ""}
                </small>
              </span>
              <Icon name="next" />
            </button>
            <button
              disabled={busy}
              onClick={() => setResourceDialog("subtitles")}
            >
              <Icon name="text" />
              <span>
                Phụ đề & SRT<small>Xuất · dịch · song ngữ</small>
              </span>
              <Icon name="next" />
            </button>
            <button disabled={busy} onClick={() => setResourceDialog("actors")}>
              <Icon name="image" />
              <span>
                Nhân vật & vật thể
                <small>{project.actors?.length ?? 0} asset</small>
              </span>
              <Icon name="next" />
            </button>
          </div>
          <button
            className="resource-help"
            onClick={() => setResourceDialog("help")}
          >
            <Icon name="info" />
            Cách chuẩn bị đầu vào
          </button>
        </aside>
        {layout.mediaHandle}
        <section className="preview-workspace" aria-label="Xem thử video">
          <div className="preview-toolbar">
            <button
              className="align-button"
              disabled={busy}
              onClick={() => setResourceDialog("subtitles")}
            >
              <Icon name="download" />
              SRT
            </button>
            <span
              className={
                "preview-status" + (preview.estimated ? " is-estimated" : "")
              }
            >
              <Icon name={preview.estimated ? "clock" : "check"} />
              {preview.estimated
                ? "Phụ đề ước tính"
                : previewHasScenes
                  ? "Xem thử"
                  : "Chưa có ảnh"}
            </span>
            {(voiceCount > 0 || options.tts.enabled) && hasScript && (
              <button
                className="align-button"
                disabled={busy || !!validation.error}
                onClick={() => void run(false, true)}
              >
                <Icon name="text" />
                {!dirty && hasScenes ? "Căn lại" : "Căn phụ đề"}
              </button>
            )}
          </div>
          <div className="preview-canvas">
            {previewHasScenes ? (
              <Player
                ref={player}
                key={previewProject.width + "x" + previewProject.height}
                component={Video}
                inputProps={{ project: previewProject }}
                durationInFrames={Math.max(1, duration)}
                compositionWidth={previewProject.width}
                compositionHeight={previewProject.height}
                fps={previewProject.fps}
                controls={false}
                initiallyMuted={muted}
                clickToPlay
                doubleClickToFullscreen
                style={{ width: "100%", height: "100%" }}
                errorFallback={({ error: previewError }) => (
                  <div className="preview-error">
                    <Icon name="info" />
                    <strong>Không tải được preview</strong>
                    <p>{previewError.message}</p>
                  </div>
                )}
              />
            ) : (
              <div className="canvas-empty">
                <div
                  className={
                    "empty-aspect " +
                    (options.ratio === "9:16" ? "portrait" : "landscape")
                  }
                >
                  <Icon name="film" />
                  <strong>Video của bạn</strong>
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => imagesInput.current?.click()}
                  >
                    <Icon name="plus" />
                    Thêm ảnh
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="preview-bottom">
            <span>
              {previewHasScenes
                ? "Cảnh " +
                  (previewItems.findIndex((i) => i.scene.id === activeScene) +
                    1) +
                  " / " +
                  previewProject.scenes.length
                : "9:16 · 16:9"}
            </span>
            <div>
              <button
                className="icon-button"
                aria-label={muted ? "Bật tiếng" : "Tắt tiếng"}
                title={muted ? "Bật tiếng" : "Tắt tiếng"}
                onClick={() => {
                  setMuted((v) => !v);
                  if (muted) player.current?.unmute();
                  else player.current?.mute();
                }}
              >
                <Icon name={muted ? "muted" : "volume"} />
              </button>
              <button
                className="icon-button"
                aria-label="Toàn màn hình"
                title="Toàn màn hình"
                disabled={!previewHasScenes}
                onClick={() => player.current?.requestFullscreen()}
              >
                <Icon name="expand" />
              </button>
            </div>
          </div>
        </section>
        {layout.settingsHandle}
        <QuickSettings
          options={quickOptions}
          tab={settingsTab}
          onTab={setSettingsTab}
          onChange={changeQuickOptions}
          scope={sceneScope ? "scene" : "all"}
          onScope={(value) => {
            setSettingsScope(value);
            if (value === "scene") player.current?.pause();
          }}
          sceneNumber={
            activeAsset
              ? previewItems.findIndex((i) => i.scene.id === activeScene) + 1
              : 0
          }
          sceneLabel={activeAsset?.name}
          overrideCount={Object.keys(options.sceneOverrides).length}
          hasOverride={Boolean(
            activeAsset && options.sceneOverrides[activeAsset.name],
          )}
          onClearOverride={() => {
            if (!activeAsset) return;
            changeOptions({
              sceneOverrides: Object.fromEntries(
                Object.entries(options.sceneOverrides).filter(
                  ([file]) => file !== activeAsset.name,
                ),
              ),
            });
          }}
          onClearAllOverrides={() => changeOptions({ sceneOverrides: {} })}
          busy={busy}
          images={
            sceneScope && activeAsset
              ? [
                  activeAsset.src,
                  ...project.assets
                    .filter((a) => a.id !== activeAsset.id)
                    .slice(0, 1)
                    .map((a) => a.src),
                ]
              : project.assets.slice(0, 2).map((a) => a.src)
          }
        />
      </main>
      {layout.timelineHandle}
      <Timeline
        project={previewProject}
        frame={frame}
        playing={playing}
        estimated={preview.estimated}
        busy={busy}
        onSeek={seek}
        onToggle={() => player.current?.toggle()}
        onAdd={() => imagesInput.current?.click()}
        onMotion={() => {
          setSettingsTab("motion");
          setMobilePanel("settings");
        }}
        onTransition={() => {
          setSettingsTab("transition");
          setSettingsScope("scene");
          player.current?.pause();
          setMobilePanel("settings");
        }}
        onCaption={() => {
          setSettingsTab("caption");
          setMobilePanel("settings");
        }}
        onVoice={() => {
          setMobilePanel("media");
          setResourceDialog("tts");
        }}
        onText={() => {
          setMobilePanel("media");
          setResourceDialog("tts");
        }}
      />
      <EditorDialog
        open={resourceDialog === "tts"}
        title="Lời đọc & giọng"
        wide
        onClose={() => setResourceDialog(null)}
      >
        <NarrationPanel
          script={project.voiceover?.script ?? ""}
          settings={options.tts}
          images={project.assets}
          busy={busy}
          ready={ttsReady}
          voices={project.voiceover?.assets ?? []}
          canGenerate={hasScript && !validation.error}
          onChange={changeTtsSettings}
          onDocument={(script: string, dialogue: SceneDialogue[]) => {
            setWorkspace((w) => ({
              ...w,
              project: {
                ...w.project,
                voiceover: {
                  ...w.project.voiceover,
                  assets: w.project.voiceover?.assets ?? [],
                  script,
                  scriptName: w.project.voiceover?.scriptName || "script.txt",
                },
              },
              options: { ...w.options, tts: { ...w.options.tts, dialogue } },
              dirty: true,
              job: null,
            }));
            setError("");
          }}
          onReference={(file, speakerId) =>
            void uploadTtsReference(file, speakerId)
          }
          onGenerate={() => void run(false, false, true)}
          onImportScript={() => {
            setResourceDialog(null);
            scriptInput.current?.click();
          }}
          onUploadVoices={() => {
            setResourceDialog(null);
            voicesInput.current?.click();
          }}
        />
        {busy && (
          <div className="narration-operation">
            <p className="dialog-help" role="status">
              {progress}
            </p>
            {phase === "generating" && (
              <button className="button" onClick={() => void cancel()}>
                Dừng tạo voice
              </button>
            )}
          </div>
        )}
        {error && (
          <p className="dialog-error" role="alert">
            {error}
          </p>
        )}
      </EditorDialog>
      <EditorDialog
        open={resourceDialog === "images"}
        title="Xử lý ảnh · Xóa logo & Upscale"
        className="image-processing-dialog"
        wide
        onClose={() => setResourceDialog(null)}
      >
        <ImageProcessingPanel
          assets={project.assets}
          settings={imageSettings}
          busy={busy}
          progress={progress}
          preview={imagePreview}
          onChange={changeImageSettings}
          onRun={(assetId) => void processImages(assetId)}
          onRestore={restoreOriginalImages}
          onCancel={() => void cancel()}
        />
        {error && (
          <p className="dialog-error" role="alert">
            {error}
          </p>
        )}
      </EditorDialog>
      <EditorDialog
        open={resourceDialog === "subtitles"}
        title="Phụ đề & SRT"
        wide
        onClose={() => setResourceDialog(null)}
      >
        <SubtitlePanel
          project={previewProject}
          estimated={preview.estimated}
          defaultLanguage={
            options.tts.enabled
              ? options.tts.model === "turbo"
                ? "en"
                : options.tts.languageId
              : options.language
          }
          busy={busy}
          canAlign={
            (voiceCount > 0 || options.tts.enabled) &&
            hasScript &&
            !validation.error
          }
          onAlign={() => {
            setResourceDialog(null);
            void run(false, true);
          }}
        />
      </EditorDialog>
      <EditorDialog
        open={resourceDialog === "actors"}
        title="Nhân vật & vật thể"
        onClose={() => setResourceDialog(null)}
      >
        <fieldset disabled={busy}>
          <button
            className="button"
            onClick={() => actorsInput.current?.click()}
          >
            <Icon name="plus" />
            Nhập bộ asset
          </button>
          <label className="toggle-line">
            <span>Tự thêm vào cảnh</span>
            <input
              type="checkbox"
              checked={options.characters}
              onChange={(e) => changeOptions({ characters: e.target.checked })}
            />
          </label>
          <p className="dialog-help">
            PNG tách nền, bộ phận hoặc sprite có sẵn. Chọn thư mục asset riêng.
          </p>
          {project.actors?.map((a) => (
            <p className="actor-name" key={a.id}>
              {a.name}
            </p>
          ))}
        </fieldset>
      </EditorDialog>
      <EditorDialog
        open={resourceDialog === "help"}
        title="Chuẩn bị câu chuyện"
        onClose={() => setResourceDialog(null)}
      >
        <p>
          Ảnh 01 + voice 01 + mục TXT 1. Chọn riêng từng loại; có thể dùng TTS
          để tạo voice từ TXT.
        </p>
        <pre>{"1. Lời đọc cảnh một.\n2. Lời đọc cảnh hai."}</pre>
        <p className="dialog-help">
          Căn thời gian từ voice cần bộ Whisper:{" "}
          <code>npm run setup:voice</code> (uv). Dịch SRT dùng Google API, không
          cần thêm model local.
        </p>
      </EditorDialog>
      <input
        ref={imagesInput}
        hidden
        type="file"
        multiple
        accept=".png,.jpg,.jpeg,.webp"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void importFiles(files, "images");
        }}
      />
      <input
        ref={voicesInput}
        hidden
        type="file"
        multiple
        accept=".wav,.mp3,audio/wav,audio/x-wav,audio/mpeg"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void importFiles(files, "voices");
        }}
      />
      <input
        ref={addImagesInput}
        hidden
        type="file"
        multiple
        accept=".png,.jpg,.jpeg,.webp"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void importFiles(files, "images", true);
        }}
      />
      <input
        ref={scriptInput}
        hidden
        type="file"
        accept=".txt"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void importFiles(files, "script");
        }}
      />
      <input
        ref={(node) => {
          actorsInput.current = node;
          node?.setAttribute("webkitdirectory", "");
        }}
        hidden
        type="file"
        multiple
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void importFiles(files, "characters");
        }}
      />
      <input
        ref={projectInput}
        hidden
        type="file"
        accept=".json"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          void openFile(file, "project");
        }}
      />
      <input
        ref={presetInput}
        hidden
        type="file"
        accept=".json"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          void openFile(file, "preset");
        }}
      />
      <dialog
        ref={resetDialog}
        className="reset-dialog"
        onCancel={() => setResetOpen(false)}
      >
        <h2>Bắt đầu câu chuyện mới?</h2>
        <p>
          Khung sẽ bỏ bản dựng hiện tại khỏi trình duyệt. Các tệp trong data và
          video đã xuất vẫn được giữ.
        </p>
        <div className="inline-actions">
          <button className="button" onClick={() => setResetOpen(false)}>
            Quay lại
          </button>
          <button
            className="button primary"
            onClick={() => {
              player.current?.pause();
              setWorkspace({
                project: emptyProject(),
                options: { ...options, name: "Câu chuyện của tôi" },
                dirty: true,
                job: null,
              });
              setError("");
              setNotice("");
              setWarnings([]);
              setFrame(0);
              setResetOpen(false);
            }}
          >
            Tạo câu chuyện mới
          </button>
        </div>
      </dialog>
    </div>
  );
}
