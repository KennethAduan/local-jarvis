use base64::{engine::general_purpose::STANDARD, Engine as _};
use std::{
    io::Write,
    process::{Command, Stdio},
};

#[test]
fn protocol_rejects_bad_requests_and_exits_on_eof() {
    let dir = std::env::temp_dir();
    let mut child = Command::new(env!("CARGO_BIN_EXE_jarvis-kokoro"))
        .arg("--model-dir")
        .arg(dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .unwrap();
    let mut input = child.stdin.take().unwrap();
    writeln!(
        input,
        "{{\"id\":\"bad\",\"text\":\"Hello\",\"speed\":2,\"volume\":1}}"
    )
    .unwrap();
    writeln!(input, "not json").unwrap();
    drop(input);
    let output = child.wait_with_output().unwrap();
    assert!(output.status.success());
    let lines: Vec<_> = output
        .stdout
        .split(|b| *b == b'\n')
        .filter(|b| !b.is_empty())
        .collect();
    assert_eq!(lines.len(), 2);
    let first: serde_json::Value = serde_json::from_slice(lines[0]).unwrap();
    assert_eq!(first["id"], "bad");
    assert!(first["error"].is_string());
    let second: serde_json::Value = serde_json::from_slice(lines[1]).unwrap();
    assert_eq!(second["id"], "");
    assert!(second["error"].is_string());
}

// KOKORO_TEST_MODEL_DIR is an explicit opt-in to the public model pack, no download or playback.
#[test]
fn public_pack_synthesizes_sequential_pcm() {
    let Some(dir) = std::env::var_os("KOKORO_TEST_MODEL_DIR") else {
        return;
    };
    let mut child = Command::new(env!("CARGO_BIN_EXE_jarvis-kokoro"))
        .arg("--model-dir")
        .arg(dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .unwrap();
    let mut input = child.stdin.take().unwrap();
    for id in ["first", "second"] {
        writeln!(input, "{{\"id\":\"{id}\",\"text\":\"Hello, I am Jarvis. All systems are ready.\",\"speed\":1.15,\"volume\":1}}").unwrap();
    }
    drop(input);
    let output = child.wait_with_output().unwrap();
    assert!(output.status.success());
    let lines: Vec<_> = output
        .stdout
        .split(|b| *b == b'\n')
        .filter(|b| !b.is_empty())
        .collect();
    assert_eq!(lines.len(), 2);
    for (index, line) in lines.iter().enumerate() {
        let v: serde_json::Value = serde_json::from_slice(line).unwrap();
        assert_eq!(v["id"], if index == 0 { "first" } else { "second" });
        assert_eq!(v["rate"], 24000);
        assert_eq!(v["end"], true);
        let pcm = STANDARD.decode(v["pcm"].as_str().unwrap()).unwrap();
        assert!(pcm.len() > 4800 && pcm.len() <= 24000 * 60 * 2 && pcm.len() % 2 == 0);
        assert!(pcm
            .chunks_exact(2)
            .any(|p| i16::from_le_bytes([p[0], p[1]]).unsigned_abs() > 100));
    }
}
