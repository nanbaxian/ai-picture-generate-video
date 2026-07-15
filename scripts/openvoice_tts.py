"""OpenVoice V2 bridge used by the Node video renderer."""
import argparse, os, sys, subprocess

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
    src_se = se_extractor.get_se(base, converter, vad=True)
    target_se = se_extractor.get_se(a.reference, converter, vad=True)
    converted = a.output + ".converted.wav"
    converter.convert(audio_src_path=base, src_se=src_se, tgt_se=target_se, output_path=converted)
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", converted, a.output], check=True)
    os.unlink(base)
    os.unlink(converted)

if __name__ == "__main__": main()
