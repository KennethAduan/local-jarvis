mod loudness;
mod pack;
mod phonemes;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Deserialize;
use sherpa_onnx::{
    GenerationConfig, OfflineTts, OfflineTtsConfig, OfflineTtsKokoroModelConfig,
    OfflineTtsModelConfig,
};
use std::{
    io::{self, BufRead, Write},
    path::{Path, PathBuf},
    time::{Duration, Instant},
};

const MAX_LINE: usize = 8192;
const MAX_TEXT: usize = 240;
const RATE: usize = 24_000;
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Request {
    id: String,
    text: String,
    speed: f32,
    volume: f32,
}
impl Request {
    fn validate(&self) -> Result<(), &'static str> {
        if self.id.is_empty() || self.id.len() > 128 || self.id.chars().any(char::is_control) {
            return Err("Invalid request id");
        }
        if self.text.trim().is_empty()
            || self.text.chars().count() > MAX_TEXT
            || self.text.contains('\0')
        {
            return Err("Invalid speech text");
        }
        if !self.speed.is_finite() || !(0.75..=1.5).contains(&self.speed) {
            return Err("Invalid speech speed");
        }
        if !self.volume.is_finite() || !(0.0..=1.5).contains(&self.volume) {
            return Err("Invalid speech volume");
        }
        Ok(())
    }
}
struct Engine {
    tts: OfflineTts,
    phonemizer: phonemes::BritishPhonemizer,
    _assets: Vec<std::fs::File>,
}
impl Engine {
    fn load(dir: &Path) -> Result<Self, String> {
        let assets = pack::verify(dir)?;
        let path = |name: &str| dir.join(name).to_string_lossy().into_owned();
        let config = OfflineTtsConfig {
            model: OfflineTtsModelConfig {
                kokoro: OfflineTtsKokoroModelConfig {
                    model: Some(path("model.int8.onnx")),
                    voices: Some(path("voices.bin")),
                    tokens: Some(path("tokens.txt")),
                    lexicon: Some(path("lexicon-gb-en.txt")),
                    ..Default::default()
                },
                provider: Some("cpu".into()),
                num_threads: 2,
                debug: false,
                ..Default::default()
            },
            max_num_sentences: 1,
            ..Default::default()
        };
        Ok(Self {
            tts: OfflineTts::create(&config).ok_or("Could not load voice pack")?,
            phonemizer: phonemes::BritishPhonemizer::load(&dir.join("lexicon-gb-en.txt"))?,
            _assets: assets,
        })
    }
    fn synthesize(&self, request: &Request) -> Result<String, String> {
        let phones = self.phonemizer.phonemes(&request.text)?;
        let deadline = Instant::now() + Duration::from_secs(60);
        let audio = self
            .tts
            .generate_with_config(
                "",
                &GenerationConfig {
                    sid: 26,
                    speed: request.speed,
                    phoneme_codepoints: Some(vec![phones]),
                    ..Default::default()
                },
                Some(move |_: &[f32], _| Instant::now() < deadline),
            )
            .ok_or("Speech synthesis failed")?;
        let samples = audio.samples();
        if Instant::now() >= deadline
            || audio.sample_rate() != RATE as i32
            || samples.is_empty()
            || samples.len() > RATE * 60
            || samples.iter().any(|s| !s.is_finite())
        {
            return Err("Invalid or oversized synthesized audio".into());
        }
        let samples =
            loudness::normalize(loudness::speech_edges(samples, RATE as u32), request.volume);
        let mut pcm = Vec::with_capacity(samples.len() * 2);
        for sample in samples {
            pcm.extend_from_slice(&((sample.clamp(-1.0, 1.0) * 32767.0) as i16).to_le_bytes());
        }
        Ok(STANDARD.encode(pcm))
    }
}
// Bound memory even for a peer that sends an arbitrarily long line; drain it before reading again.
fn read_line<R: BufRead>(input: &mut R) -> io::Result<Option<Result<Vec<u8>, ()>>> {
    let mut line = Vec::new();
    let mut oversized = false;
    let mut saw = false;
    loop {
        let buf = input.fill_buf()?;
        if buf.is_empty() {
            return Ok(if saw {
                Some(if oversized { Err(()) } else { Ok(line) })
            } else {
                None
            });
        }
        saw = true;
        let end = buf.iter().position(|&b| b == b'\n');
        let count = end.map_or(buf.len(), |n| n + 1);
        let data_len = end.unwrap_or(count);
        if line.len() + data_len > MAX_LINE {
            oversized = true;
        }
        if !oversized {
            line.extend_from_slice(&buf[..data_len]);
        }
        input.consume(count);
        if end.is_some() {
            return Ok(Some(if oversized { Err(()) } else { Ok(line) }));
        }
    }
}
fn response(
    line: Result<Vec<u8>, ()>,
    engine: &mut Option<Engine>,
    dir: &Path,
) -> serde_json::Value {
    let bytes = match line {
        Ok(v) => v,
        Err(()) => return serde_json::json!({"id":"", "error":"Request too large"}),
    };
    let request: Request = match serde_json::from_slice(&bytes) {
        Ok(r) => r,
        Err(_) => {
            // Preserve a bounded, valid ID for structurally invalid requests when possible.
            let id = serde_json::from_slice::<serde_json::Value>(&bytes)
                .ok()
                .and_then(|v| v.get("id").and_then(|id| id.as_str()).map(str::to_owned))
                .filter(|id| !id.is_empty() && id.len() <= 128 && !id.chars().any(char::is_control))
                .unwrap_or_default();
            return serde_json::json!({"id":id, "error":"Invalid request"});
        }
    };
    if let Err(error) = request.validate() {
        return serde_json::json!({"id":request.id, "error":error});
    }
    let result = (|| {
        if engine.is_none() {
            *engine = Some(Engine::load(dir)?);
        }
        engine.as_ref().unwrap().synthesize(&request)
    })();
    match result {
        Ok(pcm) => serde_json::json!({"id":request.id,"rate":RATE,"pcm":pcm,"end":true}),
        Err(error) => serde_json::json!({"id":request.id,"error":error}),
    }
}
fn run() -> Result<(), String> {
    let args: Vec<_> = std::env::args_os().skip(1).collect();
    if args.len() != 2 || args[0] != "--model-dir" {
        return Err("Usage: jarvis-kokoro --model-dir <absolute directory>".into());
    }
    let dir = PathBuf::from(&args[1]);
    if !dir.is_absolute() {
        return Err("Model directory must be absolute".into());
    }
    let stdin = io::stdin();
    let mut input = stdin.lock();
    let stdout = io::stdout();
    let mut output = stdout.lock();
    let mut engine = None;
    while let Some(line) = read_line(&mut input).map_err(|_| "Could not read request")? {
        serde_json::to_writer(&mut output, &response(line, &mut engine, &dir))
            .map_err(|_| "Could not write response")?;
        output
            .write_all(b"\n")
            .and_then(|_| output.flush())
            .map_err(|_| "Could not write response")?;
    }
    Ok(())
}
fn main() {
    if let Err(e) = run() {
        eprintln!("{e}");
        std::process::exit(1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_invalid_requests() {
        for raw in [
            r#"{"id":"x","text":" ","speed":1,"volume":1}"#,
            r#"{"id":"x","text":"x\u0000","speed":1,"volume":1}"#,
            r#"{"id":"x","text":"x","speed":0.74,"volume":1}"#,
            r#"{"id":"x","text":"x","speed":1,"volume":1.51}"#,
            r#"{"id":"x","text":"x","speed":1,"volume":1,"extra":true}"#,
        ] {
            let value = response(Ok(raw.as_bytes().to_vec()), &mut None, Path::new("invalid"));
            assert!(value.get("error").is_some());
        }
        let req = Request {
            id: "x".into(),
            text: "a".repeat(241),
            speed: f32::NAN,
            volume: 1.,
        };
        assert!(req.validate().is_err());
    }
    #[test]
    fn bounds_lines_and_recovers_after_oversize() {
        let mut data = vec![b'x'; MAX_LINE + 1];
        data.extend_from_slice(b"\nnext\n");
        let mut input = io::BufReader::new(data.as_slice());
        assert!(read_line(&mut input).unwrap().unwrap().is_err());
        assert_eq!(read_line(&mut input).unwrap().unwrap().unwrap(), b"next");
        assert!(read_line(&mut input).unwrap().is_none());
    }
}
