"""OpenVoice V2 bridge used by the Node video renderer."""
import argparse, glob, os, sys, subprocess

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--openvoice-dir", required=True); p.add_argument("--text", required=True)
    p.add_argument("--reference", required=True); p.add_argument("--language", default="EN")
    p.add_argument("--speed", type=float, default=1.0); p.add_argument("--output", required=True)
    a = p.parse_args(); sys.path.insert(0, os.path.abspath(a.openvoice_dir))
    import torch
    from openvoice.api import ToneColorConverter
    from openvoice import se_extractor
    from melo.api import TTS
    device = "cuda:0" if torch.cuda.is_available() else "cpu"
    ckpt = os.path.join(a.openvoice_dir, "checkpoints_v2")
    converter = ToneColorConverter(os.path.join(ckpt, "converter", "config.json"), device=device)
    converter.load_ckpt(os.path.join(ckpt, "converter", "checkpoint.pth"))
    tts = TTS(language=a.language, device=device)
    speaker_id = list(tts.hps.data.spk2id.values())[0]
    base = a.output + ".base.wav"
    tts.tts_to_file(a.text, speaker_id, output_path=base, speed=a.speed)
    # V2 uses a precomputed MeloTTS base-speaker embedding as source SE.
    # Extracting SE from a short generated sentence can fail VAD as "too short".
    source_files = glob.glob(os.path.join(ckpt, "base_speakers", "ses", "*.pth"))
    if not source_files:
        raise FileNotFoundError("No base speaker embeddings under checkpoints_v2/base_speakers/ses")
    loaded_source_se = torch.load(source_files[0], map_location=device)
    src_se = loaded_source_se[0] if isinstance(loaded_source_se, tuple) else loaded_source_se
    loaded_target_se = se_extractor.get_se(a.reference, converter, vad=True)
    target_se = loaded_target_se[0] if isinstance(loaded_target_se, tuple) else loaded_target_se
    converted = a.output + ".converted.wav"
    converter.convert(audio_src_path=base, src_se=src_se, tgt_se=target_se, output_path=converted)
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", converted, a.output], check=True)
    os.unlink(base)
    os.unlink(converted)

if __name__ == "__main__": main()
