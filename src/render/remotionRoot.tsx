import React from "react";
import {
  AbsoluteFill,
  Audio,
  Composition,
  Img,
  Sequence,
  Video,
  interpolate,
  useCurrentFrame,
  useVideoConfig
} from "remotion";
import { registerRoot } from "remotion";
import type { RenderPlan, TimelineAsset, TimelineScene } from "../domain/timeline.js";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="SceneMarketingVideo"
      component={SceneMarketingVideo}
      durationInFrames={900}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={defaultRenderPlan}
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.max(1, Math.ceil(props.duration * props.fps)),
        fps: props.fps,
        width: props.width,
        height: props.height
      })}
    />
  );
};

const SceneMarketingVideo: React.FC<RenderPlan> = (plan) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#080808", fontFamily: "Inter, Arial, sans-serif" }}>
      {plan.scenes.map((scene) => (
        <Sequence key={scene.id} from={seconds(scene.start, fps)} durationInFrames={seconds(scene.duration, fps)}>
          <SceneLayer scene={scene} template={plan.template} />
        </Sequence>
      ))}
      {plan.music ? (
        <Audio src={plan.music.url} volume={plan.music.volume} loop />
      ) : null}
      <BrandingOverlay branding={plan.branding} />
    </AbsoluteFill>
  );
};

const SceneLayer: React.FC<{ scene: TimelineScene; template: string }> = ({ scene, template }) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      {scene.assets.map((asset, index) => (
        <Sequence key={`${asset.url}-${index}`} from={seconds(asset.start, fps)} durationInFrames={seconds(asset.duration, fps)}>
          <AssetLayer asset={asset} template={template} />
        </Sequence>
      ))}
      <Audio src={scene.voiceAudioUrl} volume={1.2} />
      <Subtitle text={scene.subtitle} />
    </AbsoluteFill>
  );
};

const AssetLayer: React.FC<{ asset: TimelineAsset; template: string }> = ({ asset, template }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const durationFrames = Math.max(1, seconds(asset.duration, fps));
  const progress = interpolate(frame, [0, durationFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const style = animationStyle(asset, progress);
  const filter = template === "luxury" ? "saturate(0.95) contrast(1.08)" : "saturate(1.05) contrast(1.02)";

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#111" }}>
      {asset.type === "video" ? (
        <Video src={asset.url} muted style={{ width: "100%", height: "100%", objectFit: "cover", ...style, filter }} />
      ) : (
        <Img src={asset.url} style={{ width: "100%", height: "100%", objectFit: "cover", ...style, filter }} />
      )}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.16) 0%, rgba(0,0,0,0.02) 44%, rgba(0,0,0,0.42) 100%)" }} />
    </AbsoluteFill>
  );
};

const Subtitle: React.FC<{ text: string }> = ({ text }) => {
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", padding: "0 72px 190px" }}>
      <div style={{
        color: "white",
        fontSize: 76,
        lineHeight: 1.08,
        fontWeight: 850,
        textAlign: "center",
        textShadow: "0 4px 22px rgba(0,0,0,0.78)",
        backgroundColor: "rgba(0,0,0,0.36)",
        padding: "22px 34px",
        borderRadius: 8,
        maxWidth: "100%"
      }}>
        {text}
      </div>
    </AbsoluteFill>
  );
};

const BrandingOverlay: React.FC<{ branding: RenderPlan["branding"] }> = ({ branding }) => {
  if (!branding) {
    return null;
  }
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {branding.logoUrl ? (
        <Img src={branding.logoUrl} style={{
          position: "absolute",
          top: 58,
          right: 56,
          width: 150,
          maxHeight: 96,
          objectFit: "contain"
        }} />
      ) : null}
      {branding.watermark ? (
        <div style={{
          position: "absolute",
          right: 54,
          bottom: 72,
          color: "rgba(255,255,255,0.72)",
          fontSize: 34,
          fontWeight: 800,
          letterSpacing: 0,
          textShadow: "0 2px 12px rgba(0,0,0,0.5)"
        }}>
          {branding.watermark}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

function animationStyle(asset: TimelineAsset, progress: number): React.CSSProperties {
  if (asset.animation === "fade") {
    return {
      opacity: interpolate(progress, [0, 0.12, 1], [0, 1, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      transform: "scale(1.04)"
    };
  }
  if (asset.animation === "zoom-out") {
    return { transform: `scale(${interpolate(progress, [0, 1], [1.14, 1.02])})` };
  }
  if (asset.animation === "pan-left") {
    return { transform: `scale(1.09) translateX(${interpolate(progress, [0, 1], [3, -3])}%)` };
  }
  if (asset.animation === "pan-right") {
    return { transform: `scale(1.09) translateX(${interpolate(progress, [0, 1], [-3, 3])}%)` };
  }
  if (asset.animation === "none") {
    return {};
  }
  return { transform: `scale(${interpolate(progress, [0, 1], [1.02, 1.14])})` };
}

function seconds(value: number, fps: number): number {
  return Math.max(1, Math.round(value * fps));
}

const defaultRenderPlan: RenderPlan = {
  template: "real-estate",
  width: 1080,
  height: 1920,
  fps: 30,
  duration: 30,
  scenes: []
};

export default RemotionRoot;

registerRoot(RemotionRoot);
